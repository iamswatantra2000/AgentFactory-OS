import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import { createApp } from './app.js';
import { ProjectRepository } from './repository.js';

if (process.env.NODE_ENV !== 'production') {
  try {
    loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch {
    // Environment variables may already be supplied by the process manager.
  }
}

const config = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PROJECT_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4003),
    PROJECT_DATABASE_URL: z.url(),
    PROJECT_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
    PROJECT_SERVICE_INTERNAL_TOKEN: z.string().min(16).default('local-development-only-token'),
  })
  .parse(process.env);
if (
  config.NODE_ENV === 'production' &&
  config.PROJECT_SERVICE_INTERNAL_TOKEN === 'local-development-only-token'
) {
  throw new Error('Configure PROJECT_SERVICE_INTERNAL_TOKEN in production');
}

const logger = createLogger('project-service');
const pool = new Pool({ connectionString: config.PROJECT_DATABASE_URL });
const repository = new ProjectRepository(pool, config.PROJECT_LIMIT);
const server = createServer(createApp(repository, config.PROJECT_SERVICE_INTERNAL_TOKEN));
server.listen(config.PROJECT_SERVICE_PORT, () =>
  logger.info({ port: config.PROJECT_SERVICE_PORT }, 'Project service listening'),
);
const shutdown = () =>
  server.close(() => {
    void pool.end();
    logger.info('Project service stopped');
  });
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
