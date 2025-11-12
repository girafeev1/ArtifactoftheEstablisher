import type { NextApiRequest, NextApiResponse } from 'next'
import { type ProjectRecord } from '../../../lib/projectsDatabase'
import { fetchInvoicesForProject, type ProjectInvoiceRecord } from '../../../lib/projectInvoices'
import { getAdminFirestore } from '../../../lib/firebaseAdmin'
import { PROJECTS_FIRESTORE_DATABASE_ID } from '../../../lib/firebase'

export const config = { api: { bodyParser: false } }

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

async function tgSendMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any
) {
  try {
    const resp = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    })
    let data: any = null
    try {
      data = await resp.json()
    } catch {
      // no-op
    }
    if (!resp.ok || (data && data.ok === false)) {
      console.error('[tg] sendMessage failed', {
        status: resp.status,
        statusText: resp.statusText,
        response: data,
      })
    } else {
      console.info('[tg] sendMessage ok', { chatId, hasMarkup: !!replyMarkup })
    }
  } catch {
    // ignore network errors
  }
}

async function tgAnswerCallback(token: string, callbackQueryId: string, text?: string) {
  try {
    await fetch(`${TELEGRAM_API(token)}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || '', show_alert: false }),
    })
  } catch {
    // ignore
  }
}

async function tgEditMessage(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: any
) {
  try {
    const resp = await fetch(`${TELEGRAM_API(token)}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup }),
    })
    let data: any = null
    try { data = await resp.json() } catch {}
    if (!resp.ok || (data && data.ok === false)) {
      console.error('[tg] editMessageText failed', { status: resp.status, statusText: resp.statusText, response: data })
    } else {
      console.info('[tg] editMessage ok', { chatId, messageId, hasMarkup: !!replyMarkup })
    }
  } catch {}
}

function formatProjectButtonText(p: ProjectRecord): string {
  const parts: string[] = []
  const head = p.projectNumber || p.id
  const mid = p.presenterWorkType ? ` | ${p.presenterWorkType}` : ''
  const tail = p.projectTitle ? ` — ${p.projectTitle}` : ''
  const text = `${head}${mid}${tail}`.trim()
  return text.length > 60 ? text.slice(0, 57) + '…' : text
}

function buildProjectsKeyboard(year: string, projects: ProjectRecord[], page = 1) {
  const pageSize = 25
  const totalPages = Math.max(1, Math.ceil(projects.length / pageSize))
  const pageIndex = Math.min(Math.max(1, page), totalPages) - 1
  const slice = projects.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)

  const rows = slice.map((p) => [{ text: formatProjectButtonText(p), callback_data: `P:${year}:${p.id}` }])
  const nav: any[] = []
  if (totalPages > 1) {
    if (pageIndex > 0) nav.push({ text: '◀ Prev', callback_data: `PG:${year}:${pageIndex}` })
    nav.push({ text: `Page ${pageIndex + 1}/${totalPages}`, callback_data: 'NOP' })
    if (pageIndex + 1 < totalPages) nav.push({ text: 'Next ▶', callback_data: `PG:${year}:${pageIndex + 2}` })
  }
  if (nav.length) rows.push(nav)
  return { inline_keyboard: rows }
}

function buildYearsKeyboard(years: string[]) {
  const rows = years.map((y) => [{ text: y, callback_data: `Y:${y}` }])
  return { inline_keyboard: rows }
}

function welcomeText(): string {
  return (
    'Welcome to the Artificat of the Establishers.  To locate the project you\'re looking for, please select the year the project was picked up:'
  )
}

