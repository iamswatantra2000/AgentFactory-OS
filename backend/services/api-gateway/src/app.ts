import { createHash, randomUUID } from 'node:crypto';
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
const authWindowMs = 15 * 60 * 1000;

function authLimiter() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const limits: Record<string, number> = {
      '/login': 10,
      '/signup': 5,
      '/request-reset': 5,
      '/resend-verification': 5,
    };
    const suffix = request.path;
    const limit = limits[suffix];
    if (request.method !== 'POST' || !limit) return next();
    const email =
      typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const key = createHash('sha256')
      .update(`${suffix}:${email || request.ip || 'unknown'}`)
      .digest('hex');
    const now = Date.now();
    const current = attempts.get(key);
    const entry =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + authWindowMs };
    entry.count += 1;
    attempts.set(key, entry);
    if (attempts.size > 10_000) {
      for (const [stored, value] of attempts) if (value.resetAt <= now) attempts.delete(stored);
      if (attempts.size > 10_000) attempts.delete(attempts.keys().next().value!);
    }
    if (entry.count > limit) {
      response.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return identityProblem(response, 429, 'Too many attempts. Please try again later.');
    }
    next();
  };
}

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

async function projectActor(config: Config, request: Request) {
  const token = browserSession(request);
  if (!token) return null;
  const status = await identityRequest(config, '/v1/session/status', { token });
  if (!status.ok) return null;
  const parsed = z
    .object({
      authenticated: z.literal(true),
      user: z.object({ id: z.uuid(), workspaceId: z.uuid() }),
    })
    .safeParse(await status.json());
  return parsed.success ? { ...parsed.data.user, token } : null;
}

