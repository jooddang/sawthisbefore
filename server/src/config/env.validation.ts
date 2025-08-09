import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url().or(z.string().min(1)),
  GOOGLE_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().default('text-embedding-004'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_PRIVATE_KEY_BASE64: z.string().optional(),
  NO_DB: z
    .union([z.string().transform((v) => v === 'true'), z.boolean()])
    .optional()
    .transform((v) => Boolean(v)),
});

export type AppEnv = z.infer<typeof schema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${message}`);
  }
  return parsed.data;
}


