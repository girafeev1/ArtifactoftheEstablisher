// lib/config.ts

export const serviceAccountCredentials = {
  project_id: process.env.GOOGLE_PROJECT_ID || '',
  client_email: process.env.GOOGLE_CLIENT_EMAIL || '',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

const serviceVars = ['GOOGLE_PROJECT_ID','GOOGLE_CLIENT_EMAIL','GOOGLE_PRIVATE_KEY'];
export const serviceAccountReady = serviceVars.every(v => !!process.env[v]);
