import type { NextApiRequest, NextApiResponse } from 'next'
import nacl from 'tweetnacl'
import { fetchProjectsFromDatabase, fetchProjectsForYear, type ProjectRecord, updateProjectInDatabase } from '../../../lib/projectsDatabase'
import { fetchInvoicesForProject, type ProjectInvoiceRecord } from '../../../lib/projectInvoices'

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
const DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5
const MODAL = 9

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

function yearSelectComponent(years: string[]) {
  return {
    type: 1,
    components: [
      {
        type: 3, // STRING_SELECT
        custom_id: 'sel_year',
        placeholder: 'Select year',
        min_values: 1,
        max_values: 1,
        options: years.slice(0, 25).map((y) => ({ label: y, value: y })),
      },
    ],
  }
}

function subsidiarySelectComponent() {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: 'sel_subsidiary',
        placeholder: 'Select subsidiary',
        min_values: 1,
        max_values: 1,
        options: [
          { label: 'Establish Records Limited', value: 'tebs-erl' },
        ],
      },
    ],
  }
}

function buildProjectOptions(projects: ProjectRecord[]) {
  return projects.slice(0, 25).map((p) => {
    const line1Left = p.projectNumber
    const presenter = p.presenterWorkType || ''
    const title = p.projectTitle || ''
    const line1Right = presenter && title ? `${presenter} - ${title}` : presenter || title
    const label = line1Right ? `${line1Left} | ${line1Right}` : `${line1Left}`

    const nature = p.projectNature || ''
    const pickup = p.projectDateDisplay || ''
    const desc = nature && pickup ? `${nature} / ${pickup}` : nature || pickup || undefined

    return {
      label: label.slice(0, 100),
      value: `${p.year}::${p.id}`,
      description: desc ? desc.slice(0, 100) : undefined,
    }
  })
}

function projectSelectComponent(projects: ProjectRecord[], year: string, page = 0) {
  const pageSize = 25
  const total = projects.length
  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1)
  const safePage = Math.min(Math.max(0, page), maxPage)
  const slice = projects.slice(safePage * pageSize, safePage * pageSize + pageSize)
  const options = buildProjectOptions(slice)

  const selectRow = {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `sel_project:${year}:page:${safePage}`,
        placeholder: `Select a project in ${year}`,
        min_values: 1,
        max_values: 1,
        options,
      },
    ],
  }

  const navRow = {
    type: 1,
    components: [
      { type: 2, style: 2, label: 'Prev', custom_id: `page_projects:${year}:page:${Math.max(0, safePage - 1)}`, disabled: safePage <= 0 },
      { type: 2, style: 2, label: 'Next', custom_id: `page_projects:${year}:page:${Math.min(maxPage, safePage + 1)}`, disabled: safePage >= maxPage },
      { type: 2, style: 1, label: 'Search', custom_id: `search_projects:${year}` },
    ],
  }

  return [selectRow, navRow]
}

function projectDetailsEmbed(p: ProjectRecord) {
  return {
    title: `${p.projectNumber} ${p.projectDateDisplay ? `· ${p.projectDateDisplay}` : ''}`.trim(),
    color: 0x22577A,
    fields: [
      { name: 'Presenter / Work Type', value: p.presenterWorkType || '—', inline: true },
      { name: 'Project Title', value: p.projectTitle || '—', inline: true },
      { name: 'Project Nature', value: p.projectNature || '—', inline: false },
      { name: 'Client', value: p.clientCompany || '—', inline: true },
      { name: 'Invoice', value: p.invoice || '—', inline: true },
      { name: 'Status', value: p.paymentStatus || '—', inline: true },
      { name: 'Bank', value: p.paidTo || '—', inline: true },
      { name: 'Amount', value: p.amount != null ? `${p.amount}` : '—', inline: true },
    ],
  }
}

function invoiceSelectComponent(invoices: ProjectInvoiceRecord[], year: string, projectId: string) {
  const opts = invoices.slice(0, 25).map((inv) => ({
    label: `${inv.invoiceNumber}${inv.paymentStatus ? ` · ${inv.paymentStatus}` : ''}`.slice(0, 100),
    value: inv.invoiceNumber,
    description: inv.total != null ? `Total: ${inv.total}` : undefined,
  }))
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `sel_invoice:${year}:${projectId}`,
        placeholder: 'Select an invoice',
        min_values: 1,
        max_values: 1,
        options: opts,
      },
    ],
  }
}