async function adminFetchProjectsForYear(year: string): Promise<ProjectRecord[]> {
  const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
  const out: ProjectRecord[] = []
  try {
    const nested = await fs.collection('projects').doc(year).collection('projects').get()
    if (!nested.empty) {
      nested.forEach((doc: any) => {
        const d = doc.data() || {}
        out.push({
          id: doc.id,
          year,
          amount: typeof d.amount === 'number' ? d.amount : null,
          clientCompany: typeof d.clientCompany === 'string' ? d.clientCompany : null,
          invoice: typeof d.invoice === 'string' ? d.invoice : null,
          onDateDisplay: null,
          onDateIso: null,
          paid: typeof d.paid === 'boolean' ? d.paid : null,
          paidTo: typeof d.paidTo === 'string' ? d.paidTo : null,
          paymentStatus: typeof d.paymentStatus === 'string' ? d.paymentStatus : null,
          presenterWorkType: typeof d.presenterWorkType === 'string' ? d.presenterWorkType : null,
          projectDateDisplay: typeof d.projectDateDisplay === 'string' ? d.projectDateDisplay : null,
          projectDateIso: typeof d.projectDateIso === 'string' ? d.projectDateIso : null,
          projectNature: typeof d.projectNature === 'string' ? d.projectNature : null,
          projectNumber: typeof d.projectNumber === 'string' ? d.projectNumber : doc.id,
          projectTitle: typeof d.projectTitle === 'string' ? d.projectTitle : null,
          subsidiary: typeof d.subsidiary === 'string' ? d.subsidiary : null,
        })
      })
      out.sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true }))
      return out
    }
  } catch (e: any) {
    console.warn('[tg] adminFetch nested failed; will try legacy', { year, error: e?.message || String(e) })
  }
  try {
    const legacy = await fs.collection(year).get()
    legacy.forEach((doc: any) => {
      const d = doc.data() || {}
      out.push({
        id: doc.id,
        year,
        amount: typeof d.amount === 'number' ? d.amount : null,
        clientCompany: typeof d.clientCompany === 'string' ? d.clientCompany : null,
        invoice: typeof d.invoice === 'string' ? d.invoice : null,
        onDateDisplay: null,
        onDateIso: null,
        paid: typeof d.paid === 'boolean' ? d.paid : null,
        paidTo: typeof d.paidTo === 'string' ? d.paidTo : null,
        paymentStatus: typeof d.paymentStatus === 'string' ? d.paymentStatus : null,
        presenterWorkType: typeof d.presenterWorkType === 'string' ? d.presenterWorkType : null,
        projectDateDisplay: typeof d.projectDateDisplay === 'string' ? d.projectDateDisplay : null,
        projectDateIso: typeof d.projectDateIso === 'string' ? d.projectDateIso : null,
        projectNature: typeof d.projectNature === 'string' ? d.projectNature : null,
        projectNumber: typeof d.projectNumber === 'string' ? d.projectNumber : doc.id,
        projectTitle: typeof d.projectTitle === 'string' ? d.projectTitle : null,
        subsidiary: typeof d.subsidiary === 'string' ? d.subsidiary : null,
      })
    })
    out.sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true }))
  } catch (e: any) {
    console.error('[tg] adminFetch legacy failed', { year, error: e?.message || String(e) })
  }
  return out
}

// build helper only; do not send messages here to avoid duplication
async function buildProjectsKeyboardForYear(year: string) {
  console.info('[tg] year selected', { year })
  const projects = await adminFetchProjectsForYear(year)
  console.info('[tg] projects fetched', { year, count: projects.length })
  if (!projects.length) {
    return { kb: null as any, count: 0 }
  }
  const kb = buildProjectsKeyboard(year, projects, 1)
  return { kb, count: projects.length }
}

async function buildProjectDetailsText(year: string, projectId: string): Promise<string> {
  const list = await adminFetchProjectsForYear(year)
  const p = list.find((x) => x.id === projectId)
  if (!p) return 'Project not found. Please go back and pick another.'
  const lines = [
    `${p.projectNumber} ${p.projectDateDisplay ? '/ ' + p.projectDateDisplay : ''}`.trim(),
    [p.presenterWorkType, p.projectTitle].filter(Boolean).join(' — '),
    p.projectNature || '',
    p.subsidiary ? `${p.subsidiary}` : '',
    p.clientCompany ? `Client: ${p.clientCompany}` : '',
    p.paymentStatus ? `Status: ${p.paymentStatus}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

async function buildInvoicesKeyboard(year: string, projectId: string) {
  try {
    const invoices: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
    if (!invoices || invoices.length === 0) {
      return { inline_keyboard: [[{ text: 'No invoices', callback_data: 'NOP' }], [{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:1` }]] }
    }
    const rows = invoices.map((inv) => [
      { text: inv.invoiceNumber, callback_data: `INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` },
    ])
    rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:1` }])
    return { inline_keyboard: rows }
  } catch (e: any) {
    console.error('[tg] failed to fetch invoices', { year, projectId, error: e?.message || String(e) })
    return { inline_keyboard: [[{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:1` }]] }
  }
}

