import { randomUUID } from 'node:crypto';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import type { loadConfig } from './config.js';

type Config = ReturnType<typeof loadConfig>;

type ServiceStatus = { name: string; status: string; timestamp: string };
const sessionCookie = 'af_session';
const sessionMaxAgeMs = 7 * 24 * 60 * 60 * 1000;

function browserSession(request: Request) {
  const part = request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${sessionCookie}=`));
  const token = part?.slice(sessionCookie.length + 1);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

function identityProblem(response: Response, status: number, title: string) {
  return response
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status });
}

async function identityRequest(
  config: Config,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; token?: string } = {},
) {
  return fetch(`${config.IDENTITY_SERVICE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(3_000),
  });
}

async function readProjectStatus(config: Config, correlationId: string): Promise<ServiceStatus> {
  const response = await fetch(`${config.PROJECT_SERVICE_URL}/health/ready`, {
    headers: { 'x-correlation-id': correlationId },
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) throw new Error('Project service unavailable');
  return (await response.json()) as ServiceStatus;
}

export async function createApp(config: Config) {
  const logger = createLogger('api-gateway');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      genReqId: (request, response) => {
        const incoming = request.headers['x-correlation-id'];
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader('x-correlation-id', requestId);
        return requestId;
      },
    }),
  );
  app.use('/api/v1', express.json({ limit: '16kb' }));

  app.get('/health/live', (_request, response) => {
    response.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
  });

  app.get('/health/ready', async (request, response) => {
    try {
      await readProjectStatus(config, String(request.id));
      response.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
    } catch {
      response.status(503).type('application/problem+json').json({
        type: 'https://agentfactory.local/problems/dependency-unavailable',
        title: 'Required dependency unavailable',
        status: 503,
        correlationId: request.id,
      });
    }
  });

  app.use('/api/v1/auth', (request, response, next) => {
    const origin = request.header('origin');
    if (origin && !config.allowedOrigins.includes(origin)) {
      return identityProblem(response, 403, 'Origin not allowed');
    }
    next();
  });

  for (const [path, upstream] of [
    ['/api/v1/auth/signup', '/v1/auth/register'],
    ['/api/v1/auth/login', '/v1/auth/login'],
  ] as const) {
    app.post(path, async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      try {
        const upstreamResponse = await identityRequest(config, upstream, {
          method: 'POST',
          body: request.body,
        });
        const payload: unknown = await upstreamResponse.json();
        if (!upstreamResponse.ok) {
          const title =
            typeof payload === 'object' &&
            payload &&
            'title' in payload &&
            typeof payload.title === 'string'
              ? payload.title
              : 'Authentication failed';
          return identityProblem(response, upstreamResponse.status, title);
        }
        const parsed = z
          .object({
            token: z.string().regex(/^[0-9a-f]{64}$/),
            user: z.object({
              id: z.string().uuid(),
              email: z.email(),
              name: z.string().nullable(),
              workspaceId: z.string().uuid().nullable(),
            }),
          })
          .safeParse(payload);
        if (!parsed.success) return identityProblem(response, 502, 'Invalid identity response');
        response.cookie(sessionCookie, parsed.data.token, {
          httpOnly: true,
          secure: config.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: sessionMaxAgeMs,
        });
        return response.status(upstreamResponse.status).json({ user: parsed.data.user });
      } catch {
        return identityProblem(response, 503, 'Identity service unavailable');
      }
    });
  }

  app.get('/api/v1/session/status', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vary', 'Cookie');
    const token = browserSession(request);
    if (!token) return response.json({ authenticated: false });
    try {
      const upstream = await identityRequest(config, '/v1/session/status', { token });
      if (!upstream.ok) return identityProblem(response, 503, 'Identity service unavailable');
      const status: unknown = await upstream.json();
      const parsed = z
        .discriminatedUnion('authenticated', [
          z.object({ authenticated: z.literal(false) }),
          z.object({
            authenticated: z.literal(true),
            user: z.object({
              id: z.string().uuid(),
              email: z.email(),
              name: z.string().nullable(),
              workspaceId: z.string().uuid().nullable(),
            }),
          }),
        ])
        .safeParse(status);
      if (!parsed.success) return identityProblem(response, 502, 'Invalid identity response');
      return response.json(parsed.data);
    } catch {
      return identityProblem(response, 503, 'Identity service unavailable');
    }
  });

  app.post('/api/v1/auth/logout', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const token = browserSession(request);
    try {
      if (token) {
        const upstream = await identityRequest(config, '/v1/auth/logout', {
          method: 'POST',
          token,
        });
        if (!upstream.ok) return identityProblem(response, 503, 'Identity service unavailable');
      }
    } catch {
      return identityProblem(response, 503, 'Identity service unavailable');
    }
    response.clearCookie(sessionCookie, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    return response.status(204).end();
  });

  const graph = new ApolloServer({
    typeDefs: `
      type Query { systemStatus: SystemStatus! }
      type SystemStatus { gateway: ServiceStatus!, projectService: ServiceStatus! }
      type ServiceStatus { name: String!, status: String!, timestamp: String! }
    `,
    resolvers: {
      Query: {
        systemStatus: async (_parent, _args, context: { correlationId: string }) => ({
          gateway: { name: 'api-gateway', status: 'ok', timestamp: new Date().toISOString() },
          projectService: await readProjectStatus(config, context.correlationId),
        }),
      },
    },
  });
  await graph.start();
  app.use(
    '/graphql',
    cors({ origin: config.allowedOrigins, credentials: true }),
    express.json({ limit: '256kb' }),
    expressMiddleware(graph, {
      context: async ({ req }) => ({ correlationId: String(req.id) }),
    }),
  );

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    request.log.error({ err: error }, 'Unhandled request error');
    response.status(500).type('application/problem+json').json({
      type: 'https://agentfactory.local/problems/internal-error',
      title: 'Internal server error',
      status: 500,
      correlationId: request.id,
    });
  });

  return app;
}
