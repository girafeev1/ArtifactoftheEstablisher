// functions/src/app/api/auth/[...nextauth]/handler.ts
import { loadSecrets, GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } from '../../../loadSecrets';

export function handler(req: any, res: any) {
  const { clientEmail } = loadSecrets();
  res.status(200).send(`Loaded client email: ${clientEmail}`);
}
