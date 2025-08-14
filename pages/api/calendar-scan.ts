import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from './auth/[...nextauth]';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const authOptions = await getAuthOptions();
  const session = await getServerSession(req, res, authOptions);
  const email = (session as any)?.user?.email as string | undefined;
  if (!email) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const allowedDomains = (process.env.ADMIN_EMAIL_DOMAINS || 'establishrecords.com')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  const allowedEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  const domain = email.split('@')[1];
  const authorized = allowedEmails.includes(email) || allowedDomains.includes(domain || '');
  if (!authorized) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const url = process.env.CALENDAR_SCAN_URL;
    if (!url) {
      return res.status(500).json({ error: 'CALENDAR_SCAN_URL not configured' });
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body && Object.keys(req.body).length ? req.body : { action: 'scanAll' }),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : 500).json(data);
  } catch (err: any) {
    console.error('[api/calendar-scan] error', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
