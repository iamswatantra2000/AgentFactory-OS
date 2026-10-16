import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: new URL('../../.env', import.meta.url) });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('IDENTITY_DATABASE_URL') },
});
