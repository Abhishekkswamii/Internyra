import "server-only";
import { z } from "zod";
import { isPlaceholder } from "./client";

function clean(v: string | undefined): string | undefined {
  return isPlaceholder(v) ? undefined : v?.trim();
}

const flag = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? fallback : v === "true" || v === "1"));

/**
 * Server-only environment schema. Never import this module from client components:
 * only getClientConfig() is safe in the browser.
 */
export const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-6-luna"),
  AI_PROVIDER_ORDER: z.string().default("gemini,openai"),
  AI_WEB_SEARCH_ENABLED: flag(false),
  AI_INSPECTIONS_ENABLED: flag(false),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(60_000),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ADMIN_UID: z.string().optional(),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerConfig(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const cleaned: Record<string, string | undefined> = {};
  for (const key of Object.keys(serverEnvSchema.shape)) cleaned[key] = clean(env[key]);
  const parsed = serverEnvSchema.safeParse(cleaned);
  if (parsed.success) return parsed.data;
  // Invalid values fall back to the safe defaults (AI stays disabled); names only, never values.
  console.warn("Invalid server environment configuration for:", parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  return serverEnvSchema.parse({});
}
