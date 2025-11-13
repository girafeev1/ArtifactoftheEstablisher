import type { NextApiRequest, NextApiResponse } from 'next'
import { type ProjectRecord } from '../../../lib/projectsDatabase'
import { fetchInvoicesForProject, type ProjectInvoiceRecord, updateInvoiceForProject } from '../../../lib/projectInvoices'
import { updateProjectInDatabase } from '../../../lib/projectsDatabase'
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
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
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
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
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

function formatSubsidiaryName(id?: string | null): string | null {
  if (!id) return null
  const map: Record<string, string> = {
    'tebs-erl': 'Establish Records Limited',
    'erl': 'Establish Records Limited',
  }
  return map[id] || id
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

async function adminFetchAllProjectsForYear(year: string): Promise<{ projects: ProjectRecord[] }> {
  const list = await adminFetchProjectsForYear(year)
  return { projects: list }
}

type BubblePage = { chatId: number; messageIds: number[] }
const TG_PAGES_COLLECTION = 'tgPages'

async function saveProjectBubbles(chatId: number, messageIds: number[]) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ chatId, messageIds }, { merge: true })
  } catch {}
}

async function clearProjectBubbles(chatId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const snap = await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).get()
    if (!snap.exists) return
    const data = snap.data() as BubblePage
    const ids = Array.isArray(data?.messageIds) ? data.messageIds : []
    for (const id of ids) {
      try { await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }) }) } catch {}
    }
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).delete().catch(() => {})
  } catch {}
}

async function sendBubble(token: string, chatId: number, text: string, replyMarkup?: any): Promise<{ message_id?: number } | null> {
  try {
    const resp = await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup, parse_mode: 'HTML' }),
    })
    const data = await resp.json().catch(() => null)
    return data?.result || null
  } catch { return null }
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
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const parts: string[] = []
  // Heading
  parts.push('<b><u>Project Detail</u></b>')
  parts.push('')
  // presenter/worktype
  if (p.presenterWorkType) parts.push(esc(p.presenterWorkType))
  // project title in bold
  if (p.projectTitle) parts.push(`<b>${esc(p.projectTitle)}</b>`)
  // project nature italic
  if (p.projectNature) parts.push(`<i>${esc(p.projectNature)}</i>`)
  // empty line
  parts.push('')
  // subsidiary (name)
  const sub = formatSubsidiaryName(p.subsidiary)
  if (sub) parts.push(esc(sub))
  return parts.join('\n')
}

async function buildInvoicesKeyboard(year: string, projectId: string) {
  try {
    const invoices: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
    if (!invoices || invoices.length === 0) {
      return { inline_keyboard: [[{ text: 'No invoices', callback_data: 'NOP' }]] }
    }
    const rows = invoices.map((inv) => [
      { text: inv.invoiceNumber, callback_data: `INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` },
    ])
    return { inline_keyboard: rows }
  } catch (e: any) {
    console.error('[tg] failed to fetch invoices', { year, projectId, error: e?.message || String(e) })
    return { inline_keyboard: [] }
  }
}

