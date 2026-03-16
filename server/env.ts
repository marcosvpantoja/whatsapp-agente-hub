import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const booleanSchema = z
  .string()
  .optional()
  .transform((value) => value === "true");

const optionalBooleanSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_HOST: z.string().min(1).default("0.0.0.0"),
  APP_PORT: z.coerce.number().int().positive().default(3008),
  API_PORT: z.coerce.number().int().positive().default(3009),
  DB_HOST: z.string().min(1, "DB_HOST is required"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1, "DB_USER is required"),
  DB_PASSWORD: z.string().min(1, "DB_PASSWORD is required"),
  DB_NAME: z.string().min(1, "DB_NAME is required"),
  SESSION_COOKIE_NAME: z.string().min(1).default("wahub_session"),
  SESSION_COOKIE_SECURE: optionalBooleanSchema,
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  SETTINGS_ENCRYPTION_KEY: z.string().min(16, "SETTINGS_ENCRYPTION_KEY must have at least 16 characters").optional(),
  INTEGRATION_API_KEY: z.string().min(16, "INTEGRATION_API_KEY must have at least 16 characters").optional(),
  EVOLUTION_HOST: z.string().min(1).optional(),
  EVOLUTION_INSTANCE: z.string().min(1).optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  SEED_ON_STARTUP: booleanSchema,
  SEED_MASTER_PASSWORD: z.string().optional(),
  SEED_DEFAULT_CLIENT_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
