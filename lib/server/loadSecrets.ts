// lib/server/loadSecrets.ts
export const GOOGLE_PROJECT_ID = 'GOOGLE_PROJECT_ID';
export const GOOGLE_CLIENT_EMAIL = 'GOOGLE_CLIENT_EMAIL';
export const GOOGLE_PRIVATE_KEY = 'GOOGLE_PRIVATE_KEY';

export function loadSecrets() {
  return {
    projectId: process.env.GOOGLE_PROJECT_ID || '',
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
    privateKey: process.env.GOOGLE_PRIVATE_KEY || '',
  };
}