function formatMoney(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

async function buildInvoiceDetailsText(year: string, projectId: string, invoiceNumber: string): Promise<string> {
  const list: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
  const inv = list.find((i) => i.invoiceNumber === decodeURIComponent(invoiceNumber))
  if (!inv) return 'Invoice not found.'
  const lines: string[] = []
  lines.push(`${inv.invoiceNumber}`)
  lines.push(`Amount: ${formatMoney(inv.amount)}${inv.paymentStatus ? ` [${inv.paymentStatus}]` : ''}`)
  if (inv.paidTo) lines.push(`To: ${inv.paidTo}`)
  if (inv.companyName) {
    lines.push('')
    lines.push(inv.companyName)
    if (inv.addressLine1) lines.push(inv.addressLine1)
    if (inv.addressLine2) lines.push(inv.addressLine2)
    if (inv.addressLine3 || inv.region) {
      const addr3 = inv.addressLine3 ? inv.addressLine3 : ''
      const reg = inv.region ? inv.region : ''
      lines.push([addr3, reg].filter(Boolean).join(', '))
    }
    if (inv.representative) lines.push(`ATTN: ${inv.representative}`)
  }
  if (inv.items && inv.items.length > 0) {
    lines.push('')
    lines.push('Item *:')
    inv.items.forEach((it) => {
      const title = [it.title].filter(Boolean).join(' ')
      const qtyLine = `${title}${it.subQuantity ? ` x${it.subQuantity}` : ''}`
      if (qtyLine.trim()) lines.push(qtyLine)
      const ft = it.feeType ? `${it.feeType}` : ''
      if (ft) lines.push(ft)
      const notes = it.notes ? `${it.notes}` : ''
      if (notes) lines.push(notes)
      const unit = typeof it.unitPrice === 'number' ? formatMoney(it.unitPrice) : '-'
      const qty = typeof it.quantity === 'number' ? it.quantity : 0
      const lineTotal = typeof it.unitPrice === 'number' && typeof it.quantity === 'number' ? formatMoney(it.unitPrice * it.quantity) : '-'
      lines.push(`${unit} x ${qty}`)
      lines.push(`${lineTotal}`)
      lines.push('')
    })
  }
  return lines.join('\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const allowUnverified = (process.env.TELEGRAM_ALLOW_UNVERIFIED || '') === '1'
  if (!token) return res.status(200).end('ok')

  // Telegram may probe with GET/HEAD; always 200 to avoid 405s
  if (req.method && req.method !== 'POST') {
    console.info('[tg] webhook probe', {
      method: req.method,
      hasSecretHeader: !!req.headers['x-telegram-bot-api-secret-token'],
    })
    return res.status(200).end('ok')
  }

  // Verify optional webhook secret header (allow bypass when explicitly enabled)
  const hdr = (req.headers['x-telegram-bot-api-secret-token'] || '') as string
  if (secret && hdr !== secret && !allowUnverified) {
    console.warn('[tg] webhook drop: secret mismatch', {
      hasHeader: !!hdr,
      matches: hdr === secret,
    })
    return res.status(200).end('ok')
  }

  const raw = await readRawBody(req)
  let update: any
  try {
    update = JSON.parse(raw.toString('utf8'))
  } catch {
    return res.status(200).end('ok')
  }

  // IMPORTANT: Do not end the response yet. Vercel may freeze the
  // function after res.end(), preventing follow-up async work.
  // We'll end with 200 at the very end of processing.

  const msg = update.message
  const cq = update.callback_query

  try {
    const meta = {
      update_id: update.update_id,
      kind: msg ? 'message' : cq ? 'callback_query' : 'other',
      from: msg?.from?.id || cq?.from?.id || null,
      chat: msg?.chat?.id || cq?.message?.chat?.id || null,
      text: msg?.text || null,
      data: cq?.data || null,
    }
    console.info('[tg] update', meta)
  } catch {
    // ignore logging failures
  }

  if (msg && msg.text) {
    const chatId = msg.chat?.id as number
    const text = (msg.text as string).trim()
    if (text === '/start' || text === '/menu') {
      const years = ['2025', '2024', '2023', '2022', '2021']
      await tgSendMessage(token, chatId, welcomeText(), buildYearsKeyboard(years))
      return res.status(200).end('ok')
    }
  }

  if (cq && cq.data) {
    const data: string = cq.data
    const chatId = cq.message?.chat?.id as number
    const msgId = cq.message?.message_id as number
    const cqid = cq.id as string
    // Always acknowledge the callback to stop Telegram's loading spinner
    if (cqid) {
      tgAnswerCallback(token, cqid, 'Loading…').catch(() => {})
    }
    if (data.startsWith('Y:')) {
      const year = data.split(':')[1]
      // Replace the controller message in-place
      try {
        const { kb, count } = await buildProjectsKeyboardForYear(year)
        if (!kb) {
          await tgEditMessage(token, chatId, msgId, `No projects found for ${year}.`)
        } else {
          // Add back to years button
          const rows = (kb.inline_keyboard as any[])
          rows.push([{ text: '⬅ Back', callback_data: 'BK:YEARS' }])
          await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: rows })
        }
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, `Sorry, failed to load projects for ${year}.`)
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('PG:')) {
      // Pagination: PG:<year>:<page>
      const [, year, pageStr] = data.split(':')
      const page = parseInt(pageStr || '1', 10) || 1
      const projects = await adminFetchProjectsForYear(year)
      const kb = buildProjectsKeyboard(year, projects, page)
      const rows = (kb.inline_keyboard as any[])
      rows.push([{ text: '⬅ Back', callback_data: `BK:YEARS` }])
      await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: rows })
      return res.status(200).end('ok')
    }
    if (data.startsWith('P:')) {
      const [, year, projectId] = data.split(':')
      try {
        const text = await buildProjectDetailsText(year, projectId)
        const invKb = await buildInvoicesKeyboard(year, projectId)
        // Add back button to projects
        const rows = (invKb.inline_keyboard as any[])
        rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:1` }])
        await tgEditMessage(token, chatId, msgId, text, { inline_keyboard: rows })
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load that project. Please try again.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('INV:')) {
      const [, year, projectId, encInvoice] = data.split(':')
      try {
        const text = await buildInvoiceDetailsText(year, projectId, encInvoice)
        // Back to invoice list and project
        const rows = [[{ text: '⬅ Back', callback_data: `P:${year}:${projectId}` }]]
        await tgEditMessage(token, chatId, msgId, text, { inline_keyboard: rows })
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load invoice.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('BK:YEARS')) {
      const years = ['2025', '2024', '2023', '2022', '2021']
      await tgEditMessage(token, chatId, msgId, welcomeText(), buildYearsKeyboard(years))
      return res.status(200).end('ok')
    }
    if (data.startsWith('BK:PROJ:')) {
      const [, , year, pageStr] = data.split(':')
      const page = parseInt(pageStr || '1', 10) || 1
      const projects = await adminFetchProjectsForYear(year)
      const kb = buildProjectsKeyboard(year, projects, page)
      const rows = (kb.inline_keyboard as any[])
      rows.push([{ text: '⬅ Back', callback_data: 'BK:YEARS' }])
      await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: rows })
      return res.status(200).end('ok')
    }
  }

  // Default ack
  return res.status(200).end('ok')
}
