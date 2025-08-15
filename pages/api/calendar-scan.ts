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
    if (response.ok) {
      return res.status(200).json(data);
    } else {
      return res
        .status(500)
        .json({ ok: false, message: data.message || `HTTP ${response.status}` });
    }
  } catch (err: any) {
    console.error('[api/calendar-scan] error', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
}
