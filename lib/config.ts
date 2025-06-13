// lib/config.ts

import fs from 'fs';

const envCreds = {
  project_id: process.env.GOOGLE_PROJECT_ID,
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined,
};

let fileCreds: typeof envCreds | null = null;

if (
  (!envCreds.project_id || !envCreds.client_email || !envCreds.private_key) &&
  process.env.GOOGLE_APPLICATION_CREDENTIALS
) {
  try {
    const raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
    const parsed = JSON.parse(raw);
    fileCreds = {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch (err) {
    console.error('Failed to read service account file:', err);
  }
}

export const serviceAccountCredentials = {
  project_id: envCreds.project_id || fileCreds?.project_id,
  client_email: envCreds.client_email || fileCreds?.client_email,
  private_key: envCreds.private_key || fileCreds?.private_key,
};

export const googleProjectId =
  serviceAccountCredentials.project_id ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  '';
