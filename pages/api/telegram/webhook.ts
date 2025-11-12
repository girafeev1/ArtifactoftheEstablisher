import type { NextApiRequest, NextApiResponse } from 'next'
import { type ProjectRecord } from '../../../lib/projectsDatabase'
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

async function tgSendChatAction(token: string, chatId: number | string, action: string = 'typing') {
  try {
    const resp = await fetch(`${TELEGRAM_API(token)}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    })
    if (!resp.ok) {
      console.warn('[tg] sendChatAction failed', { status: resp.status, statusText: resp.statusText })
    }
  } catch {}
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
    p.clientCompany ? `Client: ${p.clientCompany}` : '',
    p.paymentStatus ? `Status: ${p.paymentStatus}` : '',
  ].filter(Boolean)
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
      // Static year list (fast) — can later fetch from DB if needed
      const years = ['2025', '2024', '2023', '2022', '2021']
      const keyboard = years.map((y) => [{ text: y, callback_data: `Y:${y}` }])
      await tgSendMessage(token, chatId, 'Select a year:', { inline_keyboard: keyboard })
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
      // Show typing indicator instead of sending a loading text message
      await tgSendChatAction(token, chatId, 'typing')
      // Replace the controller message in-place
      try {
        const { kb, count } = await buildProjectsKeyboardForYear(year)
        if (!kb) {
          await tgEditMessage(token, chatId, msgId, `No projects found for ${year}.`)
        } else {
          await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, kb)
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
      await tgSendChatAction(token, chatId, 'typing')
      const projects = await adminFetchProjectsForYear(year)
      const kb = buildProjectsKeyboard(year, projects, page)
      await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, kb)
      return res.status(200).end('ok')
    }
    if (data.startsWith('P:')) {
      const [, year, projectId] = data.split(':')
      await tgSendChatAction(token, chatId, 'typing')
      try {
        const text = await buildProjectDetailsText(year, projectId)
        await tgEditMessage(token, chatId, msgId, text)
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load that project. Please try again.')
      }
      return res.status(200).end('ok')
    }
  }

  // Default ack
  return res.status(200).end('ok')
}