function formatMoney(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

import { DIRECTORY_FIRESTORE_DATABASE_ID } from '../../../lib/firebase'
async function adminResolveBank(identifier: string | null | undefined): Promise<{ bankName?: string; bankCode?: string; accountType?: string } | null> {
  if (!identifier) return null
  try {
    const fs = getAdminFirestore(DIRECTORY_FIRESTORE_DATABASE_ID)
    const docRef = fs.collection('bankAccount').doc(String(identifier))
    const snap = await docRef.get()
    if (!snap.exists) return null
    const data = snap.data() as any
    const bankName = typeof data.bankName === 'string' ? data.bankName : undefined
    const bankCode = typeof data.bankCode === 'string' ? data.bankCode.replace(/[^0-9]/g,'').padStart(3,'0') : undefined
    const accountType = typeof data.accountType === 'string' ? data.accountType : undefined
    return { bankName, bankCode, accountType }
  } catch { return null }
}

async function buildInvoiceDetailsText(year: string, projectId: string, invoiceNumber: string): Promise<string> {
  const list: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
  const inv = list.find((i) => i.invoiceNumber === decodeURIComponent(invoiceNumber))
  if (!inv) return 'Invoice not found.'
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const lines: string[] = []
  // Heading
  lines.push('<b><u>Invoice Detail</u></b>')
  lines.push('')
  // Title
  lines.push(`<b>Invoice:</b> #${esc(inv.invoiceNumber)}`)
  // Client block
  if (inv.companyName) {
    lines.push('')
    lines.push(`<b>${esc(inv.companyName)}</b>`) // bold company name
    if (inv.addressLine1) lines.push(esc(inv.addressLine1))
    if (inv.addressLine2) lines.push(esc(inv.addressLine2))
    if (inv.addressLine3 || inv.region) {
      const addr3 = inv.addressLine3 ? esc(inv.addressLine3) : ''
      const reg = inv.region ? esc(inv.region) : ''
      const mix = [addr3, reg].filter(Boolean).join(', ')
      if (mix) lines.push(mix)
    }
    if (inv.representative) lines.push(`ATTN: <b><i>${esc(inv.representative)}</i></b>`) // bold+italic rep
  }
  // Items
  if (inv.items && inv.items.length > 0) {
    lines.push('')
    inv.items.forEach((it, idx) => {
      lines.push(`<b><u>Item ${idx + 1}:</u></b>`) // item heading with underline
      const title = it.title ? `<b>${esc(it.title)}</b>` : ''
      const subq = it.subQuantity ? ` x<i>${esc(it.subQuantity)}</i>` : ''
      const first = `${title}${subq}`.trim()
      if (first) lines.push(first)
      if (it.feeType) lines.push(`<i>${esc(it.feeType)}</i>`) // fee type italic
      if (it.notes) lines.push(esc(it.notes))
      const unit = typeof it.unitPrice === 'number' ? formatMoney(it.unitPrice) : '-'
      const qty = typeof it.quantity === 'number' ? it.quantity : 0
      const unitSuffix = it.quantityUnit ? `/${esc(it.quantityUnit)}` : ''
      // blank line, then italic calc = bold total
      const lineTotal =
        typeof it.unitPrice === 'number' && typeof it.quantity === 'number'
          ? formatMoney(it.unitPrice * it.quantity)
          : '-'
      lines.push('')
      lines.push(`<i>${unit} x ${qty}${unitSuffix}</i> = <b>${lineTotal}</b>`) // calc line per spec
      lines.push('')
    })
  }
  // Bottom total + To
  const bank = await adminResolveBank(inv.paidTo || null)
  const bankLabel = bank && (bank.bankName || bank.bankCode || bank.accountType)
    ? `${bank.bankName ? esc(bank.bankName) : ''}${bank.bankCode ? ` (${esc(bank.bankCode)})` : ''}${bank.accountType ? ` - ${esc(bank.accountType)}` : ''}`
    : (inv.paidTo ? esc(inv.paidTo) : '')
  lines.push(`<b>Total:</b> ${formatMoney(inv.amount)}`)
  if (bankLabel) lines.push(`<b>To:</b> ${bankLabel}`)
  if (inv.paymentStatus) lines.push(`<i>${esc(inv.paymentStatus)}</i>`)
  return lines.join('\n')
}

function extractBaseFromInvoice(inv: string): string {
  try {
    const v = decodeURIComponent(inv)
    const m = v.match(/^(#?\d{4}-\d{3}-\d{4})/)
    return m ? m[1] : v
  } catch {
    return inv
  }
}

// Pending edit storage (Firestore)
type PendingEdit = {
  chatId: number
  userId: number
  kind: 'PROJ' | 'INV'
  year: string
  projectId: string
  invoiceNumber?: string
  field?: string
  controllerMessageId: number
  step: 'await_field' | 'await_value' | 'preview'
  proposedValue?: string
}

const PENDING_EDITS_COLLECTION = 'tgEdits'

async function getPendingEditDocId(chatId: number, userId: number) {
  return `${chatId}_${userId}`
}

async function putPendingEdit(edit: PendingEdit) {
  const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
  const id = await getPendingEditDocId(edit.chatId, edit.userId)
  await fs.collection(PENDING_EDITS_COLLECTION).doc(id).set(edit, { merge: true })
}

async function readPendingEdit(chatId: number, userId: number): Promise<PendingEdit | null> {
  const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
  const id = await getPendingEditDocId(chatId, userId)
  const snap = await fs.collection(PENDING_EDITS_COLLECTION).doc(id).get()
  return snap.exists ? (snap.data() as PendingEdit) : null
}

async function clearPendingEdit(chatId: number, userId: number) {
  const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
  const id = await getPendingEditDocId(chatId, userId)
  await fs.collection(PENDING_EDITS_COLLECTION).doc(id).delete().catch(() => {})
}

const PROJECT_FIELD_LABELS: Record<string, string> = {
  projectTitle: 'Project Title',
  presenterWorkType: 'Presenter / Worktype',
  projectNature: 'Project Nature',
  subsidiary: 'Subsidiary',
}

const INVOICE_FIELD_LABELS: Record<string, string> = {
  paymentStatus: 'Payment Status',
  paidTo: 'Paid To (bank identifier)',
  representative: 'Representative',
  addressLine1: 'Address Line 1',
  addressLine2: 'Address Line 2',
  addressLine3: 'Address Line 3',
  region: 'Region',
}

function buildProjectEditFieldsKeyboard(year: string, projectId: string) {
  const keys = Object.keys(PROJECT_FIELD_LABELS)
  const rows = keys.map((k) => [{ text: PROJECT_FIELD_LABELS[k], callback_data: `EPF:PROJ:${year}:${projectId}:${k}` }])
  rows.push([{ text: '⬅ Back', callback_data: `P:${year}:${projectId}` }])
  return { inline_keyboard: rows }
}

function buildInvoiceEditFieldsKeyboard(year: string, projectId: string, invoiceNumber: string) {
  const keys = Object.keys(INVOICE_FIELD_LABELS)
  const rows = keys.map((k) => [{ text: INVOICE_FIELD_LABELS[k], callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:${k}` }])
  rows.push([{ text: '⬅ Back', callback_data: `INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }])
  return { inline_keyboard: rows }
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
    const userId = msg.from?.id as number
    const text = (msg.text as string).trim()
    if (text === '/start' || text === '/menu') {
      const years = ['2025', '2024', '2023', '2022', '2021']
      // Split welcome into two messages
      await tgSendMessage(token, chatId, 'Welcome to the Artifact of the Establishers.')
      await tgSendMessage(token, chatId, 'To locate the project you\'re looking for, please select the year the project was picked up below:', buildYearsKeyboard(years))
      return res.status(200).end('ok')
    }
    // Handle pending edit value input
    const pending = await readPendingEdit(chatId, userId)
    if (pending && pending.step === 'await_value' && pending.field) {
      const proposed = text
      pending.proposedValue = proposed
      pending.step = 'preview'
      await putPendingEdit(pending)
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const label = pending.kind === 'PROJ' ? PROJECT_FIELD_LABELS[pending.field] : INVOICE_FIELD_LABELS[pending.field]
      const preview = `Update <b>${esc(label)}</b> to:\n${esc(proposed)}\n\nConfirm?`
      const kb = {
        inline_keyboard: [
          [ { text: 'Confirm', callback_data: `EPCONFIRM:${pending.kind}` } ],
          [ { text: 'Revise', callback_data: `EPREVISE:${pending.kind}` }, { text: 'Cancel', callback_data: `EPCANCEL:${pending.kind}` } ],
        ]
      }
      // Show preview in the controller message
      await tgEditMessage(token, chatId, pending.controllerMessageId, preview, kb)
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
        // Delete any previously listed project bubbles
        await clearProjectBubbles(chatId)
        const { projects } = await adminFetchAllProjectsForYear(year)
        await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: [[{ text: '⬅ Back', callback_data: 'BK:YEARS' }]] })
        // Send one message per project with [Select] [Edit]
        const sentIds: number[] = []
        for (const p of projects) {
          const p1 = `${p.projectNumber}`
          const p2 = [p.presenterWorkType, p.projectTitle].filter(Boolean).join(' - ')
          const text = [p1, p2].filter(Boolean).join('\n')
          const resp = await sendBubble(token, chatId, text, {
            inline_keyboard: [[
              { text: 'Select', callback_data: `P:${year}:${p.id}` },
              { text: 'Edit', callback_data: `EDIT:PROJ:${year}:${p.id}` }
            ]]
          })
          if (resp?.message_id) sentIds.push(resp.message_id)
        }
        await saveProjectBubbles(chatId, sentIds)
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
      rows.push([{ text: 'Edit', callback_data: `EDIT:PROJ:${year}:_` }])
      rows.push([{ text: '⬅ Back', callback_data: `BK:YEARS` }])
      await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: rows })
      return res.status(200).end('ok')
    }
    if (data.startsWith('P:')) {
      const [, year, projectId] = data.split(':')
      await clearProjectBubbles(chatId)
      try {
        const text = await buildProjectDetailsText(year, projectId)
        const invKb = await buildInvoicesKeyboard(year, projectId)
        const rows = (invKb.inline_keyboard as any[])
        rows.push([{ text: 'Edit', callback_data: `EDIT:PROJ:${year}:${projectId}` }])
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
        // Edit + Back
        const rows = [
          [{ text: 'Edit', callback_data: `EDIT:INV:${year}:${projectId}:${encInvoice}` }],
          [{ text: '⬅ Back', callback_data: `P:${year}:${projectId}` }],
        ]
        await tgEditMessage(token, chatId, msgId, text, { inline_keyboard: rows })
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load invoice.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('EDIT:PROJ:')) {
      const parts = data.split(':')
      const year = parts[2]
      const projectId = parts[3] === '_' ? '' : parts[3]
      await putPendingEdit({
        chatId,
        userId: cq.from?.id as number,
        kind: 'PROJ',
        year,
        projectId,
        controllerMessageId: msgId,
        step: 'await_field',
      })
      await tgEditMessage(token, chatId, msgId, 'Select a field to edit:', buildProjectEditFieldsKeyboard(year, projectId))
      return res.status(200).end('ok')
    }
    if (data.startsWith('EDIT:INV:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      await putPendingEdit({
        chatId,
        userId: cq.from?.id as number,
        kind: 'INV',
        year,
        projectId,
        invoiceNumber: encInvoice,
        controllerMessageId: msgId,
        step: 'await_field',
      })
      await tgEditMessage(token, chatId, msgId, 'Select an invoice field to edit:', buildInvoiceEditFieldsKeyboard(year, projectId, decodeURIComponent(encInvoice)))
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPF:')) {
      // Choose field to edit
      const parts = data.split(':')
      const scope = parts[1] // PROJ | INV
      if (scope === 'PROJ') {
        const year = parts[2]; const projectId = parts[3]; const field = parts[4]
        await putPendingEdit({
          chatId,
          userId: cq.from?.id as number,
          kind: 'PROJ', year, projectId, controllerMessageId: msgId,
          step: 'await_value', field,
        })
        await tgEditMessage(token, chatId, msgId, `Send new value for <b>${PROJECT_FIELD_LABELS[field]}</b>`, { inline_keyboard: [[{ text: '⬅ Cancel', callback_data: `P:${year}:${projectId}` }]] })
      } else if (scope === 'INV') {
        const year = parts[2]; const projectId = parts[3]; const encInvoice = parts[4]; const field = parts[5]
        await putPendingEdit({
          chatId,
          userId: cq.from?.id as number,
          kind: 'INV', year, projectId, invoiceNumber: encInvoice, controllerMessageId: msgId,
          step: 'await_value', field,
        })
        await tgEditMessage(token, chatId, msgId, `Send new value for <b>${INVOICE_FIELD_LABELS[field]}</b>`, { inline_keyboard: [[{ text: '⬅ Cancel', callback_data: `INV:${year}:${projectId}:${encInvoice}` }]] })
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPCONFIRM:')) {
      const parts = data.split(':')
      const scope = parts[1] // PROJ | INV
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (!edit || edit.step !== 'preview' || !edit.field || !edit.proposedValue) {
        await tgAnswerCallback(token, cqid, 'No pending edit to confirm.')
        return res.status(200).end('ok')
      }
      try {
        if (scope === 'PROJ') {
          const updates: any = { [edit.field]: edit.proposedValue }
          await updateProjectInDatabase({ year: edit.year, projectId: edit.projectId, updates, editedBy: `tg:${userId}` })
          const text = await buildProjectDetailsText(edit.year, edit.projectId)
          const invKb = await buildInvoicesKeyboard(edit.year, edit.projectId)
          const rows = (invKb.inline_keyboard as any[])
          rows.push([{ text: 'Edit', callback_data: `EDIT:PROJ:${edit.year}:${edit.projectId}` }])
          rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${edit.year}:1` }])
          await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
        } else {
          const invNum = decodeURIComponent(edit.invoiceNumber || '')
          const invoices = await fetchInvoicesForProject(edit.year, edit.projectId)
          const current = invoices.find((i) => i.invoiceNumber === invNum)
          if (!current) throw new Error('Invoice not found')
          // Prepare input preserving existing fields
          const items = (current.items || []).map((it) => ({
            title: it.title || '', feeType: it.feeType || '', unitPrice: Number(it.unitPrice || 0), quantity: Number(it.quantity || 0), discount: Number(it.discount || 0), subQuantity: it.subQuantity || '', notes: it.notes || '', quantityUnit: it.quantityUnit || '',
          }))
          const client = {
            companyName: current.companyName || null,
            addressLine1: current.addressLine1 || null,
            addressLine2: current.addressLine2 || null,
            addressLine3: current.addressLine3 || null,
            region: current.region || null,
            representative: current.representative || null,
          }
          // Apply proposed
          const f = edit.field
          if (f && f in INVOICE_FIELD_LABELS) {
            if (f === 'representative') (client as any).representative = edit.proposedValue
            else if (f.startsWith('addressLine')) (client as any)[f] = edit.proposedValue
            else if (f === 'region') (client as any).region = edit.proposedValue
            else if (f === 'paymentStatus') (current as any).paymentStatus = edit.proposedValue
            else if (f === 'paidTo') (current as any).paidTo = edit.proposedValue
          }
          await updateInvoiceForProject({
            year: edit.year,
            projectId: edit.projectId,
            collectionId: 'invoice',
            invoiceNumber: invNum,
            baseInvoiceNumber: extractBaseFromInvoice(invNum),
            editedBy: `tg:${userId}`,
            items,
            client,
            taxOrDiscountPercent: current.taxOrDiscountPercent ?? null,
            paymentStatus: (current as any).paymentStatus || null,
            paidTo: (current as any).paidTo || null,
            paidOn: current.paidOnIso || null,
            onDate: current.paidOnIso || null,
          })
          const text = await buildInvoiceDetailsText(edit.year, edit.projectId, encodeURIComponent(invNum))
          const rows = [
            [{ text: 'Edit', callback_data: `EDIT:INV:${edit.year}:${edit.projectId}:${encodeURIComponent(invNum)}` }],
            [{ text: '⬅ Back', callback_data: `P:${edit.year}:${edit.projectId}` }],
          ]
          await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
        }
        await clearPendingEdit(chatId, userId)
      } catch (e: any) {
        await tgAnswerCallback(token, cqid, 'Failed to update.');
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPCANCEL:')) {
      const parts = data.split(':')
      const scope = parts[1]
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      await clearPendingEdit(chatId, userId)
      // Navigate back
      if (edit) {
        if (scope === 'PROJ') {
          const text = await buildProjectDetailsText(edit.year, edit.projectId)
          const invKb = await buildInvoicesKeyboard(edit.year, edit.projectId)
          const rows = (invKb.inline_keyboard as any[])
          rows.push([{ text: 'Edit', callback_data: `EDIT:PROJ:${edit.year}:${edit.projectId}` }])
          rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${edit.year}:1` }])
          await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
        } else {
          const inv = edit.invoiceNumber || ''
          const text = await buildInvoiceDetailsText(edit.year, edit.projectId, inv)
          const rows = [
            [{ text: 'Edit', callback_data: `EDIT:INV:${edit.year}:${edit.projectId}:${inv}` }],
            [{ text: '⬅ Back', callback_data: `P:${edit.year}:${edit.projectId}` }],
          ]
          await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
        }
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPREVISE:')) {
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (edit) {
        edit.step = 'await_value'
        await putPendingEdit(edit)
        const label = edit.kind === 'PROJ' ? PROJECT_FIELD_LABELS[edit.field || ''] : INVOICE_FIELD_LABELS[edit.field || '']
        await tgEditMessage(token, chatId, edit.controllerMessageId, `Send new value for <b>${label}</b>`, { inline_keyboard: [[{ text: '⬅ Cancel', callback_data: edit.kind==='PROJ'?`P:${edit.year}:${edit.projectId}`:`INV:${edit.year}:${edit.projectId}:${edit.invoiceNumber}` }]] })
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('BK:YEARS')) {
      const years = ['2025', '2024', '2023', '2022', '2021']
      await clearProjectBubbles(chatId)
      await tgEditMessage(token, chatId, msgId, welcomeText(), buildYearsKeyboard(years))
      return res.status(200).end('ok')
    }
    if (data.startsWith('BK:PROJ:')) {
      const [, , year, pageStr] = data.split(':')
      await clearProjectBubbles(chatId)
      const { projects } = await adminFetchAllProjectsForYear(year)
      await tgEditMessage(token, chatId, msgId, `Projects in ${year}:`, { inline_keyboard: [[{ text: '⬅ Back', callback_data: 'BK:YEARS' }]] })
      const sentIds: number[] = []
      for (const p of projects) {
        const p1 = `${p.projectNumber}`
        const p2 = [p.presenterWorkType, p.projectTitle].filter(Boolean).join(' - ')
        const text = [p1, p2].filter(Boolean).join('\n')
        const resp = await sendBubble(token, chatId, text, {
          inline_keyboard: [[
            { text: 'Select', callback_data: `P:${year}:${p.id}` },
            { text: 'Edit', callback_data: `EDIT:PROJ:${year}:${p.id}` }
          ]]
        })
        if (resp?.message_id) sentIds.push(resp.message_id)
      }
      await saveProjectBubbles(chatId, sentIds)
      return res.status(200).end('ok')
    }
  }

  // Default ack
  return res.status(200).end('ok')
}
