// import { Networks } from "viem";
import { z } from "zod";

/**
 * Environment configuration for BasicMixer
 * This file centralizes all environment variables with strict Zod validation.
 * If any required variable is missing or invalid, the application will fail to start.
 * This prevents exposing incorrect APIs or misconfigured endpoints.
 */

// Strict Zod schema - no fallbacks, all required variables must be present
const environmentSchema = z.object({
    VITE_PUBLIC_ENV: z
        .string()
        .refine(
            (val) => val === 'production' || val === 'development',
            {
                message: 'VITE_PUBLIC_ENV must be either "production" or "development"',
            }
        ),
});

// Parse and validate environment variables - fail fast if invalid
const parseResult = environmentSchema.safeParse({
    VITE_PUBLIC_ENV: import.meta.env.VITE_PUBLIC_ENV,
});

if (!parseResult.success) {
    console.error("❌ Environment variables validation failed:");
    console.error("\n📋 Required environment variables:");
    console.error('- VITE_PUBLIC_ENV: "production" or "development"');

    throw new Error(
        "❌ Application cannot start with invalid environment configuration",
    );
}

// All environment variables are now guaranteed to be valid
const validatedEnv = parseResult.data;

// Environment flags derived from validated env
const isDevelopment = validatedEnv.VITE_PUBLIC_ENV === "development";
const isProduction = validatedEnv.VITE_PUBLIC_ENV === "production";

export const envVars = {
    isDevelopment,
    isProduction,
    INDEXER: {
        API_URL: isProduction ? "https://basicmixer-production.up.railway.app" : "http://localhost:42069/"
    }
};

export const {
    isDevelopment: isDevelopmentEnv,
    isProduction: isProductionEnv,
    INDEXER,
} = envVars;

// Export the validated environment for external use
export const validatedEnvironment = validatedEnv;