async function proxyProject(config: Config, request: Request, response: Response, path: string) {
  response.setHeader('Cache-Control', 'no-store');
  const origin = request.header('origin');
  if (origin && !config.allowedOrigins.includes(origin))
    return identityProblem(response, 403, 'Origin not allowed');
  try {
    const actor = await projectActor(config, request);
    if (!actor) return identityProblem(response, 401, 'Sign in to access projects');
    if (request.method === 'POST' && path === '/v1/projects') {
      const members = z
        .object({
          ownerId: z.uuid(),
          members: z
            .array(z.object({ userId: z.uuid(), role: z.enum(['admin', 'member']) }))
            .default([]),
        })
        .safeParse(request.body);
      if (!members.success) return identityProblem(response, 400, 'Invalid project members');
      if (members.data.members.length || members.data.ownerId !== actor.id) {
        const rosterResponse = await identityRequest(config, '/v1/workspaces/members', {
          token: actor.token,
        });
        if (!rosterResponse.ok)
          return identityProblem(response, 503, 'Workspace members unavailable');
        const roster = z
          .object({ members: z.array(z.object({ id: z.uuid() })) })
          .safeParse(await rosterResponse.json());
        if (!roster.success)
          return identityProblem(response, 502, 'Invalid workspace member response');
        const allowed = new Set(roster.data.members.map((member) => member.id));
        if (!allowed.has(members.data.ownerId))
          return identityProblem(response, 400, 'Select an owner from this workspace');
        if (members.data.members.some((member) => !allowed.has(member.userId)))
          return identityProblem(response, 400, 'Select members from this workspace');
      }
    }
    const upstream = await fetch(`${config.PROJECT_SERVICE_URL}${path}`, {
      method: request.method,
      headers: {
        'x-af-internal-token': config.PROJECT_SERVICE_INTERNAL_TOKEN,
        'x-af-user-id': actor.id,
        'x-af-workspace-id': actor.workspaceId,
        ...(request.method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      body: request.method === 'POST' ? JSON.stringify(request.body ?? {}) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    const payload = await upstream.json();
    return response.status(upstream.status).json(payload);
  } catch {
    return identityProblem(response, 503, 'Project service unavailable');
  }
}

export async function createApp(config: Config) {
  const logger = createLogger('api-gateway');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req: (request) => ({ id: request.id, method: request.method, url: request.url }),
      },
      genReqId: (request, response) => {
        const incoming = request.headers['x-correlation-id'];
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader('x-correlation-id', requestId);
        return requestId;
      },
    }),
  );
  app.use('/api/v1/projects', express.json({ limit: '128kb' }));
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
  app.use('/api/v1/auth', authLimiter());

  for (const [path, upstream, createsSession] of [
    ['/api/v1/auth/signup', '/v1/auth/register', false],
    ['/api/v1/auth/login', '/v1/auth/login', true],
    ['/api/v1/auth/verify-email', '/v1/auth/verify-email/confirm', true],
    ['/api/v1/auth/resend-verification', '/v1/auth/verify-email/request', false],
    ['/api/v1/auth/request-reset', '/v1/auth/password/request-reset', false],
    ['/api/v1/auth/reset-password', '/v1/auth/password/reset', false],
  ] as const) {
    app.post(path, async (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      try {
        const upstreamResponse = await identityRequest(config, upstream, {
          method: 'POST',
          body: request.body,
        });
        const payload: unknown =
          upstreamResponse.status === 204 ? null : await upstreamResponse.json();
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
        if (!createsSession)
          return upstreamResponse.status === 204
            ? response.status(204).end()
            : response.status(upstreamResponse.status).json(payload);
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

  app.get('/api/v1/auth/oauth/providers', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const upstream = await identityRequest(config, '/v1/auth/oauth/providers');
      return response.status(upstream.status).json(await upstream.json());
    } catch {
      return identityProblem(response, 503, 'Identity service unavailable');
    }
  });

  app.post('/api/v1/auth/oauth/:provider/start', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const provider = request.params.provider;
    if (typeof provider !== 'string' || !['google', 'microsoft', 'apple'].includes(provider))
      return identityProblem(response, 404, 'Unknown sign-in provider');
    try {
      const upstream = await identityRequest(config, `/v1/auth/oauth/${provider}/start`, {
        method: 'POST',
      });
      return response.status(upstream.status).json(await upstream.json());
    } catch {
      return identityProblem(response, 503, 'Identity service unavailable');
    }
  });

  app.post('/api/v1/auth/oauth/:provider/complete', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const provider = request.params.provider;
    if (typeof provider !== 'string' || !['google', 'microsoft', 'apple'].includes(provider))
      return identityProblem(response, 404, 'Unknown sign-in provider');
    try {
      const upstream = await identityRequest(config, `/v1/auth/oauth/${provider}/complete`, {
        method: 'POST',
        body: request.body,
      });
      const payload: unknown = await upstream.json();
      if (!upstream.ok) return response.status(upstream.status).json(payload);
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
      return response.json({ user: parsed.data.user });
    } catch {
      return identityProblem(response, 503, 'Identity service unavailable');
    }
  });

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

  app.get('/api/v1/workspace/members', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const token = browserSession(request);
      if (!token) return identityProblem(response, 401, 'Sign in required');
      const upstream = await identityRequest(config, '/v1/workspaces/members', { token });
      return response.status(upstream.status).json(await upstream.json());
    } catch {
      return identityProblem(response, 503, 'Workspace members unavailable');
    }
  });

  app.get('/api/v1/projects', (request, response) =>
    proxyProject(config, request, response, '/v1/projects'),
  );
  app.post('/api/v1/projects', (request, response) =>
    proxyProject(config, request, response, '/v1/projects'),
  );
  app.get('/api/v1/projects/:projectId', (request, response) =>
    proxyProject(config, request, response, `/v1/projects/${request.params.projectId}`),
  );
  app.get('/api/v1/projects/:projectId/graph', (request, response) =>
    proxyProject(config, request, response, `/v1/projects/${request.params.projectId}/graph`),
  );
  app.post('/api/v1/projects/:projectId/graph', (request, response) =>
    proxyProject(config, request, response, `/v1/projects/${request.params.projectId}/graph`),
  );
  for (const action of ['open', 'complete-setup', 'state'] as const) {
    app.post(`/api/v1/projects/:projectId/${action}`, (request, response) =>
      proxyProject(config, request, response, `/v1/projects/${request.params.projectId}/${action}`),
    );
  }

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
