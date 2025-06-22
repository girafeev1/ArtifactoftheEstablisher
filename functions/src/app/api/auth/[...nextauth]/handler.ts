// functions/src/app/api/auth/[...nextauth]/handler.ts
import { loadSecrets } from '../../../loadSecrets';

export function handler(req: any, res: any) {
  const { clientEmail } = loadSecrets();
  res.status(200).send(`Loaded client email: ${clientEmail}`);
}
