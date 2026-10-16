import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PROJECT_SERVICE_URL: z.url().default('http://localhost:4003'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

export function loadConfig(input: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid gateway configuration: ${z.prettifyError(result.error)}`);
  }
  return {
    ...result.data,
    allowedOrigins: result.data.ALLOWED_ORIGINS.split(',').map((value) => value.trim()),
  };
}
