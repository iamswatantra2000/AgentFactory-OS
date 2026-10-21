import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';
import { createLogger } from '@agentfactory/observability';
import { createApp } from './app.js';
import { createIdentityRepository } from './repository.js';
import { createAuthMail } from './mailer.js';
import { createOAuthService } from './oauth.js';

if (process.env.NODE_ENV !== 'production') {
  try {
    loadEnvFile(new URL('../../../.env', import.meta.url));
  } catch {
    // Explicit environment variables are also supported.
  }
}

const config = z
  .object({
    IDENTITY_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
    IDENTITY_DATABASE_URL: z.url(),
    APP_BASE_URL: z.url().default('http://localhost:3000'),
    MAIL_HOST: z.string().default('localhost'),
    MAIL_PORT: z.coerce.number().int().default(1025),
    MAIL_SECURE: z.enum(['true', 'false']).default('false'),
    MAIL_FROM: z.string().default('AgentFactory OS <hello@agentfactory.local>'),
    MAIL_USER: z.string().optional(),
    MAIL_PASSWORD: z.string().optional(),
  })
  .parse(process.env);
const logger = createLogger('identity-service');
const repository = createIdentityRepository(config.IDENTITY_DATABASE_URL);
const mail = createAuthMail({
  host: config.MAIL_HOST,
  port: config.MAIL_PORT,
  secure: config.MAIL_SECURE === 'true',
  from: config.MAIL_FROM,
  appBaseUrl: config.APP_BASE_URL,
  user: config.MAIL_USER,
  password: config.MAIL_PASSWORD,
});
const oauth = createOAuthService(repository);
const server = createServer(createApp(repository, { mail, oauth }));
server.listen(config.IDENTITY_SERVICE_PORT, () =>
  logger.info({ port: config.IDENTITY_SERVICE_PORT }, 'Identity service listening'),
);
const shutdown = () => server.close(() => logger.info('Identity service stopped'));
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
