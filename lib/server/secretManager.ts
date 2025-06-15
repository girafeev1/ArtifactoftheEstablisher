// lib/server/secretManager.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { serviceAccountCredentials } from '../config';
import { TextDecoder } from 'util';

interface SecretFetchResult {
  secrets: Record<string, string>;
  diagnostics: {
    success: boolean;
    fetchedSecrets: string[];
    errors: { secret: string; message: string }[];
  };
}

export async function loadSecrets(): Promise<SecretFetchResult> {
  const hasExplicitCreds =
    Boolean(serviceAccountCredentials.project_id) &&
    Boolean(serviceAccountCredentials.client_email) &&
    Boolean(serviceAccountCredentials.private_key);

  if (!hasExplicitCreds) {
    const missing: string[] = [];
    if (!serviceAccountCredentials.project_id) missing.push('GOOGLE_PROJECT_ID');
    if (!serviceAccountCredentials.client_email)
      missing.push('GOOGLE_CLIENT_EMAIL');
    if (!serviceAccountCredentials.private_key)
      missing.push('GOOGLE_PRIVATE_KEY');
    console.warn(
      `[secretManager] Missing credentials: ${missing.join(', ') || 'unknown'}`
    );
    console.log(
      '[secretManager] Falling back to Application Default Credentials.'
    );
  }

  const client = hasExplicitCreds
    ? new SecretManagerServiceClient({
        credentials: {
          client_email: serviceAccountCredentials.client_email,
          private_key: serviceAccountCredentials.private_key,
        },
        projectId: serviceAccountCredentials.project_id,
      })
    : new SecretManagerServiceClient();

  const projectId = hasExplicitCreds
    ? serviceAccountCredentials.project_id
    : await client.getProjectId();

  const secrets: Record<string, string> = {};
  const diagnostics = {
    success: true,
    fetchedSecrets: [] as string[],
    errors: [] as { secret: string; message: string }[],
  };

  const secretNames = [
    { name: 'OAUTH_CLIENT_ID', key: 'OAUTH_CLIENT_ID' },
    { name: 'OAUTH_CLIENT_SECRET', key: 'OAUTH_CLIENT_SECRET' },
    { name: 'NEXTAUTH_SECRET', key: 'NEXTAUTH_SECRET' },
    { name: 'PMS_REFERENCE_LOG_ID', key: 'PMS_REFERENCE_LOG_ID' },
    { name: 'NEXTAUTH_URL', key: 'NEXTAUTH_URL' },
  ];

  for (const { name, key } of secretNames) {
    try {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${name}/versions/latest`,
      });

      const data = version.payload?.data;
      let secretValue = '';

      if (data) {
        if (typeof data === 'string') {
          secretValue = data;
        } else {
          const decoder = new TextDecoder('utf-8');
          secretValue = decoder.decode(data);
        }
      }

      secrets[key] = secretValue;
      diagnostics.fetchedSecrets.push(name);

      if (key === 'NEXTAUTH_URL') {
        process.env.NEXTAUTH_URL = secretValue;
      }
    } catch (error: any) {
      diagnostics.success = false;
      diagnostics.errors.push({ secret: name, message: error.message });
    }
  }

  if (!diagnostics.success) {
    console.error('Diagnostics - Secret Fetching Failed:', diagnostics.errors);
  } else {
    console.log('Diagnostics - Successfully fetched secrets:', diagnostics.fetchedSecrets);
  }

  return { secrets, diagnostics };
}
