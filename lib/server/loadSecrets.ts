// lib/server/loadSecrets.ts
import { defineSecret } from 'firebase-functions/params';

export const GOOGLE_PROJECT_ID = defineSecret('GOOGLE_PROJECT_ID');
export const GOOGLE_CLIENT_EMAIL = defineSecret('GOOGLE_CLIENT_EMAIL');
export const GOOGLE_PRIVATE_KEY = defineSecret('GOOGLE_PRIVATE_KEY');

export function loadSecrets() {
  return {
    projectId: GOOGLE_PROJECT_ID.value() || process.env.GOOGLE_PROJECT_ID,
    clientEmail: GOOGLE_CLIENT_EMAIL.value() || process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: GOOGLE_PRIVATE_KEY.value() || process.env.GOOGLE_PRIVATE_KEY,
  };
}
