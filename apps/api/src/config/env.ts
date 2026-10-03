import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgresql:// URL' }),
  JWT_SECRET: z.string().min(1, { error: 'is required' }),
  // Same format accepted by jsonwebtoken (e.g. "8h", "30m", "3600").
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+(ms|s|m|h|d|w|y)?$/, { error: 'must look like "8h", "30m" or "3600"' })
    .default('8h'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/** Validates the environment at startup; exits the process when it is invalid. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(
      `Invalid environment variables:\n${problems}\n` +
        'Outside Docker, copy .env.example to .env at the repository root.',
    );
    process.exit(1);
  }
  return result.data;
}
