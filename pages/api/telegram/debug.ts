import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN
  const hasSecret = !!process.env.TELEGRAM_WEBHOOK_SECRET
  res.status(200).json({ ok: true, hasToken, hasSecret })
}

