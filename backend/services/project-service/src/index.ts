import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';

const config = z
  .object({ PROJECT_SERVICE_PORT: z.coerce.number().default(4003) })
  .parse(process.env);
const logger = createLogger('project-service');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '256kb' }));
app.use(pinoHttp({ logger }));
app.get('/health/live', (_req, res) =>
  res.json({ name: 'project-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.get('/health/ready', (_req, res) =>
  res.json({ name: 'project-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.get('/v1/status', (_req, res) =>
  res.json({ name: 'project-service', status: 'ok', timestamp: new Date().toISOString() }),
);
app.post('/v1/projects', (req, res) => {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ type: 'about:blank', title: 'Invalid project', status: 400 });
  return res.status(201).json({
    id: randomUUID(),
    ...parsed.data,
    state: 'draft',
    createdAt: new Date().toISOString(),
  });
});
const server = createServer(app);
server.listen(config.PROJECT_SERVICE_PORT, () =>
  logger.info({ port: config.PROJECT_SERVICE_PORT }, 'Project service listening'),
);
const shutdown = () => server.close(() => logger.info('Project service stopped'));
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
