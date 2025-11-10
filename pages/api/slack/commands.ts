import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'

export const config = {
  api: { bodyParser: false },
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function verifySlack(req: NextApiRequest, raw: Buffer): boolean {
  const sig = req.headers['x-slack-signature'] as string
  const ts = req.headers['x-slack-request-timestamp'] as string
  const secret = process.env.SLACK_SIGNING_SECRET || ''
  if (!sig || !ts || !secret) return false
  const fiveMin = 60 * 5
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(ts)) > fiveMin) return false
  const base = `v0:${ts}:${raw.toString('utf8')}`
  const hmac = crypto.createHmac('sha256', secret).update(base).digest('hex')
  const expected = `v0=${hmac}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch {
    return false
  }
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of body.split('&')) {
    const [k, v] = part.split('=')
    out[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '))
  }
  return out
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')
  const raw = await readRawBody(req)
  const formStr = raw.toString('utf8')
  const form = parseForm(formStr)
  const legacyToken = (form.token || '').trim()
  const envToken = (process.env.SLACK_VERIFICATION_TOKEN || '').trim()
  const tokenOk = !!legacyToken && !!envToken && legacyToken === envToken
  const allowUnverified = process.env.SLACK_ALLOW_UNVERIFIED === '1'
  if (!allowUnverified && !verifySlack(req, raw) && !tokenOk) {
    return res.status(401).end('Bad signature')
  }
  const command = form.command
  const userId = form.user_id
  const responseUrl = form.response_url

  if (command !== '/menu') {
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Unknown command. Try /menu',
    })
  }

  // Return instantly with a small static years list to avoid timeouts
  const staticYears = ['2025', '2024', '2023', '2022', '2021']
  const yearOptions = staticYears.map((y) => ({ text: { type: 'plain_text', text: y }, value: y }))

  const menuBlocks = [
    { type: 'section', block_id: 'menu_header', text: { type: 'mrkdwn', text: `Welcome to AOTE PMS <@${userId}>` } },
    {
      type: 'actions',
      block_id: 'menu_actions',
      elements: [
        {
          type: 'static_select',
          placeholder: { type: 'plain_text', text: 'Select year' },
          options: yearOptions,
          action_id: 'year_select',
        },
        { type: 'button', text: { type: 'plain_text', text: 'Show Projects' }, action_id: 'open_projects' },
      ],
    },
  ]

  // 1) Return a minimal-safe ephemeral message immediately to avoid dispatch_failed
  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({
    response_type: 'ephemeral',
    text: 'Menu loaded.',
    blocks: [ { type: 'section', block_id: 'menu_ack', text: { type: 'mrkdwn', text: 'Menu loaded.' } } ],
  })

  // 2) Then post the full menu via response_url
  try {
    if (responseUrl) {
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'ephemeral', replace_original: true, blocks: menuBlocks }),
      })
    }
  } catch {}
  return
}
