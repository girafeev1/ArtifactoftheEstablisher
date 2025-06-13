// lib/server/secretManager.ts

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { serviceAccountCredentials, googleProjectId } from '../config';
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
  const projectId =
    googleProjectId || serviceAccountCredentials.project_id || undefined;

  const client = serviceAccountCredentials.client_email &&
    serviceAccountCredentials.private_key
      ? new SecretManagerServiceClient({
          credentials: {
            client_email: serviceAccountCredentials.client_email,
            private_key: serviceAccountCredentials.private_key,
          },
          projectId,
        })
      : new SecretManagerServiceClient();

  if (!projectId) {
    throw new Error('Project ID is missing.');
  }

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
