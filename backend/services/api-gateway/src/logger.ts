import pino, { type Logger } from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-af-internal-token"]',
  'res.headers.set-cookie',
  '*.password',
  '*.token',
  '*.secret',
  '*.databaseUrl',
];

export function createLogger(serviceName: string): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service: serviceName,
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.APP_VERSION ?? '0.1.0',
    },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
  });
}
