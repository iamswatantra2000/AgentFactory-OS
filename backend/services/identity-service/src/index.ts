import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';

const config = z
  .object({ IDENTITY_SERVICE_PORT: z.coerce.number().default(4001) })
  .parse(process.env);
const logger = createLogger('identity-service');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(pinoHttp({ logger }));
app.get('/health/live', (_req, res) =>
  res.json({ name: 'identity-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.get('/health/ready', (_req, res) =>
  res.json({ name: 'identity-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.get('/v1/session/status', (_req, res) => res.json({ authenticated: false }));
const server = createServer(app);
server.listen(config.IDENTITY_SERVICE_PORT, () =>
  logger.info({ port: config.IDENTITY_SERVICE_PORT }, 'Identity service listening'),
);
const shutdown = () => server.close(() => logger.info('Identity service stopped'));
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
