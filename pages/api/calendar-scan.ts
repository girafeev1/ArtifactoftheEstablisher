import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const url = process.env.CALENDAR_SCAN_URL;
    const secret = process.env.SCAN_SECRET;
    if (!url) {
      return res
        .status(500)
        .json({ ok: false, message: 'CALENDAR_SCAN_URL missing' });
    }
    if (!secret) {
      return res
        .status(500)
        .json({ ok: false, message: 'SCAN_SECRET missing' });
    }
    const body = req.body || { action: 'scanAll' };
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scan-Secret': secret || '',
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    if (response.ok) {
      return res.status(200).json(data);
    } else {
      return res
        .status(response.status)
        .json({ ok: false, message: data.message || `HTTP ${response.status}` });
    }
  } catch (err: any) {
    console.error('[api/calendar-scan] error', err);
    return res
      .status(500)
      .json({ ok: false, message: err.message || 'Internal server error' });
  }
}
