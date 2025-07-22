// lib/server/secretManager.ts

// Reading secrets directly from environment variables on Vercel

interface SecretFetchResult {
  secrets: Record<string, string>;
  diagnostics: {
    success: boolean;
    fetchedSecrets: string[];
    errors: { secret: string; message: string }[];
  };
}

export async function loadAppSecrets(): Promise<SecretFetchResult> {
  const envSecrets = [
    'OAUTH_CLIENT_ID',
    'OAUTH_CLIENT_SECRET',
    'NEXTAUTH_SECRET',
    'PMS_REFERENCE_LOG_ID',
    'NEXTAUTH_URL',
  ];

  const secrets: Record<string, string> = {};
  const diagnostics = {
    success: true,
    fetchedSecrets: [] as string[],
    errors: [] as { secret: string; message: string }[],
  };

  const missingSecrets: string[] = [];
  for (const name of envSecrets) {
    const val = process.env[name];
    if (val) {
      secrets[name] = val;
      diagnostics.fetchedSecrets.push(`${name} (env)`);
      if (name === 'NEXTAUTH_URL') {
        process.env.NEXTAUTH_URL = val;
      }
    } else {
      missingSecrets.push(name);
    }
  }

  if (missingSecrets.length > 0) {
    diagnostics.success = false;
    for (const n of missingSecrets) {
      diagnostics.errors.push({ secret: n, message: 'missing environment variable' });
    }
  } else {
    console.log('[secretManager] Loaded secrets from environment variables');
  }

  return { secrets, diagnostics };
}
