import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const key = (req.query.key || '') as string
  if (!token) return res.status(400).json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' })
  if (!secret) return res.status(400).json({ ok: false, error: 'Missing TELEGRAM_WEBHOOK_SECRET' })
  if (key !== secret) return res.status(401).json({ ok: false, error: 'Unauthorized' })

  const baseUrl = (req.query.url as string) || 'https://pms.theestablishers.com/api/telegram/webhook'

  try {
    const setResp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: baseUrl, secret_token: secret }).toString(),
    })
    const setData = await setResp.json()

    const infoResp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const info = await infoResp.json()

    return res.status(200).json({ ok: true, setWebhook: setData, info })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unknown error' })
  }
}

