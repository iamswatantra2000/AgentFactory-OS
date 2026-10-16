import { randomUUID } from 'node:crypto';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createLogger } from '@agentfactory/observability';
import type { loadConfig } from './config.js';

type Config = ReturnType<typeof loadConfig>;

type ServiceStatus = { name: string; status: string; timestamp: string };

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

  app.get('/api/v1/session/status', (_request, response) => {
    response.json({ authenticated: false });
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
