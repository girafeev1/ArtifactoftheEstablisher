// lib/server/secretManager.ts

// Adapted to read secrets from environment variables on Vercel
// rather than Google Secret Manager

interface SecretFetchResult {
  secrets: Record<string, string>;
  diagnostics: {
    success: boolean;
    fetchedSecrets: string[];
    errors: { secret: string; message: string }[];
  };
}

/**
 * In the Vercel environment, secrets are provided directly via environment
 * variables. This helper simply reads them and returns a diagnostics object
 * for parity with the previous implementation that pulled from Google Secret
 * Manager.
 */
export async function loadSecrets(): Promise<SecretFetchResult> {
  const secrets = {
    OAUTH_CLIENT_ID: process.env.OAUTH_CLIENT_ID || '',
    OAUTH_CLIENT_SECRET: process.env.OAUTH_CLIENT_SECRET || '',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
    PMS_REFERENCE_LOG_ID: process.env.PMS_REFERENCE_LOG_ID || '',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '',
  };

  // NEXTAUTH_URL must be available at runtime for NextAuth to construct links
  if (secrets.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = secrets.NEXTAUTH_URL;
  }

  const diagnostics = {
    success: true,
    fetchedSecrets: Object.keys(secrets),
    errors: [] as { secret: string; message: string }[],
  };

  return { secrets, diagnostics };
}
