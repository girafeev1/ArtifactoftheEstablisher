import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const url = process.env.CALENDAR_SCAN_URL;
    if (!url) {
      return res.status(500).json({ error: 'CALENDAR_SCAN_URL not configured' });
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || { action: 'scanAll' }),
    });
    const data = await response.json();
    return res.status(response.ok ? 200 : 500).json(data);
  } catch (err: any) {
    console.error('[api/calendar-scan] error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
