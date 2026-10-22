import { timingSafeEqual } from 'node:crypto';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import * as helmetModule from 'helmet';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { createLogger } from './logger.js';
import {
  DuplicateAccountError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidTokenError,
  AccountLinkRequiredError,
  ProviderEmailRequiredError,
  type IdentityRepository,
} from './repository.js';
import type { AuthMail } from './mailer.js';
import { createAuthMail } from './mailer.js';
import { createOAuthService } from './oauth.js';
import { createIdentityRepository } from './repository.js';
import {
  oauthProviders,
  OAuthProviderError,
  ProviderUnavailableError,
  type OAuthService,
  type OAuthProvider,
} from './oauth.js';

const email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
const password = z.string().min(12).max(128);
const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const emailSchema = z.object({ email });
const tokenSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/) });
const resetSchema = tokenSchema.extend({ password });
const oauthCompleteSchema = z.object({
  code: z.string().min(1).max(4096),
  state: z.string().regex(/^[0-9a-f]{64}$/),
});
const helmet = helmetModule.default as unknown as () => RequestHandler;

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

export function createApp(
  repository: IdentityRepository,
  services: { mail: AuthMail; oauth: OAuthService; internalToken?: string },
) {
  const logger = createLogger('identity-service');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  if (services.internalToken) {
    app.use('/v1', (request, response, next) => {
      const provided = Buffer.from(request.header('x-af-internal-token') ?? '');
      const expected = Buffer.from(services.internalToken!);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return problem(response, 403, 'Service access denied');
      }
      next();
    });
  }

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
      try {
        await services.mail.verification(account.email, account.verificationToken);
      } catch {
        return problem(
          response,
          503,
          'Account created, but verification email could not be sent. Request a new link.',
        );
      }
      return response.status(201).json({ requiresVerification: true, email: account.email });
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
      if (error instanceof EmailNotVerifiedError)
        return problem(response, 403, 'Verify your email before signing in');
      throw error;
    }
  });

  app.post('/v1/auth/verify-email/request', async (request, response) => {
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Enter a valid email address');
    const token = await repository.requestVerification(parsed.data.email);
    if (token) {
      try {
        await services.mail.verification(parsed.data.email, token);
      } catch (error) {
        request.log.error({ err: error }, 'Verification delivery failed');
      }
    }
    return response
      .status(202)
      .json({ message: 'If this account needs verification, we sent a new link.' });
  });

  app.post('/v1/auth/verify-email/confirm', async (request, response) => {
    const parsed = tokenSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Invalid verification link');
    try {
      return response.json(await repository.verifyEmail(parsed.data.token));
    } catch (error) {
      if (error instanceof InvalidTokenError) return problem(response, 400, error.message);
      throw error;
    }
  });

  app.post('/v1/auth/password/request-reset', async (request, response) => {
    const parsed = emailSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Enter a valid email address');
    const token = await repository.requestPasswordReset(parsed.data.email);
    if (token) {
      try {
        await services.mail.passwordReset(parsed.data.email, token);
      } catch (error) {
        request.log.error({ err: error }, 'Password reset delivery failed');
      }
    }
    return response.status(202).json({ message: 'If an account exists, we sent a reset link.' });
  });

  app.post('/v1/auth/password/reset', async (request, response) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Invalid reset details');
    try {
      await repository.resetPassword(parsed.data.token, parsed.data.password);
      return response.status(204).end();
    } catch (error) {
      if (error instanceof InvalidTokenError) return problem(response, 400, error.message);
      throw error;
    }
  });

  app.get('/v1/auth/oauth/providers', (_request, response) =>
    response.json(services.oauth.available()),
  );
  app.post('/v1/auth/oauth/:provider/start', async (request, response) => {
    const provider = request.params.provider;
    if (typeof provider !== 'string' || !oauthProviders.includes(provider as OAuthProvider))
      return problem(response, 404, 'Unknown sign-in provider');
    try {
      return response.json(await services.oauth.start(provider as OAuthProvider));
    } catch (error) {
      if (error instanceof ProviderUnavailableError) return problem(response, 503, error.message);
      throw error;
    }
  });
  app.post('/v1/auth/oauth/:provider/complete', async (request, response) => {
    const provider = request.params.provider;
    if (typeof provider !== 'string' || !oauthProviders.includes(provider as OAuthProvider))
      return problem(response, 404, 'Unknown sign-in provider');
    const parsed = oauthCompleteSchema.safeParse(request.body);
    if (!parsed.success) return problem(response, 400, 'Invalid sign-in response');
    try {
      return response.json(
        await services.oauth.complete(
          provider as OAuthProvider,
          parsed.data.code,
          parsed.data.state,
        ),
      );
    } catch (error) {
      if (error instanceof ProviderUnavailableError) return problem(response, 503, error.message);
      if (error instanceof AccountLinkRequiredError)
        return problem(
          response,
          409,
          'An account with this email already exists. Sign in with your original method.',
        );
      if (error instanceof ProviderEmailRequiredError) return problem(response, 422, error.message);
      if (error instanceof InvalidTokenError || error instanceof OAuthProviderError)
        return problem(response, 400, error.message);
      throw error;
    }
  });

  app.get('/v1/session/status', async (request, response) => {
    const token = bearer(request);
    if (!token) return response.json({ authenticated: false });
    const user = await repository.session(token);
    return response.json(user ? { authenticated: true, user } : { authenticated: false });
  });

  app.get('/v1/workspaces/members', async (request, response) => {
    const token = bearer(request);
    if (!token) return problem(response, 401, 'Sign in required');
    const user = await repository.session(token);
    if (!user?.workspaceId) return problem(response, 403, 'Workspace access required');
    return response.json({ members: await repository.workspaceMembers(user.workspaceId) });
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

let vercelApp: ReturnType<typeof createApp> | undefined;

export default function handler(request: Request, response: Response) {
  if (!vercelApp) {
    const config = z
      .object({
        IDENTITY_DATABASE_URL: z.url(),
        IDENTITY_SERVICE_INTERNAL_TOKEN: z.string().min(16),
        APP_BASE_URL: z.url(),
        MAIL_HOST: z.string().default('localhost'),
        MAIL_PORT: z.coerce.number().int().default(1025),
        MAIL_SECURE: z.enum(['true', 'false']).default('false'),
        MAIL_FROM: z.string().default('AgentFactory OS <hello@agentfactory.local>'),
        MAIL_USER: z.string().optional(),
        MAIL_PASSWORD: z.string().optional(),
      })
      .parse({
        ...process.env,
        IDENTITY_DATABASE_URL: process.env.IDENTITY_DATABASE_URL ?? process.env.DATABASE_URL,
      });
    const repository = createIdentityRepository(config.IDENTITY_DATABASE_URL);
    vercelApp = createApp(repository, {
      internalToken: config.IDENTITY_SERVICE_INTERNAL_TOKEN,
      mail: createAuthMail({
        host: config.MAIL_HOST,
        port: config.MAIL_PORT,
        secure: config.MAIL_SECURE === 'true',
        from: config.MAIL_FROM,
        appBaseUrl: config.APP_BASE_URL,
        user: config.MAIL_USER,
        password: config.MAIL_PASSWORD,
      }),
      oauth: createOAuthService(repository),
    });
  }
  vercelApp(request, response);
}
