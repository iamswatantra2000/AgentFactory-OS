import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger('api-gateway');
const app = await createApp(config);
const server = createServer(app);

server.listen(config.API_GATEWAY_PORT, () =>
  logger.info({ port: config.API_GATEWAY_PORT }, 'Gateway listening'),
);

function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Shutdown failed');
      process.exitCode = 1;
    }
  });
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
