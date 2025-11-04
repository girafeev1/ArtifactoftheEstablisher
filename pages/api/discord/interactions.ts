import type { NextApiRequest, NextApiResponse } from 'next'
import nacl from 'tweetnacl'

export const config = {
  api: {
    bodyParser: false,
  },
}

function hexToUint8Array(hex: string): Uint8Array {
  if (!hex || typeof hex !== 'string') return new Uint8Array()
  const clean = hex.replace(/^0x/, '')
  const len = clean.length / 2
  const out = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// Discord Interaction Types
const PING = 1
const APPLICATION_COMMAND = 2
const MESSAGE_COMPONENT = 3
const MODAL_SUBMIT = 5

// Discord Response Types
const PONG = 1
const CHANNEL_MESSAGE_WITH_SOURCE = 4

function respond(res: NextApiResponse, content: string, ephemeral = true) {
  return res.status(200).json({
    type: CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: ephemeral ? 64 : 0,
    },
  })
}

function mainMenu() {
  return {
    content: 'Choose an option:',
    flags: 64,
    components: [
      {
        type: 1, // ACTION_ROW
        components: [
          { type: 2, style: 1, label: 'Projects', custom_id: 'menu_projects' },
          { type: 2, style: 1, label: 'Invoices', custom_id: 'menu_invoices' },
          { type: 2, style: 2, label: 'Link Account', custom_id: 'menu_link' },
        ],
      },
    ],
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY || ''
  if (!publicKeyHex) {
    return res.status(500).json({ error: 'DISCORD_PUBLIC_KEY is not configured' })
  }

  const signature = req.headers['x-signature-ed25519'] as string
  const timestamp = req.headers['x-signature-timestamp'] as string
  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Bad signature headers' })
  }

  const rawBody = await readRawBody(req)
  const message = Buffer.concat([Buffer.from(timestamp), rawBody])
  const sig = hexToUint8Array(signature)
  const pub = hexToUint8Array(publicKeyHex)

  const valid = nacl.sign.detached.verify(new Uint8Array(message), sig, pub)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let json: any
  try {
    json = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const type = json?.type
  if (type === PING) {
    return res.status(200).json({ type: PONG })
  }

  if (type === APPLICATION_COMMAND) {
    const name = json.data?.name as string
    if (name === 'hello') {
      return respond(res, 'Hello from AOTE PMS 👋')
    }
    if (name === 'menu') {
      return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: mainMenu() })
    }
    if (name === 'project') {
      const sub = json.data?.options?.[0]?.name as string | undefined
      if (sub === 'open') {
        const projectId = json.data?.options?.[0]?.options?.find((o: any) => o.name === 'id')?.value as string | undefined
        if (!projectId) return respond(res, 'Please provide a project id, e.g. /project open id:2024-016')
        // TODO: Lookup project and return a summary. For now, acknowledge.
        return respond(res, `Opening project ${projectId}… (stub)`) 
      }
      return respond(res, 'Usage: /project open id:<project-key>')
    }
    return respond(res, `Unknown command: ${name}`)
  }

  if (type === MESSAGE_COMPONENT || type === MODAL_SUBMIT) {
    const customId = json.data?.custom_id as string | undefined
    if (customId === 'menu_projects') {
      return respond(res, 'Projects menu coming soon…')
    }
    if (customId === 'menu_invoices') {
      return respond(res, 'Invoices menu coming soon…')
    }
    if (customId === 'menu_link') {
      return respond(res, 'Account linking coming soon…')
    }
    return respond(res, 'Unsupported action')
  }

  return res.status(200).json({})
}
