import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),

  // OpenSky Network (optional) — unlocks full-day private jet history
  OPENSKY_CLIENT_ID: z.string().optional(),
  OPENSKY_CLIENT_SECRET: z.string().optional(),

  // Shared team login (single username/password, deliberately simple)
  SITE_USERNAME: z.string().optional().default("flesland"),
  SITE_PASSWORD: z.string().optional().default("flesland"),
  // Signs the 10-year auth cookie. Must be set (and kept stable) in production —
  // rotating it logs everyone out.
  AUTH_SECRET: z.string().optional().default("dev-only-insecure-secret-change-me"),
});

/**
 * Validate and parse environment variables
 */
const INSECURE_DEFAULT_AUTH_SECRET = "dev-only-insecure-secret-change-me";

function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    if (parsed.NODE_ENV === "production" && parsed.AUTH_SECRET === INSECURE_DEFAULT_AUTH_SECRET) {
      // The default secret is public (it's right here in the source). Anyone who
      // has read it could forge a valid login cookie, so refuse to boot rather
      // than run a production server that anyone can log into for free.
      console.error(
        "❌ AUTH_SECRET is still the default insecure value in production. " +
          "Set a real AUTH_SECRET (e.g. `openssl rand -hex 32`) before deploying."
      );
      process.exit(1);
    }
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
