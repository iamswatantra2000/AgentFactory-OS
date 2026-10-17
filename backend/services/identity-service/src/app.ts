import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import {
  DuplicateAccountError,
  InvalidCredentialsError,
  type IdentityRepository,
} from './repository.js';

const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().min(12).max(128);
const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

function bearer(request: Request) {
  const match = /^Bearer ([0-9a-f]{64})$/.exec(request.header('authorization') ?? '');
  return match?.[1] ?? null;
}

function problem(response: Response, status: number, title: string) {
  return response.status(status).type('application/problem+json').json({
    type: 'about:blank',
    title,
    status,
  });
}

export function createApp(repository: IdentityRepository) {
  const logger = createLogger('identity-service');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(pinoHttp({ logger }));
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/health/live', (_request, response) =>
    response.json({ name: 'identity-service', status: 'ok', timestamp: new Date().toISOString() }),
  );
  app.get('/health/ready', async (_request, response) => {
    try {
      await repository.ready();
      response.json({
        name: 'identity-service',
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch {
      problem(response, 503, 'Identity database unavailable');
    }
  });

  app.post('/v1/auth/register', async (request, response) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Invalid account details');
    try {
      const account = await repository.register(parsed.data);
      return response.status(201).json(account);
    } catch (error) {
      if (error instanceof DuplicateAccountError)
        return problem(response, 409, 'Account already exists');
      throw error;
    }
  });

  app.post('/v1/auth/login', async (request, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Invalid sign-in details');
    try {
      return response.json(await repository.login(parsed.data));
    } catch (error) {
      if (error instanceof InvalidCredentialsError)
        return problem(response, 401, 'Invalid email or password');
      throw error;
    }
  });

  app.get('/v1/session/status', async (request, response) => {
    const token = bearer(request);
    if (!token) return response.json({ authenticated: false });
    const user = await repository.session(token);
    return response.json(user ? { authenticated: true, user } : { authenticated: false });
  });

  app.post('/v1/auth/logout', async (request, response) => {
    const token = bearer(request);
    if (token) await repository.logout(token);
    return response.status(204).end();
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    request.log.error({ err: error }, 'Identity request failed');
    problem(response, 500, 'Identity service error');
  });
  return app;
}
