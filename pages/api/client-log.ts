// pages/api/client-log.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method Not Allowed' })
    }
    // Best-effort read body and print to server console in dev
    const { level, args, timestamp, pathname, userAgent } = (req.body || {}) as Record<string, unknown>
    const safeLevel = typeof level === 'string' ? level : 'log'
    const message = {
      ts: timestamp ?? new Date().toISOString(),
      path: pathname ?? null,
      ua: userAgent ?? null,
      args,
    }
    // eslint-disable-next-line no-console
    console[safeLevel as 'log' | 'warn' | 'error']?.('[CLIENT-LOG]', JSON.stringify(message))
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(200).json({ ok: true })
  }
}

