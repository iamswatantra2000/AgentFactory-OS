import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import { canUseTestCheckout } from './guard.js';

const config = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    ENTITLEMENT_SERVICE_PORT: z.coerce.number().default(4002),
    TEST_CHECKOUT_ENABLED: z.enum(['true', 'false']).default('false'),
  })
  .parse(process.env);
const logger = createLogger('entitlement-service');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use(
  pinoHttp({
    logger,
    serializers: {
      req: (request) => ({ id: request.id, method: request.method, url: request.url }),
    },
  }),
);
app.get('/health/live', (_req, res) =>
  res.json({ name: 'entitlement-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.get('/health/ready', (_req, res) =>
  res.json({ name: 'entitlement-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.post('/v1/test-transactions/activate', (_req, res) => {
  if (!canUseTestCheckout(config.NODE_ENV, config.TEST_CHECKOUT_ENABLED)) {
    return res
      .status(404)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: 'Not found', status: 404 });
  }
  return res
    .status(501)
    .type('application/problem+json')
    .json({ type: 'about:blank', title: 'Test activation is not implemented', status: 501 });
});
const server = createServer(app);
server.listen(config.ENTITLEMENT_SERVICE_PORT, () =>
  logger.info({ port: config.ENTITLEMENT_SERVICE_PORT }, 'Entitlement service listening'),
);
const shutdown = () => server.close(() => logger.info('Entitlement service stopped'));
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
