import type { NextApiRequest, NextApiResponse } from 'next';

type LogLevel = 'log' | 'warn' | 'error';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { level, args, timestamp, pathname, userAgent } = req.body || {};
    const lvl: LogLevel = ['log', 'warn', 'error'].includes(level) ? level : 'log';
    const time = typeof timestamp === 'string' ? timestamp : new Date().toISOString();
    const path = typeof pathname === 'string' ? pathname : '';
    const ua = typeof userAgent === 'string' ? userAgent : '';

    let message = '';
    try {
      message = (args || [])
        .map((a: any) => {
          if (typeof a === 'string') return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
    } catch {
      message = '';
    }
    if (message.length > 1000) {
      message = message.slice(0, 1000) + '…';
    }

    const prefix = `[CLIENT-${lvl.toUpperCase()}] ${time} ${path} ${ua} —`;
    console[lvl](`${prefix} ${message}`);
  } catch (err) {
    console.error('[CLIENT-LOG] Failed to log message', err);
  }

  return res.status(200).json({ ok: true });
}
