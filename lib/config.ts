// lib/config.ts

export const serviceAccountCredentials = {
  project_id: process.env.GOOGLE_PROJECT_ID || '',
  client_email: process.env.GOOGLE_CLIENT_EMAIL || '',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};
