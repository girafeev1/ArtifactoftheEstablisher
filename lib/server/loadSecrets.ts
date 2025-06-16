// lib/server/loadSecrets.ts
import { defineSecret } from 'firebase-functions/params';

export const GOOGLE_PROJECT_ID = defineSecret('GOOGLE_PROJECT_ID');
export const GOOGLE_CLIENT_EMAIL = defineSecret('GOOGLE_CLIENT_EMAIL');
export const GOOGLE_PRIVATE_KEY = defineSecret('GOOGLE_PRIVATE_KEY');

export function loadSecrets() {
  return {
    projectId: GOOGLE_PROJECT_ID.value(),
    clientEmail: GOOGLE_CLIENT_EMAIL.value(),
    privateKey: GOOGLE_PRIVATE_KEY.value(),
  };
}
