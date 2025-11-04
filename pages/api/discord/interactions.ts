import type { NextApiRequest, NextApiResponse } from 'next'
import nacl from 'tweetnacl'

const DISCORD_API = 'https://discord.com/api/v10'
type Snowflake = string

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
    if (name === 'postmenu') {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return respond(res, 'Missing DISCORD_BOT_TOKEN on server')
      const optChannel = json.data?.options?.find((o: any) => o.name === 'channel')?.value as string | undefined
      const targetChannel = optChannel || (json.channel_id as Snowflake)
      const messageBody = {
        content: 'AOTE PMS — Main Menu',
        components: mainMenu().components,
      }
      const r = await fetch(`${DISCORD_API}/channels/${targetChannel}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
        body: JSON.stringify(messageBody),
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        return respond(res, `Failed to post menu: ${r.status} ${text}`)
      }
      const msg = await r.json()
      // Try to pin (ignore failure if lacking permissions)
      await fetch(`${DISCORD_API}/channels/${targetChannel}/pins/${msg.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${token}` },
      }).catch(() => {})
      return respond(res, `Menu posted in <#${targetChannel}>`)
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
    const channelId = json.channel_id as Snowflake
    const user = json.member?.user
    const username = user?.global_name || user?.username || user?.id || 'user'

    // Helper to create a public thread that auto-archives in 24h
    const createThread = async (label: string) => {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { ok: false as const, error: 'Missing DISCORD_BOT_TOKEN' }
      const body = {
        name: `AOTE Session — ${label} — ${username}`.slice(0, 96),
        auto_archive_duration: 1440, // 24 hours
        type: 11, // GUILD_PUBLIC_THREAD
      }
      const r = await fetch(`${DISCORD_API}/channels/${channelId}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        return { ok: false as const, error: `Failed to create thread: ${r.status} ${text}` }
      }
      const thread = (await r.json()) as { id: Snowflake }
      return { ok: true as const, threadId: thread.id }
    }

    const postToThread = async (threadId: Snowflake, content: string, components?: any[]) => {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return false
      const r = await fetch(`${DISCORD_API}/channels/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
        body: JSON.stringify({ content, components }),
      })
      return r.ok
    }

    const startSession = async (label: string) => {
      const created = await createThread(label)
      if (!created.ok) return respond(res, created.error)
      const threadId = created.threadId
      // Seed the thread with a menu scaffold specific to the label
      const components = [
        {
          type: 1,
          components: [
            { type: 2, style: 1, label: 'Back to Main Menu', custom_id: 'menu_root' },
          ],
        },
      ]
      await postToThread(
        threadId,
        `Welcome to ${label}. I will guide you here. This thread will auto-archive in 24h.`,
        components,
      )
      // Acknowledge with a non-ephemeral link to the thread
      return res.status(200).json({
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Opened a new ${label} session: <#${threadId}>` ,
        },
      })
    }

    if (customId === 'menu_projects') {
      return await startSession('Projects')
    }
    if (customId === 'menu_invoices') {
      return await startSession('Invoices')
    }
    if (customId === 'menu_link') {
      return await startSession('Account Linking')
    }
    if (customId === 'menu_root') {
      return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: mainMenu() })
    }
    return respond(res, 'Unsupported action')
  }

  return res.status(200).json({})
}