function invoiceDetailsEmbed(inv: ProjectInvoiceRecord) {
  return {
    title: `${inv.invoiceNumber}`,
    color: 0xA27B5C,
    fields: [
      { name: 'Company', value: inv.companyName || '—', inline: true },
      { name: 'Status', value: inv.paymentStatus || '—', inline: true },
      { name: 'Paid', value: inv.paid === true ? 'Yes' : inv.paid === false ? 'No' : '—', inline: true },
      { name: 'Total', value: inv.total != null ? String(inv.total) : inv.amount != null ? String(inv.amount) : '—', inline: true },
      { name: 'Bank', value: inv.paidTo || '—', inline: true },
      { name: 'Paid On', value: inv.paidOnDisplay || '—', inline: true },
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
  const interactionToken: string | undefined = json?.token
  const applicationId: string | undefined = process.env.DISCORD_APPLICATION_ID
  if (type === PING) {
    return res.status(200).json({ type: PONG })
  }

  if (type === APPLICATION_COMMAND) {
    const name = json.data?.name as string
    if (name === 'hello') {
      return respond(res, 'Hello from AOTE PMS 👋')
    }
    if (name === 'threads') {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return respond(res, 'Missing DISCORD_BOT_TOKEN on server')
      const scope = json.data?.options?.find((o: any) => o.name === 'type')?.value || 'active'
      const limit = Math.max(1, Math.min(50, Number(json.data?.options?.find((o: any) => o.name === 'limit')?.value || 10)))
      const guildId = json.guild_id as string
      const channelId = json.channel_id as string

      try {
        if (scope === 'active') {
          const r = await fetch(`${DISCORD_API}/guilds/${guildId}/threads/active`, {
            headers: { Authorization: `Bot ${token}` },
          })
          if (!r.ok) {
            const t = await r.text().catch(() => '')
            return respond(res, `Failed to list active threads: ${r.status} ${t}`)
          }
          const data = await r.json() as any
          const threads = (data.threads || []).filter((th: any) => th.parent_id === channelId).slice(0, limit)
          if (!threads.length) return respond(res, 'No active threads found in this channel')
          const lines = threads.map((th: any) => `• <#${th.id}> — ${th.name || '(no name)'} — by <@${th.owner_id || th.creator_id || 'unknown'}>`)
          return respond(res, `Active threads (showing ${threads.length}):\n${lines.join('\n')}`, false)
        } else {
          const r = await fetch(`${DISCORD_API}/channels/${channelId}/threads/archived/public?limit=${limit}`, {
            headers: { Authorization: `Bot ${token}` },
          })
          if (!r.ok) {
            const t = await r.text().catch(() => '')
            return respond(res, `Failed to list archived threads: ${r.status} ${t}`)
          }
          const data = await r.json() as any
          const threads = (data.threads || []).slice(0, limit)
          if (!threads.length) return respond(res, 'No archived threads found for this channel')
          const lines = threads.map((th: any) => `• <#${th.id}> — ${th.name || '(no name)'} — archived at ${th.thread_metadata?.archive_timestamp || ''}`)
          return respond(res, `Archived threads (showing ${threads.length}):\n${lines.join('\n')}`, false)
        }
      } catch (e: any) {
        return respond(res, `Error listing threads: ${e?.message || 'unknown error'}`)
      }
    }
    if (name === 'transcript') {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return respond(res, 'Missing DISCORD_BOT_TOKEN on server')
      const count = Math.max(1, Math.min(50, Number(json.data?.options?.find((o: any) => o.name === 'count')?.value || 25)))
      const optThread = json.data?.options?.find((o: any) => o.name === 'thread')?.value as string | undefined
      const targetChannelId = optThread || (json.channel_id as string)

      try {
        const r = await fetch(`${DISCORD_API}/channels/${targetChannelId}/messages?limit=${count}`, {
          headers: { Authorization: `Bot ${token}` },
        })
        if (!r.ok) {
          const t = await r.text().catch(() => '')
          return respond(res, `Failed to fetch messages: ${r.status} ${t}`)
        }
        const messages = await r.json() as any[]
        // Format newest→oldest to oldest→newest
        const ordered = messages.slice().reverse()
        const rows = ordered.map((m) => {
          const ts = new Date(m.timestamp).toLocaleString('en-US')
          const author = m.author?.global_name || m.author?.username || m.author?.id || 'unknown'
          const content = (m.content || '').replace(/\n/g, ' ')
          return `[${ts}] ${author}: ${content}`.slice(0, 1800)
        })
        const body = rows.join('\n')
        if (body.length < 1800) {
          return respond(res, '```\n' + body + '\n```', true)
        }
        // For larger results, send as a truncated code block
        return respond(res, '```\n' + body.slice(0, 1800) + '\n```\n(Truncated. Increase count in smaller increments.)', true)
      } catch (e: any) {
        return respond(res, `Error exporting transcript: ${e?.message || 'unknown error'}`)
      }
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
    const getChannel = async (id: string) => {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return null
      const r = await fetch(`${DISCORD_API}/channels/${id}`, {
        headers: { Authorization: `Bot ${token}` },
      })
      if (!r.ok) return null
      return (await r.json()) as any
    }

    const createThread = async (label: string) => {
      const token = process.env.DISCORD_BOT_TOKEN
      if (!token) return { ok: false as const, error: 'Missing DISCORD_BOT_TOKEN' }
      const code = Math.random().toString(36).slice(2, 8).toUpperCase()
      const current = await getChannel(channelId)
      const type = current?.type
      const baseId: string = (type === 10 || type === 11 || type === 12) && current?.parent_id
        ? current.parent_id
        : channelId

      // Forum/media channels require a different payload (must include a message)
      const isForum = current?.type === 15 || current?.type === 16
      const url = `${DISCORD_API}/channels/${baseId}/threads`
      const payload = isForum
        ? {
            name: `AOTE Session — ${label} — ${username} — #${code}`.slice(0, 96),
            auto_archive_duration: 1440,
            message: { content: `Session started — ${label}. This thread will auto-archive in 24h.` },
          }
        : {
            name: `AOTE Session — ${label} — ${username} — #${code}`.slice(0, 96),
            auto_archive_duration: 1440,
            type: 11, // GUILD_PUBLIC_THREAD
          }

      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${token}`,
        },
        body: JSON.stringify(payload),
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

    const followUp = async (payload: { content?: string; components?: any[]; embeds?: any[]; ephemeral?: boolean }) => {
      if (!interactionToken || !applicationId) return false
      const r = await fetch(`${DISCORD_API}/webhooks/${applicationId}/${interactionToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: payload.content,
          components: payload.components,
          embeds: payload.embeds,
          flags: payload.ephemeral ? 64 : 0,
        }),
      })
      return r.ok
    }

    const startOrContinueSession = async (label: string) => {
      const current = await getChannel(channelId)
      const isThread = current && (current.type === 10 || current.type === 11 || current.type === 12)

      // Build initial components (shared)
      let initialComponents: any[] = [
        { type: 1, components: [{ type: 2, style: 1, label: 'Back to Main Menu', custom_id: 'menu_root' }] },
      ]
      if (label === 'Projects' || label === 'Invoices') {
        try {
          const { years } = await fetchProjectsFromDatabase()
          initialComponents.push(yearSelectComponent(years))
          // Subsidiary selection is omitted for now since only ERL is available
        } catch {}
      }

      if (isThread) {
        // Continue in current thread instead of spawning a new one
        const help =
          label === 'Invoices'
            ? 'Step 1: Select a year. Step 2: Pick a project. Step 3: Select an invoice.'
            : 'Step 1: Select a year. Step 2: Pick a project.'
        await postToThread(channelId, `Continuing ${label} in this session. ${help}`, initialComponents)
        return res.status(200).json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
      }

      // Otherwise, create a new thread under the parent channel
      const created = await createThread(label)
      if (!created.ok) return respond(res, created.error)
      const threadId = created.threadId
      const help =
        label === 'Invoices'
          ? 'Step 1: Select a year. Step 2: Pick a project. Step 3: Select an invoice.'
          : 'Step 1: Select a year. Step 2: Pick a project.'
      await postToThread(threadId, `Welcome to ${label}. This session will auto-archive in 24h. ${help}`, initialComponents)
      // Acknowledge quickly; send a follow-up note with the link
      await followUp({ content: `Opened a new ${label} session: <#${threadId}>`, ephemeral: true })
      return res.status(200).json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
    }

    if (customId === 'menu_projects') {
      return await startOrContinueSession('Projects')
    }
    if (customId === 'menu_invoices') {
      return await startOrContinueSession('Invoices')
    }
    if (customId === 'menu_link') {
      return await startOrContinueSession('Account Linking')
    }
    if (customId === 'menu_root') {
      return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: mainMenu() })
    }
    // Year selection -> show first page of projects for that year
    if (customId === 'sel_year') {
      const values = (json.data?.values || []) as string[]
      const year = values[0]
      if (!year) return respond(res, 'Please select a year')
      ;(async () => {
        try {
          const inYear = await fetchProjectsForYear(year)
          const components = projectSelectComponent(inYear, year, 0)
          const ok = await followUp({ content: `Pick a project in ${year}:`, components, ephemeral: false })
          if (!ok) {
            await postToThread(channelId, `Pick a project in ${year}:`, Array.isArray(components) ? components as any[] : [components as any])
          }
        } catch (e) {
          await followUp({ content: 'Failed to load projects. Please try again.', ephemeral: true })
        }
      })()
      return res.status(200).json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
    }

    // Page projects list
    if (typeof customId === 'string' && customId.startsWith('page_projects:')) {
      const parts = customId.split(':')
      const year = parts[1]
      const page = Number(parts[3] || '0') || 0
      ;(async () => {
        try {
          const inYear = await fetchProjectsForYear(year)
          const components = projectSelectComponent(inYear, year, page)
          const ok = await followUp({ content: `Pick a project in ${year}:`, components, ephemeral: false })
          if (!ok) {
            await postToThread(channelId, `Pick a project in ${year}:`, Array.isArray(components) ? components as any[] : [components as any])
          }
        } catch {
          await followUp({ content: 'Failed to paginate projects.', ephemeral: true })
        }
      })()
      return res.status(200).json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
    }

    // Search projects by number (modal)
    if (typeof customId === 'string' && customId.startsWith('search_projects:')) {
      const parts = customId.split(':')
      const year = parts[1]
      return res.status(200).json({
        type: MODAL,
        data: {
          custom_id: `modal_search_project:${year}`,
          title: 'Search Project by Number',
          components: [
            {
              type: 1,
              components: [
                { type: 4, style: 1, custom_id: 'query', label: 'Project Number', min_length: 1, max_length: 50, required: true },
              ],
            },
          ],
        },
      })
    }
    // Subsidiary selection (placeholder; currently only ERL)
    if (customId === 'sel_subsidiary') {
      const values = (json.data?.values || []) as string[]
      const sub = values[0]
      return respond(res, `Subsidiary set to ${sub || 'ERL'}. Now select a year.`, true)
    }
    // Project selection -> show details
    if (typeof customId === 'string' && customId.startsWith('sel_project:')) {
      const values = (json.data?.values || []) as string[]
      const [year, projectId] = (values[0] || '').split('::')
      if (!year || !projectId) return respond(res, 'Invalid project selection')
      try {
        const inYear = await fetchProjectsForYear(year)
        const p = inYear.find((x) => x.id === projectId)
        if (!p) return respond(res, 'Project not found')
        // Multi-message details in thread
        const header = `Project ${p.projectNumber}${p.projectDateDisplay ? ` · ${p.projectDateDisplay}` : ''}\nPresenter/Work Type: ${p.presenterWorkType || '—'}\nTitle: ${p.projectTitle || '—'}\nNature: ${p.projectNature || '—'}`
        await postToThread(channelId, header)
        const client = `Client: ${p.clientCompany || '—'}`
        await postToThread(channelId, client)
        const billing = `Invoice: ${p.invoice || '—'}\nStatus: ${p.paymentStatus || '—'}\nAmount: ${p.amount != null ? String(p.amount) : '—'}\nBank: ${p.paidTo || '—'}`
        const actions = [
          {
            type: 1,
            components: [
              { type: 2, style: 1, label: 'Edit Client Name', custom_id: `edit_client:${year}:${projectId}` },
              { type: 2, style: 1, label: 'Edit Status', custom_id: `edit_status:${year}:${projectId}` },
              { type: 2, style: 1, label: 'Edit Bank', custom_id: `edit_bank:${year}:${projectId}` },
              { type: 2, style: 1, label: 'Open Invoices', custom_id: `open_invoices:${year}:${projectId}` },
            ],
          },
        ]
        await postToThread(channelId, billing, actions)
        return res.status(200).json({ type: DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE })
      } catch (e) {
        return respond(res, 'Failed to load project details')
      }
    }
    // Open invoices for selected project
    if (typeof customId === 'string' && customId.startsWith('open_invoices:')) {
      const [, year, projectId] = customId.split(':')
      if (!year || !projectId) return respond(res, 'Invalid project context for invoices')
      try {
        const invoices = await fetchInvoicesForProject(year, projectId)
        if (!invoices.length) return respond(res, 'No invoices found for this project.')
        const component = invoiceSelectComponent(invoices, year, projectId)
        return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Select an invoice:', components: [component] } })
      } catch {
        return respond(res, 'Failed to load invoices.')
      }
    }
    // Invoice selection -> show invoice details
    if (typeof customId === 'string' && customId.startsWith('sel_invoice:')) {
      const values = (json.data?.values || []) as string[]
      const invoiceNumber = values[0]
      const [, year, projectId] = customId.split(':')
      if (!invoiceNumber || !year || !projectId) return respond(res, 'Invalid invoice selection')
      try {
        const invoices = await fetchInvoicesForProject(year, projectId)
        const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber)
        if (!inv) return respond(res, 'Invoice not found')
        const embed = invoiceDetailsEmbed(inv)
        const actions = [
          {
            type: 1,
            components: [
              { type: 2, style: 2, label: 'Back to Main Menu', custom_id: 'menu_root' },
            ],
          },
        ]
        return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { embeds: [embed], components: actions } })
      } catch {
        return respond(res, 'Failed to load invoice details')
      }
    }

    // Edit client name — open modal
    if (typeof customId === 'string' && customId.startsWith('edit_client:')) {
      const [, year, projectId] = customId.split(':')
      return res.status(200).json({
        type: MODAL,
        data: {
          custom_id: `modal_edit_client:${year}:${projectId}`,
          title: 'Edit Client Name',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4, // TEXT_INPUT
                  custom_id: 'client_name',
                  style: 1, // SHORT
                  label: 'Client Name',
                  min_length: 1,
                  max_length: 100,
                  required: true,
                },
              ],
            },
          ],
        },
      })
    }

    // Modal submit handler
    if (type === MODAL_SUBMIT && typeof customId === 'string' && customId.startsWith('modal_edit_client:')) {
      const [, year, projectId] = customId.split(':')
      try {
        const rows = json.data?.components || []
        let newName = ''
        for (const row of rows) {
          for (const comp of row.components || []) {
            if (comp.custom_id === 'client_name') {
              newName = comp.value || ''
            }
          }
        }
        if (!newName) return respond(res, 'Client name is required.')
        const editedBy = (json.member?.user?.id && `discord:${json.member.user.id}`) || 'discord:unknown'
        await updateProjectInDatabase({ year, projectId, updates: { clientCompany: newName }, editedBy })
        await postToThread(channelId, `Client name updated to: ${newName}`)
        return respond(res, 'Client name updated.', true)
      } catch (e) {
        return respond(res, 'Failed to update client name.')
      }
    }

    // Edit payment status — open modal
    if (typeof customId === 'string' && customId.startsWith('edit_status:')) {
      const [, year, projectId] = customId.split(':')
      return res.status(200).json({
        type: MODAL,
        data: {
          custom_id: `modal_edit_status:${year}:${projectId}`,
          title: 'Edit Payment Status',
          components: [
            { type: 1, components: [ { type: 4, style: 1, custom_id: 'status', label: 'Payment Status', min_length: 1, max_length: 60, required: true } ] },
          ],
        },
      })
    }
    if (type === MODAL_SUBMIT && typeof customId === 'string' && customId.startsWith('modal_edit_status:')) {
      const [, year, projectId] = customId.split(':')
      try {
        const rows = json.data?.components || []
        let status = ''
        for (const row of rows) for (const comp of row.components || []) if (comp.custom_id === 'status') status = comp.value || ''
        if (!status) return respond(res, 'Status is required.')
        const editedBy = (json.member?.user?.id && `discord:${json.member.user.id}`) || 'discord:unknown'
        await updateProjectInDatabase({ year, projectId, updates: { paymentStatus: status }, editedBy })
        await postToThread(channelId, `Payment Status updated to: ${status}`)
        return respond(res, 'Payment Status updated.', true)
      } catch {
        return respond(res, 'Failed to update status.')
      }
    }

    // Edit bank (paidTo) — open modal
    if (typeof customId === 'string' && customId.startsWith('edit_bank:')) {
      const [, year, projectId] = customId.split(':')
      return res.status(200).json({
        type: MODAL,
        data: {
          custom_id: `modal_edit_bank:${year}:${projectId}`,
          title: 'Edit Bank (paidTo)',
          components: [
            { type: 1, components: [ { type: 4, style: 1, custom_id: 'bank', label: 'Bank / Account Identifier', min_length: 1, max_length: 80, required: true } ] },
          ],
        },
      })
    }
    if (type === MODAL_SUBMIT && typeof customId === 'string' && customId.startsWith('modal_edit_bank:')) {
      const [, year, projectId] = customId.split(':')
      try {
        const rows = json.data?.components || []
        let bank = ''
        for (const row of rows) for (const comp of row.components || []) if (comp.custom_id === 'bank') bank = comp.value || ''
        if (!bank) return respond(res, 'Bank is required.')
        const editedBy = (json.member?.user?.id && `discord:${json.member.user.id}`) || 'discord:unknown'
        await updateProjectInDatabase({ year, projectId, updates: { paidTo: bank }, editedBy })
        await postToThread(channelId, `Bank updated to: ${bank}`)
        return respond(res, 'Bank updated.', true)
      } catch {
        return respond(res, 'Failed to update bank.')
      }
    }

    // Modal submit: project search
    if (type === MODAL_SUBMIT && typeof customId === 'string' && customId.startsWith('modal_search_project:')) {
      const [, year] = customId.split(':')
      try {
        const rows = json.data?.components || []
        let query = ''
        for (const row of rows) for (const comp of row.components || []) if (comp.custom_id === 'query') query = comp.value || ''
        if (!query) return respond(res, 'Enter a project number.')
        const q = query.toLowerCase().trim()
        const inYear = await fetchProjectsForYear(year)
        const matches = inYear.filter((p) => (p.projectNumber || '').toLowerCase().includes(q))
        if (matches.length === 0) return respond(res, `No projects match "${query}" in ${year}.`)
        if (matches.length === 1) {
          const p = matches[0]
          const header = `Project ${p.projectNumber}${p.projectDateDisplay ? ` · ${p.projectDateDisplay}` : ''}\nPresenter/Work Type: ${p.presenterWorkType || '—'}\nTitle: ${p.projectTitle || '—'}\nNature: ${p.projectNature || '—'}`
          await postToThread(channelId, header)
          const client = `Client: ${p.clientCompany || '—'}`
          await postToThread(channelId, client)
          const billing = `Invoice: ${p.invoice || '—'}\nStatus: ${p.paymentStatus || '—'}\nAmount: ${p.amount != null ? String(p.amount) : '—'}\nBank: ${p.paidTo || '—'}`
          await postToThread(channelId, billing)
          return respond(res, 'Found and posted project.', true)
        }
        // multiple matches - show a select of matches
        const optionsRow = {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: `sel_project:${year}:page:0`,
              placeholder: `Select a project in ${year}`,
              min_values: 1,
              max_values: 1,
              options: buildProjectOptions(matches.slice(0, 25)),
            },
          ],
        }
        return res.status(200).json({ type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Multiple matches for "${query}":`, components: [optionsRow] } })
      } catch {
        return respond(res, 'Search failed.')
      }
    }
    return respond(res, 'Unsupported action')
  }

  return res.status(200).json({})
}
