import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { fetchProjectsForYear, type ProjectRecord } from '../../../lib/projectsDatabase'

export const config = { api: { bodyParser: false } }

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
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) } catch { return false }
}

function buildProjectOptions(projects: ProjectRecord[]) {
  return projects.slice(0, 100).map((p) => {
    const line1Left = p.projectNumber
    const presenter = p.presenterWorkType || ''
    const title = p.projectTitle || ''
    const line1Right = presenter && title ? `${presenter} - ${title}` : presenter || title
    const label = line1Right ? `${line1Left} | ${line1Right}` : `${line1Left}`
    const nature = p.projectNature || ''
    const pickup = p.projectDateDisplay || ''
    const desc = nature && pickup ? `${nature} / ${pickup}` : nature || pickup || ''
    return {
      text: { type: 'plain_text', text: label.slice(0, 75) },
      value: `${p.year}::${p.id}`,
      description: desc ? { type: 'plain_text', text: desc.slice(0, 75) } : undefined,
    }
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed')
  const raw = await readRawBody(req)
  if (!verifySlack(req, raw)) return res.status(401).end('Bad signature')

  const form = raw.toString('utf8')
  const payloadStr = decodeURIComponent((form.split('payload=')[1] || '').replace(/\+/g, ' '))
  let payload: any
  try { payload = JSON.parse(payloadStr) } catch { return res.status(200).end() }

  // Handle block actions
  if (payload.type === 'block_actions') {
    const actions = payload.actions || []
    const action = actions[0]
    const userId = payload.user?.id
    const responseUrl = payload.response_url
    const channelId = payload.channel?.id

    // Persist selected year in private_metadata or in-state on button
    if (action.action_id === 'open_projects') {
      // Try to read selected year from state
      const state = payload.state?.values || {}
      let year = ''
      for (const blockId of Object.keys(state)) {
        const block = state[blockId]
        for (const key of Object.keys(block)) {
          const item = block[key]
          if (item?.selected_option?.value) {
            year = item.selected_option.value
          }
        }
      }
      if (!year) {
        return res.status(200).json({ response_type: 'ephemeral', text: 'Please select a year first.' })
      }
      // Ack immediately to avoid timeouts, then send projects via response_url
      res.status(200).json({ response_type: 'ephemeral', text: `Loading projects for ${year}…` })
      try {
        const projects = await fetchProjectsForYear(year)
        const options = buildProjectOptions(projects)
        const blocks = [
          { type: 'section', text: { type: 'mrkdwn', text: `Projects in ${year}` } },
          {
            type: 'actions',
            elements: [
              {
                type: 'static_select',
                placeholder: { type: 'plain_text', text: 'Select project' },
                options,
                action_id: 'select_project',
              },
            ],
          },
        ]
        if (responseUrl) {
          await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response_type: 'ephemeral', replace_original: true, blocks }),
          })
        }
      } catch {}
      return
    }

    if (action.action_id === 'year_select') {
      // Acknowledge silently
      return res.status(200).json({})
    }

    if (action.action_id === 'select_project') {
      const value = action.selected_option?.value as string
      const [year, projectId] = (value || '').split('::')
      if (!year || !projectId) return res.status(200).json({ response_type: 'ephemeral', text: 'Invalid selection.' })
      // Minimal detail card for now
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `*Project* ${projectId} in ${year}` } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'Open Invoices' }, action_id: 'open_invoices' },
          ],
        },
      ]
      return res.status(200).json({ response_type: 'ephemeral', blocks })
    }
  }

  return res.status(200).end()
}
