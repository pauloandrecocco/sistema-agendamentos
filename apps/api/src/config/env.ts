import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgresql:// URL' }),
  JWT_SECRET: z.string().min(1, { error: 'is required' }),
  // jsonwebtoken format with a mandatory unit: a bare number string would be read as milliseconds.
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^[1-9]\d*(s|m|h|d|w|y)$/, { error: 'must be a number with a unit, like "8h" or "30m"' })
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
