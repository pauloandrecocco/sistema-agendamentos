import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env files: use the repository root .env when present (local dev).
// In Docker the variables come from the container environment.
const rootEnvFile = new URL('../../.env', import.meta.url);
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Optional so that `prisma generate` works without a database (e.g. Docker build).
  datasource: { url: process.env.DATABASE_URL },
});
