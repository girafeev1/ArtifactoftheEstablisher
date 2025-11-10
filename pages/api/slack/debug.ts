import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const hasSigning = Boolean(process.env.SLACK_SIGNING_SECRET)
  const hasToken = Boolean(process.env.SLACK_VERIFICATION_TOKEN)
  const hasBot = Boolean(process.env.SLACK_BOT_TOKEN)
  const allowUnverified = process.env.SLACK_ALLOW_UNVERIFIED === '1'
  res.status(200).json({ ok: true, hasSigning, hasToken, hasBot, allowUnverified })
}
