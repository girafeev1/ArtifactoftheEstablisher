// lib/server/secretManager.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { TextDecoder } from 'util';
import {
  loadSecrets,
  GOOGLE_PROJECT_ID,
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
} from './loadSecrets';

interface SecretFetchResult {
  secrets: Record<string, string>;
  diagnostics: {
    success: boolean;
    fetchedSecrets: string[];
    errors: { secret: string; message: string }[];
  };
}

export async function loadAppSecrets(): Promise<SecretFetchResult> {
  const { projectId, clientEmail, privateKey } = loadSecrets();
  const creds = {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  };

  const hasExplicitCreds =
    Boolean(creds.project_id) &&
    Boolean(creds.client_email) &&
    Boolean(creds.private_key);

  if (!hasExplicitCreds) {
    const missing: string[] = [];
    if (!creds.project_id) missing.push('GOOGLE_PROJECT_ID');
    if (!creds.client_email) missing.push('GOOGLE_CLIENT_EMAIL');
    if (!creds.private_key) missing.push('GOOGLE_PRIVATE_KEY');
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
          client_email: creds.client_email,
          private_key: creds.private_key,
        },
        projectId: creds.project_id,
      })
    : new SecretManagerServiceClient();


  const resolvedProjectId = hasExplicitCreds
    ? creds.project_id
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
        name: `projects/${resolvedProjectId}/secrets/${name}/versions/latest`,
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
