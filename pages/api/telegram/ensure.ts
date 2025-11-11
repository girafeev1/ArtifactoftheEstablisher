import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (!token || !secret) return res.status(400).json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET' })

  // Only allow from our production host as a light safeguard
  const host = (req.headers['host'] || '').toString().toLowerCase()
  if (!host.includes('pms.theestablishers.com')) {
    return res.status(403).json({ ok: false, error: 'Forbidden host' })
  }

  const url = 'https://pms.theestablishers.com/api/telegram/webhook'
  try {
    const setResp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url, secret_token: secret }).toString(),
    })
    const setData = await setResp.json()
    const infoResp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const info = await infoResp.json()
    return res.status(200).json({ ok: true, setWebhook: setData, info })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' })
  }
}

