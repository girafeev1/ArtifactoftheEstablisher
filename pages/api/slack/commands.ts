import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { fetchProjectsFromDatabase } from '../../../lib/projectsDatabase'

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
  if (!verifySlack(req, raw)) return res.status(401).end('Bad signature')

  const form = parseForm(raw.toString('utf8'))
  const command = form.command
  const userId = form.user_id

  if (command !== '/menu') {
    return res.status(200).json({
      response_type: 'ephemeral',
      text: 'Unknown command. Try /menu',
    })
  }

  // Preload years list quickly to render menu
  let yearOptions: any[] = []
  try {
    const { years } = await fetchProjectsFromDatabase()
    yearOptions = years.map((y) => ({ text: { type: 'plain_text', text: y }, value: y })).slice(0, 100)
  } catch {}

  const blocks = [
    { type: 'section', text: { type: 'mrkdwn', text: `Welcome to AOTE PMS <@${userId}>` } },
    {
      type: 'actions',
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

  return res.status(200).json({ response_type: 'ephemeral', blocks })
}

