// lib/server/secretManager.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { TextDecoder } from 'util';
import { loadSecrets } from './loadSecrets';

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

  if (missingSecrets.length === 0) {
    console.log('[secretManager] Loaded secrets from environment variables');
    return { secrets, diagnostics };
  }

  const { projectId, clientEmail, privateKey } = loadSecrets();
  const creds = {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey ? privateKey.replace(/\\n/g, '\n') : '',
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
    if (missingSecrets.length > 0 && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.warn(
        `[secretManager] Missing env vars for: ${missingSecrets.join(', ')} and no credentials provided.`
      );
      diagnostics.success = false;
      for (const n of missingSecrets) {
        diagnostics.errors.push({ secret: n, message: 'missing env and credentials' });
      }
      return { secrets, diagnostics };
    }
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

  const secretNames = [
    { name: 'OAUTH_CLIENT_ID', key: 'OAUTH_CLIENT_ID' },
    { name: 'OAUTH_CLIENT_SECRET', key: 'OAUTH_CLIENT_SECRET' },
    { name: 'NEXTAUTH_SECRET', key: 'NEXTAUTH_SECRET' },
    { name: 'PMS_REFERENCE_LOG_ID', key: 'PMS_REFERENCE_LOG_ID' },
    { name: 'NEXTAUTH_URL', key: 'NEXTAUTH_URL' },
  ];

  for (const { name, key } of secretNames) {
    if (secrets[key]) {
      continue;
    }
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
