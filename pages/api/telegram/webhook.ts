import type { NextApiRequest, NextApiResponse } from 'next'
import { type ProjectRecord } from '../../../lib/projectsDatabase'
import { fetchInvoicesForProject, type ProjectInvoiceRecord, updateInvoiceForProject, renameInvoiceForProject, createInvoiceForProject } from '../../../lib/projectInvoices'
import { createProjectInDatabase } from '../../../lib/projectsDatabase'
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

async function tgDeleteMessage(token: string, chatId: number | string, messageId: number) {
  try {
    await fetch(`${TELEGRAM_API(token)}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    })
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
  return 'Welcome to the Telegram portal of the Artifact of the Establishers'
}

// Resolve subsidiary identifier -> English name using admin Firestore (aote-ref)
async function adminResolveSubsidiaryName(id?: string | null): Promise<string | null> {
  if (!id) return null
  try {
    const fs = getAdminFirestore('aote-ref')
    // @ts-ignore Firestore from @google-cloud/firestore has the same API surface used here
    const snap = await fs.collection('Subsidiaries').doc(String(id)).get()
    if (!snap.exists) return id
    const data = snap.data() as any
    const name = typeof data?.englishName === 'string' && data.englishName.trim().length > 0
      ? data.englishName.trim()
      : null
    return name || id
  } catch {
    return id
  }
}

async function adminFetchProjectsForYear(year: string): Promise<ProjectRecord[]> {
  const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
  const out: ProjectRecord[] = []
  const toIso = (v: any): string | null => {
    try {
      if (!v) return null
      if (typeof v === 'string') {
        const d = new Date(v)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      if (typeof v === 'object') {
        if (v.toDate && typeof v.toDate === 'function') {
          const d = v.toDate()
          return Number.isNaN(d.getTime()) ? null : d.toISOString()
        }
        if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') {
          const ms = v.seconds * 1000 + Math.floor(v.nanoseconds / 1e6)
          const d = new Date(ms)
          return Number.isNaN(d.getTime()) ? null : d.toISOString()
        }
      }
    } catch {}
    return null
  }
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
          onDateIso: toIso(d.onDate) || null,
          paid: typeof d.paid === 'boolean' ? d.paid : null,
          paidTo: typeof d.paidTo === 'string' ? d.paidTo : null,
          paymentStatus: typeof d.paymentStatus === 'string' ? d.paymentStatus : null,
          presenterWorkType: typeof d.presenterWorkType === 'string' ? d.presenterWorkType : null,
          projectDateDisplay: typeof d.projectDateDisplay === 'string' ? d.projectDateDisplay : null,
          projectDateIso: typeof d.projectDateIso === 'string' ? d.projectDateIso : (toIso(d.projectDate) || null),
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
        onDateIso: toIso(d.onDate) || null,
        paid: typeof d.paid === 'boolean' ? d.paid : null,
        paidTo: typeof d.paidTo === 'string' ? d.paidTo : null,
        paymentStatus: typeof d.paymentStatus === 'string' ? d.paymentStatus : null,
        presenterWorkType: typeof d.presenterWorkType === 'string' ? d.presenterWorkType : null,
        projectDateDisplay: typeof d.projectDateDisplay === 'string' ? d.projectDateDisplay : null,
        projectDateIso: typeof d.projectDateIso === 'string' ? d.projectDateIso : (toIso(d.projectDate) || null),
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
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ chatId, projectMessageIds: messageIds }, { merge: true })
  } catch {}
}

async function clearProjectBubbles(chatId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const snap = await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.projectMessageIds) ? data.projectMessageIds : []
    for (const id of ids) {
      try { await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }) }) } catch {}
    }
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ projectMessageIds: [] }, { merge: true })
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

// Track the year list (welcome + year menu) messages
async function saveYearMenu(chatId: number, welcomeMessageId?: number, yearMenuMessageId?: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    await fs
      .collection(TG_PAGES_COLLECTION)
      .doc(String(chatId))
      .set({ chatId, welcomeMessageId: welcomeMessageId || null, yearMenuMessageId: yearMenuMessageId || null }, { merge: true })
  } catch {}
}

async function clearYearMenu(chatId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const snap = await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = [data?.welcomeMessageId, data?.yearMenuMessageId].filter((v) => typeof v === 'number') as number[]
    for (const id of ids) {
      try {
        await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: id }),
        })
      } catch {}
    }
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ welcomeMessageId: null, yearMenuMessageId: null }, { merge: true })
  } catch {}
}

async function clearOtherProjectBubbles(chatId: number, keepMessageId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const ref = fs.collection(TG_PAGES_COLLECTION).doc(String(chatId))
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.projectMessageIds) ? data.projectMessageIds : []
    const toDelete = ids.filter((id: number) => id !== keepMessageId)
    for (const id of toDelete) {
      try {
        await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: id }),
        })
      } catch {}
    }
    await ref.set({ projectMessageIds: [keepMessageId] }, { merge: true })
  } catch {}
}

async function saveInvoiceBubbles(chatId: number, messageIds: number[]) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ chatId, invoiceMessageIds: messageIds }, { merge: true })
  } catch {}
}

async function clearInvoiceBubbles(chatId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const snap = await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.invoiceMessageIds) ? data.invoiceMessageIds : []
    for (const id of ids) {
      try { await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }) }) } catch {}
    }
    await fs.collection(TG_PAGES_COLLECTION).doc(String(chatId)).set({ invoiceMessageIds: [] }, { merge: true })
  } catch {}
}

// Clear invoice bubbles but keep one message (e.g., the current menu bubble)
async function clearInvoiceBubblesExcept(chatId: number, keepMessageId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const ref = fs.collection(TG_PAGES_COLLECTION).doc(String(chatId))
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.invoiceMessageIds) ? data.invoiceMessageIds : []
    for (const id of ids) {
      if (id === keepMessageId) continue
      try { await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }) }) } catch {}
    }
    const next = ids.includes(keepMessageId) ? [keepMessageId] : []
    await ref.set({ invoiceMessageIds: next }, { merge: true })
  } catch {}
}

// Track creation flow bot messages (for fresh-chat cleanup after confirm)
async function appendCreationBubble(chatId: number, messageId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const ref = fs.collection(TG_PAGES_COLLECTION).doc(String(chatId))
    const snap = await ref.get()
    const data = (snap.exists ? snap.data() : {}) as any
    const list = Array.isArray(data?.creationMessageIds) ? data.creationMessageIds : []
    const next = Array.from(new Set([...list, messageId]))
    await ref.set({ creationMessageIds: next }, { merge: true })
  } catch {}
}

async function clearCreationBubbles(chatId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const ref = fs.collection(TG_PAGES_COLLECTION).doc(String(chatId))
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.creationMessageIds) ? data.creationMessageIds : []
    for (const id of ids) {
      try {
        await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }),
        })
      } catch {}
    }
    await ref.set({ creationMessageIds: [] }, { merge: true })
  } catch {}
}

async function clearCreationBubblesExcept(chatId: number, keepMessageId: number) {
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const ref = fs.collection(TG_PAGES_COLLECTION).doc(String(chatId))
    const snap = await ref.get()
    if (!snap.exists) return
    const data = snap.data() as any
    const ids = Array.isArray(data?.creationMessageIds) ? data.creationMessageIds : []
    for (const id of ids) {
      if (id === keepMessageId) continue
      try {
        await fetch(`${TELEGRAM_API(process.env.TELEGRAM_BOT_TOKEN || '')}/deleteMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: id }),
        })
      } catch {}
    }
    await ref.set({ creationMessageIds: [keepMessageId] }, { merge: true })
  } catch {}
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
  // Heading with project number
  const pn = (p.projectNumber || p.id)
  parts.push(`<b><u>Project Detail - #${esc(pn)}</u></b>`)
  parts.push('')
  // Project Title label (italic) then combined line "<presenter/worktype> - <Project Title>"
  parts.push('<i>Project Title:</i>')
  const left = p.presenterWorkType ? esc(p.presenterWorkType) : ''
  const right = p.projectTitle ? esc(p.projectTitle) : ''
  const combo = [left, right].filter(Boolean).join(' - ')
  if (combo) parts.push(combo)
  // blank line
  parts.push('')
  // Billed to label (italic) then subsidiary: resolve to full name if recognized
  parts.push('<i>Billed to:</i>')
  const resolved = await adminResolveSubsidiaryName(p.subsidiary)
  parts.push(resolved ? esc(resolved) : (p.subsidiary ? esc(p.subsidiary) : '-'))
  return parts.join('\n')
}

// Summarize a project into two lines for the list view
function projectSummaryText(p: ProjectRecord): string {
  const safe = (s: string | null | undefined) => (typeof s === 'string' ? s : '')
  const head = safe(p.projectNumber) || safe(p.id)
  const line2Left = safe(p.presenterWorkType)
  const line2Right = safe(p.projectTitle)
  const line2 = [line2Left, line2Right].filter(Boolean).join(' - ')
  return [head, line2].filter(Boolean).join('\n')
}

async function buildInvoicesKeyboard(year: string, projectId: string) {
  try {
    const invoices: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
    if (!invoices || invoices.length === 0) {
      return { inline_keyboard: [[{ text: 'No invoices', callback_data: 'NOP' }]] }
    }
    const rows = invoices
      .slice()
      .sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : NaN
        const tb = b.createdAt ? Date.parse(b.createdAt) : NaN
        if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb
        if (!Number.isNaN(ta)) return -1
        if (!Number.isNaN(tb)) return 1
        return a.invoiceNumber.localeCompare(b.invoiceNumber)
      })
      .map((inv) => [
      { text: `#${inv.invoiceNumber}`, callback_data: `INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` },
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
// Abbreviate long bank names (>= 4 tokens, take initials of Capitalized tokens)
function abbreviateBankName(name: string): string {
  const tokens = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
  if (tokens.length >= 4) {
    const letters = tokens
      .filter((t) => /^[A-Z]/.test(t[0] || ''))
      .map((t) => (t[0] || '').toUpperCase())
      .join('')
    if (letters.length >= 2) return letters
  }
  return name
}

// Build suggested base invoice number from project number + pickup date
function buildBaseInvoiceNumberFromProject(p: ProjectRecord): string {
  const projectNumber = (p.projectNumber || p.id).trim()
  const iso = p.projectDateIso || p.onDateIso || null
  if (!iso) return projectNumber
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return projectNumber
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${projectNumber}-${month}${day}`
}

// Generate next project number like UI (year-aware, sequential)
function generateSequentialProjectNumber(year: string | null, existingNumbers: readonly string[]): string {
  const extractSequence = (text: string) => {
    const trimmed = (text || '').trim()
    const match = trimmed.match(/^(.*?)(\d+)$/)
    if (!match) return null
    const prefix = match[1] || ''
    const digits = match[2] || ''
    const value = Number(digits)
    if (Number.isNaN(value)) return null
    return { original: text, prefix, value, width: digits.length }
  }
  type Candidate = { original: string; prefix: string; value: number; width: number; matchesYear: boolean }
  const trimmedYear = (year || '').trim()
  const cleaned = existingNumbers.map((v) => (v || '').trim()).filter(Boolean)
  const parsed: Candidate[] = cleaned
    .map((v) => {
      const s = extractSequence(v)
      if (!s) return null
      return { ...s, matchesYear: trimmedYear.length > 0 && (v.startsWith(trimmedYear) || s.prefix.includes(trimmedYear)) }
    })
    .filter(Boolean) as Candidate[]
  const choose = (xs: Candidate[]) => (xs.length ? xs.reduce((a, b) => (b.value > a.value ? b : a)) : null)
  const preferred = trimmedYear ? choose(parsed.filter((c) => c.matchesYear)) : null
  const fallback = choose(parsed)
  const target = preferred || fallback
  if (target) {
    const nextValue = target.value + 1
    const padded = String(nextValue).padStart(target.width, '0')
    return `${target.prefix}${padded}`
  }
  const defaultPrefix = trimmedYear ? `${trimmedYear}-` : ''
  return `${defaultPrefix}${String(1).padStart(3, '0')}`
}

async function adminResolveBank(identifier: string | null | undefined): Promise<{ bankName?: string; bankCode?: string; accountType?: string } | null> {
  if (!identifier) return null
  try {
    const fs = getAdminFirestore(DIRECTORY_FIRESTORE_DATABASE_ID)
    const docRef = fs.collection('bankAccount').doc(String(identifier))
    const snap = await docRef.get()
    if (!snap.exists) return null
    const data = snap.data() as any
    const bankNameRaw = typeof data.bankName === 'string' ? data.bankName : undefined
    const bankName = bankNameRaw ? abbreviateBankName(bankNameRaw) : undefined
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

async function sendInvoiceDetailBubbles(token: string, chatId: number, controllerMessageId: number, year: string, projectId: string, invoiceNumber: string) {
  // Build sections and send as dedicated bubbles per spec
  const list: ProjectInvoiceRecord[] = await fetchInvoicesForProject(year, projectId)
  const inv = list.find((i) => i.invoiceNumber === decodeURIComponent(invoiceNumber))
  if (!inv) {
    await tgEditMessage(token, chatId, controllerMessageId, 'Invoice not found.')
    return
  }
  const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

  // 1) Controller message: Invoice number + actions (Edit, Back to Projects)
  const title = `<b>Invoice:</b> #${esc(inv.invoiceNumber)}`
  await tgEditMessage(token, chatId, controllerMessageId, title, {
    inline_keyboard: [
      [{ text: 'Edit', callback_data: `EDIT:INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` }],
      [{ text: '⬅ Back to Projects', callback_data: `BK:PROJ:${year}:${projectId}` }],
    ],
  })

  const sentIds: number[] = [controllerMessageId]
  // 2) Client detail heading (own bubble)
  const clientHead = await sendBubble(token, chatId, '<b><u>Client Detail</u></b>')
  if (clientHead?.message_id) sentIds.push(clientHead.message_id)
  // 3) Client detail content bubble
  const clientLines: string[] = []
  if (inv.companyName) {
    clientLines.push(`<b>${esc(inv.companyName)}</b>`) 
    if (inv.addressLine1) clientLines.push(esc(inv.addressLine1))
    if (inv.addressLine2) clientLines.push(esc(inv.addressLine2))
    if (inv.addressLine3 || inv.region) {
      const addr3 = inv.addressLine3 ? esc(inv.addressLine3) : ''
      const reg = inv.region ? esc(inv.region) : ''
      const mix = [addr3, reg].filter(Boolean).join(', ')
      if (mix) clientLines.push(mix)
    }
    // extra empty line before ATTN
    if (inv.representative) clientLines.push('')
    if (inv.representative) clientLines.push(`ATTN: <b><i>${esc(inv.representative)}</i></b>`)
  } else {
    clientLines.push('No client details')
  }
  const clientResp = await sendBubble(token, chatId, clientLines.join('\n'), { inline_keyboard: [[{ text: 'Edit', callback_data: `EC:INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` }]] })
  if (clientResp?.message_id) sentIds.push(clientResp.message_id)

  // 4) Invoice Detail heading bubble above first item
  let invDetailHead
  if (!inv.items || inv.items.length === 0) {
    // If no items, offer an Add Item action here
    invDetailHead = await sendBubble(token, chatId, '<b><u>Invoice Detail</u></b>', {
      inline_keyboard: [[{ text: 'Add Item', callback_data: `NEW:ITEM:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` }]],
    })
  } else {
    invDetailHead = await sendBubble(token, chatId, '<b><u>Invoice Detail</u></b>')
  }
  if (invDetailHead?.message_id) sentIds.push(invDetailHead.message_id)

  // 5) Items — one bubble per item
  if (inv.items && inv.items.length > 0) {
    for (let i = 0; i < inv.items.length; i += 1) {
      const it = inv.items[i]
      const unit = typeof it.unitPrice === 'number' ? formatMoney(it.unitPrice) : '-'
      const qty = typeof it.quantity === 'number' ? it.quantity : 0
      const unitSuffix = it.quantityUnit ? `/${esc(it.quantityUnit)}` : ''
      const lineTotal = typeof it.unitPrice === 'number' && typeof it.quantity === 'number' ? formatMoney(it.unitPrice * it.quantity) : '-'
      const parts: string[] = []
      parts.push(`<b><u>Item ${i + 1}:</u></b>`) 
      if (it.title) parts.push(`<b>${esc(it.title)}</b>${it.subQuantity ? ` x<i>${esc(it.subQuantity)}</i>` : ''}`)
      if (it.feeType) parts.push(`<i>${esc(it.feeType)}</i>`)
      if (it.notes) parts.push(esc(it.notes))
      parts.push('')
      parts.push(`<i>${unit} x ${qty}${unitSuffix}</i> = <b>${lineTotal}</b>`)
      const itemResp = await sendBubble(token, chatId, parts.join('\n'), { inline_keyboard: [[{ text: 'Edit', callback_data: `EI:INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}:${i}` }]] })
      if (itemResp?.message_id) sentIds.push(itemResp.message_id)
    }
  }

  // 5) Totals + To + Status — only when there are items
  if (inv.items && inv.items.length > 0) {
    const bank = await adminResolveBank(inv.paidTo || null)
    const bankLabel = bank && (bank.bankName || bank.bankCode || bank.accountType)
      ? `${bank.bankName ? esc(bank.bankName) : ''}${bank.bankCode ? ` (${esc(bank.bankCode)})` : ''}${bank.accountType ? ` - ${esc(bank.accountType)}` : ''}`
      : (inv.paidTo ? esc(inv.paidTo) : '')
    const totals: string[] = []
    totals.push(`<b>Total:</b> ${formatMoney(inv.amount)}`)
    if (bankLabel) totals.push(`<b>To:</b> ${bankLabel}`)
    if (inv.paymentStatus) totals.push(`<i>${esc(inv.paymentStatus)}</i>`)
    const totResp = await sendBubble(token, chatId, totals.join('\n'), { inline_keyboard: [[{ text: 'Edit', callback_data: `ET:INV:${year}:${projectId}:${encodeURIComponent(inv.invoiceNumber)}` }]] })
    if (totResp?.message_id) sentIds.push(totResp.message_id)
  }

  // No final back bubble — actions attached to controller
  await saveInvoiceBubbles(chatId, sentIds)
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
  kind: 'PROJ' | 'INV' | 'INV_CREATE' | 'PROJ_CREATE' | 'INV_ITEM_CREATE'
  year: string
  projectId: string
  invoiceNumber?: string
  field?: string
  itemIndex?: number
  controllerMessageId: number
  step: 'await_field' | 'await_value' | 'preview'
  proposedValue?: string
  // Creation drafts
  draft?: any
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
  invoiceNumber: 'Invoice Number',
  companyName: 'Client Company Name',
  paymentStatus: 'Payment Status',
  paidTo: 'Paid To (bank identifier)',
  representative: 'Representative',
  addressLine1: 'Address Line 1',
  addressLine2: 'Address Line 2',
  addressLine3: 'Address Line 3',
  region: 'Region',
}

const INVOICE_ITEM_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  subQuantity: 'Sub-Quantity',
  feeType: 'Fee Type',
  notes: 'Notes',
  unitPrice: 'Unit Price',
  quantity: 'Quantity',
  quantityUnit: 'Quantity Unit',
  discount: 'Discount',
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
  // Items editor entry
  rows.unshift([{ text: 'Items…', callback_data: `EPI:LIST:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }])
  rows.push([{ text: '⬅ Back', callback_data: `INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }])
  return { inline_keyboard: rows }
}

function buildInvoiceItemsListKeyboard(year: string, projectId: string, invoiceNumber: string, count: number) {
  const rows: any[] = []
  for (let i = 0; i < count; i += 1) {
    rows.push([{ text: `Item ${i + 1}`, callback_data: `EPI:SEL:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:${i}` }])
  }
  if (count === 0) {
    rows.push([{ text: 'No items', callback_data: 'NOP' }])
  }
  rows.push([{ text: '⬅ Back', callback_data: `EDIT:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }])
  return { inline_keyboard: rows }
}

function buildInvoiceItemFieldsKeyboard(year: string, projectId: string, invoiceNumber: string, idx: number) {
  const rows = Object.keys(INVOICE_ITEM_FIELD_LABELS).map((f) => [
    { text: `${INVOICE_ITEM_FIELD_LABELS[f]}`, callback_data: `EPI:FLD:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:${idx}:${f}` },
  ])
  rows.push([{ text: '⬅ Back', callback_data: `EPI:LIST:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }])
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
      // Clear any lingering project bubbles from previous navigation
      await clearProjectBubbles(chatId)
      // Split welcome into two messages and record their IDs so we can hide them later
      const m1 = await sendBubble(token, chatId, welcomeText())
      const m2 = await sendBubble(
        token,
        chatId,
        'To locate the project you\'re looking for, please select the year the project was picked up below:',
        buildYearsKeyboard(years),
      )
      await saveYearMenu(chatId, m1?.message_id, m2?.message_id)
      return res.status(200).end('ok')
    }
    // Handle pending edit/creation value input
    const pending = await readPendingEdit(chatId, userId)
    // Creation flows — Invoice
    if (pending && pending.kind === 'INV_CREATE' && pending.step === 'await_value') {
      const norm = (v: string) => {
        if (v === '-' || v.toLowerCase() === 'skip') return null
        return v
      }
      const draft = { ...(pending.draft || {}) }
      if (pending.field === 'invoiceNumber') {
        draft.invoiceNumber = String(text).replace(/^#/, '').trim()
        pending.field = 'companyName'
        pending.draft = draft
        await putPendingEdit(pending)
        const m1 = await sendBubble(token, chatId, 'Send Client Company Name (or "-" to skip):', { inline_keyboard: [[{ text: 'Cancel', callback_data: `P:${pending.year}:${pending.projectId}` }]] })
        if (m1?.message_id) { pending.controllerMessageId = m1.message_id; await putPendingEdit(pending) }
        return res.status(200).end('ok')
      }
      if (pending.field === 'companyName') { draft.companyName = norm(text) }
      if (pending.field === 'addressLine1') { draft.addressLine1 = norm(text) }
      if (pending.field === 'addressLine2') { draft.addressLine2 = norm(text) }
      if (pending.field === 'addressLine3') { draft.addressLine3 = norm(text) }
      if (pending.field === 'region') { draft.region = norm(text) }
      if (pending.field === 'representative') { draft.representative = norm(text) }

      const order = ['invoiceNumber','companyName','addressLine1','addressLine2','addressLine3','region','repTitle','representative']
      const idx = order.indexOf(pending.field || '')
      const nextField = idx >= 0 && idx + 1 < order.length ? order[idx + 1] : null
      if (nextField) {
        pending.draft = draft
        if (nextField === 'repTitle') {
          pending.field = 'repTitle'
          await putPendingEdit(pending)
          const titleKb = { inline_keyboard: [[
            { text: 'Mr.', callback_data: `NIC:TITLE:${pending.year}:${pending.projectId}:Mr.` },
            { text: 'Mrs.', callback_data: `NIC:TITLE:${pending.year}:${pending.projectId}:Mrs.` },
            { text: 'Ms.', callback_data: `NIC:TITLE:${pending.year}:${pending.projectId}:Ms.` },
            { text: 'Skip', callback_data: `NIC:TITLE:${pending.year}:${pending.projectId}:_` },
          ]] }
          const mT = await sendBubble(token, chatId, 'Select Representative Title:', titleKb)
          if (mT?.message_id) { pending.controllerMessageId = mT.message_id; await putPendingEdit(pending) }
          return res.status(200).end('ok')
        } else {
          pending.field = nextField
          await putPendingEdit(pending)
          const labels: any = {
            companyName: 'Client Company Name',
            addressLine1: 'Address Line 1',
            addressLine2: 'Address Line 2',
            addressLine3: 'Address Line 3',
            region: 'Region',
            representative: 'Representative',
          }
          const m2 = await sendBubble(token, chatId, `Send ${labels[nextField]} (or "-" to skip):`, { inline_keyboard: [[{ text: 'Cancel', callback_data: `P:${pending.year}:${pending.projectId}` }]] })
          if (m2?.message_id) { pending.controllerMessageId = m2.message_id; await putPendingEdit(pending) }
          return res.status(200).end('ok')
        }
      }

      // Preview before create
      pending.step = 'preview'
      pending.draft = draft
      await putPendingEdit(pending)
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const lines = [
        '<b>Create Invoice</b>',
        '',
        `<b>Invoice:</b> #${esc(draft.invoiceNumber || '')}`,
      ]
      if (draft.companyName) {
        lines.push('', `<b>${esc(draft.companyName)}</b>`)
        if (draft.addressLine1) lines.push(esc(draft.addressLine1))
        if (draft.addressLine2) lines.push(esc(draft.addressLine2))
        if (draft.addressLine3 || draft.region) {
          const mix = [draft.addressLine3 ? esc(draft.addressLine3) : '', draft.region ? esc(draft.region) : ''].filter(Boolean).join(', ')
          if (mix) lines.push(mix)
        }
        if (draft.representative) lines.push(`ATTN: <b><i>${esc((draft.repTitle ? draft.repTitle + ' ' : '') + draft.representative)}</i></b>`)
      }
      const kb = { inline_keyboard: [[{ text: 'Confirm Create', callback_data: `NIC:CONFIRM:${pending.year}:${pending.projectId}` }], [{ text: 'Revise', callback_data: `NEW:INV:${pending.year}:${pending.projectId}` }], [{ text: 'Cancel', callback_data: `P:${pending.year}:${pending.projectId}` }]] }
      const m3 = await sendBubble(token, chatId, lines.join('\n'), kb)
      if (m3?.message_id) { pending.controllerMessageId = m3.message_id; await putPendingEdit(pending) }
      return res.status(200).end('ok')
    }
    // Creation flows — Invoice Item (when no items yet, or adding first one)
    if (pending && pending.kind === 'INV_ITEM_CREATE' && pending.step === 'await_value') {
      const draft = { ...(pending.draft || {}) }
      const norm = (v: string) => (v === '-' || v.toLowerCase() === 'skip') ? null : v
      // Apply current field
      switch (pending.field) {
        case 'title': draft.title = String(msg.text || '').trim(); break
        case 'subQuantity': draft.subQuantity = norm(msg.text || ''); break
        case 'feeType': draft.feeType = norm(msg.text || ''); break
        case 'notes': draft.notes = norm(msg.text || ''); break
        case 'unitPrice': {
          const n = Number(String(msg.text || '').trim())
          draft.unitPrice = Number.isFinite(n) ? n : 0
          break
        }
        case 'quantity': {
          const n = Number(String(msg.text || '').trim())
          draft.quantity = Number.isFinite(n) ? n : 0
          break
        }
        case 'quantityUnit': draft.quantityUnit = norm(msg.text || ''); break
        case 'discount': {
          const raw = String(msg.text || '').trim()
          if (raw === '-' || raw.toLowerCase() === 'skip' || raw === '') {
            draft.discount = 0
          } else {
            const n = Number(raw)
            draft.discount = Number.isFinite(n) ? n : 0
          }
          break
        }
      }
      // Next field order
      const order = ['title','subQuantity','feeType','notes','unitPrice','quantity','quantityUnit','discount']
      const idx = order.indexOf(pending.field || '')
      const nextField = idx >= 0 && idx + 1 < order.length ? order[idx + 1] : null
      if (nextField) {
        pending.field = nextField
        pending.draft = draft
        await putPendingEdit(pending)
        const labels: any = {
          title: 'Item Title',
          subQuantity: 'Item Sub-Quantity (optional)',
          feeType: 'Item Fee Type (optional)',
          notes: 'Item Notes (optional)',
          unitPrice: 'Unit Price (number)',
          quantity: 'Quantity (number)',
          quantityUnit: 'Quantity Unit (optional)',
          discount: 'Discount (number, optional)',
        }
        const m = await sendBubble(token, pending.chatId, `Send ${labels[nextField]}:`, { inline_keyboard: [[{ text: 'Cancel', callback_data: `INV:${pending.year}:${pending.projectId}:${pending.invoiceNumber}` }]] })
        if (m?.message_id) { pending.controllerMessageId = m.message_id; await putPendingEdit(pending); await appendCreationBubble(pending.chatId, m.message_id) }
        return res.status(200).end('ok')
      }
      // Preview new item
      pending.step = 'preview'
      pending.draft = draft
      await putPendingEdit(pending)
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const unit = typeof draft.unitPrice === 'number' ? formatMoney(draft.unitPrice) : '-'
      const qty = typeof draft.quantity === 'number' ? draft.quantity : 0
      const unitSuffix = draft.quantityUnit ? `/${esc(draft.quantityUnit)}` : ''
      const lineTotal = (typeof draft.unitPrice === 'number' && typeof draft.quantity === 'number') ? formatMoney(draft.unitPrice * draft.quantity) : '-'
      const lines: string[] = []
      lines.push('<b>Create Item</b>','<b><u>Item 1:</u></b>')
      if (draft.title) lines.push(`<b>${esc(draft.title)}</b>${draft.subQuantity ? ` x<i>${esc(draft.subQuantity)}</i>` : ''}`)
      if (draft.feeType) lines.push(`<i>${esc(draft.feeType)}</i>`)
      if (draft.notes) lines.push(esc(draft.notes))
      lines.push('')
      lines.push(`<i>${unit} x ${qty}${unitSuffix}</i> = <b>${lineTotal}</b>`)
      const kb = { inline_keyboard: [
        [{ text: 'Confirm Create', callback_data: `NIT:CONFIRM:${pending.year}:${pending.projectId}:${pending.invoiceNumber}` }],
        [{ text: 'Revise', callback_data: `NEW:ITEM:${pending.year}:${pending.projectId}:${pending.invoiceNumber}` }],
        [{ text: 'Cancel', callback_data: `INV:${pending.year}:${pending.projectId}:${pending.invoiceNumber}` }],
      ] }
      const m = await sendBubble(token, pending.chatId, lines.join('\n'), kb)
      if (m?.message_id) { pending.controllerMessageId = m.message_id; await putPendingEdit(pending); await appendCreationBubble(pending.chatId, m.message_id) }
      return res.status(200).end('ok')
    }
    // Creation flows — Project
    if (pending && pending.kind === 'PROJ_CREATE' && pending.step === 'await_value') {
      const norm = (v: string) => (v === '-' || v.toLowerCase() === 'skip') ? null : v
      const draft = { ...(pending.draft || {}) }
      if (pending.field === 'projectNumber') {
        draft.projectNumber = String(text).replace(/^#/, '').trim()
        pending.field = 'projectTitle'
        pending.draft = draft
        await putPendingEdit(pending)
        const m0 = await sendBubble(token, chatId, 'Send Project Title:', { inline_keyboard: [[{ text: 'Cancel', callback_data: `BK:YEARS` }]] })
        if (m0?.message_id) { pending.controllerMessageId = m0.message_id; await putPendingEdit(pending); await appendCreationBubble(chatId, m0.message_id) }
        return res.status(200).end('ok')
      }
      if (pending.field === 'projectTitle') { draft.projectTitle = norm(text) }
      if (pending.field === 'presenterWorkType') { draft.presenterWorkType = norm(text) }
      if (pending.field === 'projectNature') { draft.projectNature = norm(text) }
      if (pending.field === 'projectDate') {
        const t = (text || '').trim()
        if (t && t !== '-' && t.toLowerCase() !== 'skip') {
          const d = new Date(t)
          draft.projectDate = Number.isNaN(d.getTime()) ? null : d.toISOString()
        } else {
          draft.projectDate = null
        }
      }
      if (pending.field === 'subsidiary') { draft.subsidiary = norm(text) }
      // Next field order
      const order = ['projectNumber','projectTitle','presenterWorkType','projectNature','projectDate','subsidiary']
      const idx = order.indexOf(pending.field || '')
      const nextField = idx >= 0 && idx + 1 < order.length ? order[idx + 1] : null
      if (nextField) {
        pending.field = nextField
        pending.draft = draft
        await putPendingEdit(pending)
        const labels: any = {
          projectTitle: 'Project Title',
          presenterWorkType: 'Presenter / Worktype',
          projectNature: 'Project Nature',
          projectDate: 'Project Pickup Date (YYYY-MM-DD)',
          subsidiary: 'Subsidiary',
        }
        const m1 = await sendBubble(token, chatId, `Send ${labels[nextField]} (or "-" to skip):`, { inline_keyboard: [[{ text: 'Cancel', callback_data: `BK:YEARS` }]] })
        if (m1?.message_id) { pending.controllerMessageId = m1.message_id; await putPendingEdit(pending); await appendCreationBubble(chatId, m1.message_id) }
        return res.status(200).end('ok')
      }
      // Preview create project
      pending.step = 'preview'
      pending.draft = draft
      await putPendingEdit(pending)
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      // Resolve subsidiary identifier to English name for preview if possible
      let subPreview = draft.subsidiary || null
      try { const resolved = await adminResolveSubsidiaryName(draft.subsidiary); if (resolved) subPreview = resolved } catch {}
      const lines = ['<b>Create Project</b>', '', `#${esc(draft.projectNumber || '')}`, draft.presenterWorkType ? esc(draft.presenterWorkType) : '', draft.projectTitle ? `<b>${esc(draft.projectTitle)}</b>` : '', draft.projectNature ? `<i>${esc(draft.projectNature)}</i>` : '', '', subPreview ? esc(subPreview) : ''].filter(Boolean)
      const kb = { inline_keyboard: [[{ text: 'Confirm Create', callback_data: `NPC:CONFIRM:${pending.year}` }], [{ text: 'Revise', callback_data: `NEW:PROJ:${pending.year}` }], [{ text: 'Cancel', callback_data: `BK:YEARS` }]] }
      const m2 = await sendBubble(token, chatId, lines.join('\n'), kb)
      if (m2?.message_id) { pending.controllerMessageId = m2.message_id; await putPendingEdit(pending); await appendCreationBubble(chatId, m2.message_id) }
      return res.status(200).end('ok')
    }
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
        // Hide the year list (and welcome) when a year is selected
        await clearYearMenu(chatId)
        // Also delete the year menu controller message to avoid lingering prompts
        try { await tgDeleteMessage(token, chatId, msgId) } catch {}
        const { projects } = await adminFetchAllProjectsForYear(year)
        // Send heading + one message per project with [Select] [Edit]
        const sentIds: number[] = [] // collected but not persisted (no deletion model)
        const head = await sendBubble(token, chatId, `Projects of ${year} ⬇️`, {
          inline_keyboard: [
            [{ text: '➕ Add New Project', callback_data: `NEW:PROJ:${year}` }],
            [{ text: '⬅ Back to Years', callback_data: 'BK:YEARS' }],
          ],
        })
        if (head?.message_id) sentIds.push(head.message_id)
        for (const p of projects) {
          const text = projectSummaryText(p)
          const resp = await sendBubble(token, chatId, text, {
            inline_keyboard: [[
              { text: 'Select', callback_data: `P:${year}:${p.id}` },
              { text: 'Edit', callback_data: `EDIT:PROJ:${year}:${p.id}` }
            ]]
          })
          if (resp?.message_id) sentIds.push(resp.message_id)
        }
        // Add a tail marker with the same actions for convenience
        const tail = await sendBubble(token, chatId, `Projects of ${year} ⬆️`, {
          inline_keyboard: [
            [{ text: '➕ Add New Project', callback_data: `NEW:PROJ:${year}` }],
            [{ text: '⬅ Back to Years', callback_data: 'BK:YEARS' }],
          ],
        })
        if (tail?.message_id) sentIds.push(tail.message_id)
        // Track these so we can clear on back to years
        await saveProjectBubbles(chatId, sentIds)
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, `Sorry, failed to load projects for ${year}.`)
      }
      return res.status(200).end('ok')
    }
    // Remove legacy pagination path (PG) — not used in bubbles view
    if (data.startsWith('P:')) {
      const [, year, projectId] = data.split(':')
      try {
        // Remove other project bubbles, keep only this message
        await clearOtherProjectBubbles(chatId, msgId)
        await clearInvoiceBubbles(chatId)
        const text = await buildProjectDetailsText(year, projectId)
        const invKb = await buildInvoicesKeyboard(year, projectId)
        const rows = (invKb.inline_keyboard as any[])
        // Put Create New Invoice at the bottom after invoices
        rows.push([{ text: '➕ Create New Invoice', callback_data: `NEW:INV:${year}:${projectId}` }])
        rows.push([{ text: '✍️ Edit Project Detail', callback_data: `EDIT:PROJ:${year}:${projectId}` }])
        rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:${projectId}` }])
        await tgEditMessage(token, chatId, msgId, text, { inline_keyboard: rows })
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load that project. Please try again.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('INV:')) {
      const [, year, projectId, encInvoice] = data.split(':')
      try {
        // If we were in a creation flow, clean those messages too
        await clearCreationBubbles(chatId)
        // Clear previous invoice bubbles for a clean display, but keep current message so we can edit it into the controller
        await clearInvoiceBubblesExcept(chatId, msgId)
        await sendInvoiceDetailBubbles(token, chatId, msgId, year, projectId, encInvoice)
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, 'Sorry, failed to load invoice.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NIC:CONFIRM:')) {
      const [, , year, projectId] = data.split(':')
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (!edit || edit.kind !== 'INV_CREATE' || !edit.draft || !edit.draft.invoiceNumber) {
        await tgAnswerCallback(token, cqid, 'Nothing to create')
        return res.status(200).end('ok')
      }
      const baseInvoiceNumber = String(edit.draft.invoiceNumber).replace(/^#/, '')
      const client = {
        companyName: edit.draft.companyName ?? null,
        addressLine1: edit.draft.addressLine1 ?? null,
        addressLine2: edit.draft.addressLine2 ?? null,
        addressLine3: edit.draft.addressLine3 ?? null,
        region: edit.draft.region ?? null,
        representative: edit.draft.representative ?? null,
      }
      try {
        const created = await createInvoiceForProject({ year, projectId, baseInvoiceNumber, client, items: [], taxOrDiscountPercent: null, paymentStatus: null, paidTo: null, paidOn: null, editedBy: `tg:${userId}` })
        await clearPendingEdit(chatId, userId)
        // Show the newly created invoice details
        await clearInvoiceBubblesExcept(chatId, msgId)
        await sendInvoiceDetailBubbles(token, chatId, msgId, year, projectId, encodeURIComponent(created.invoiceNumber))
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, e?.message || 'Failed to create invoice.')
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NPC:CONFIRM:')) {
      const [, , year] = data.split(':')
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (!edit || edit.kind !== 'PROJ_CREATE' || !edit.draft || !edit.draft.projectNumber) {
        await tgAnswerCallback(token, cqid, 'Nothing to create')
        return res.status(200).end('ok')
      }
      const payload: any = {
        projectNumber: String(edit.draft.projectNumber).replace(/^#/, '').trim(),
        projectTitle: edit.draft.projectTitle ?? null,
        presenterWorkType: edit.draft.presenterWorkType ?? null,
        projectNature: edit.draft.projectNature ?? null,
        projectDate: edit.draft.projectDate ?? null,
        subsidiary: edit.draft.subsidiary ?? null,
        paymentStatus: 'Due',
      }
      try {
        const keepMsgId = edit.controllerMessageId
        const result = await createProjectInDatabase({ year, data: payload, createdBy: `tg:${userId}` })
        await clearPendingEdit(chatId, userId)
        // Transform confirmation preview into the next page
        await clearCreationBubblesExcept(chatId, keepMsgId)
        await clearProjectBubbles(chatId)
        await clearInvoiceBubbles(chatId)
        const p = result.project
        const detail = await buildProjectDetailsText(year, p.id)
        const invKb = await buildInvoicesKeyboard(year, p.id)
        const rows = (invKb.inline_keyboard as any[])
        rows.push([{ text: '➕ Create New Invoice', callback_data: `NEW:INV:${year}:${p.id}` }])
        rows.push([{ text: '✍️ Edit Project Detail', callback_data: `EDIT:PROJ:${year}:${p.id}` }])
        rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${year}:${p.id}` }])
        await tgEditMessage(token, chatId, keepMsgId, detail, { inline_keyboard: rows })
        await saveProjectBubbles(chatId, [keepMsgId])
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, e?.message || 'Failed to create project.')
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
    // Section-scoped edit triggers from invoice detail bubbles
    if (data.startsWith('EC:INV:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      const invoiceNumber = decodeURIComponent(encInvoice)
      const kb = { inline_keyboard: [
        [{ text: INVOICE_FIELD_LABELS.companyName, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:companyName` }],
        [{ text: INVOICE_FIELD_LABELS.addressLine1, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:addressLine1` }],
        [{ text: INVOICE_FIELD_LABELS.addressLine2, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:addressLine2` }],
        [{ text: INVOICE_FIELD_LABELS.addressLine3, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:addressLine3` }],
        [{ text: INVOICE_FIELD_LABELS.region, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:region` }],
        [{ text: 'Representative Title', callback_data: `NIC:TITLE:${year}:${projectId}:_` }],
        [{ text: INVOICE_FIELD_LABELS.representative, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:representative` }],
        [{ text: '⬅ Back', callback_data: `INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }],
      ] }
      await tgEditMessage(token, chatId, msgId, 'Select a client field to edit:', kb)
      return res.status(200).end('ok')
    }
    if (data.startsWith('EI:INV:')) {
      const parts = data.split(':')
      const year = parts[2]; const projectId = parts[3]; const encInvoice = parts[4]; const idx = parseInt(parts[5] || '0', 10) || 0
      await tgEditMessage(token, chatId, msgId, `Edit fields for Item ${idx + 1}:`, buildInvoiceItemFieldsKeyboard(year, projectId, decodeURIComponent(encInvoice), idx))
      return res.status(200).end('ok')
    }
    if (data.startsWith('ET:INV:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      const invoiceNumber = decodeURIComponent(encInvoice)
      const kb = { inline_keyboard: [
        [{ text: INVOICE_FIELD_LABELS.paymentStatus, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:paymentStatus` }],
        [{ text: INVOICE_FIELD_LABELS.paidTo, callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}:paidTo` }],
        [{ text: '⬅ Back', callback_data: `INV:${year}:${projectId}:${encodeURIComponent(invoiceNumber)}` }],
      ] }
      await tgEditMessage(token, chatId, msgId, 'Select a totals field to edit:', kb)
      return res.status(200).end('ok')
    }
    // Create New Invoice — start
    if (data.startsWith('NEW:INV:')) {
      const [, , year, projectId] = data.split(':')
      const projects = await adminFetchProjectsForYear(year)
      const p = projects.find((x) => x.id === projectId)
      if (!p) {
        await tgEditMessage(token, chatId, msgId, 'Project not found.')
        return res.status(200).end('ok')
      }
      const suggested = buildBaseInvoiceNumberFromProject(p)
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'INV_CREATE', year, projectId, controllerMessageId: msgId, step: 'await_value', field: 'invoiceNumber', draft: { baseInvoiceNumber: suggested } })
      const m = await sendBubble(token, chatId, `Suggested invoice number:\n<b>#${suggested}</b>\n\nUse this or enter a different number.`, { inline_keyboard: [[{ text: 'Use suggested', callback_data: `NIC:NUMOK:${year}:${projectId}:${encodeURIComponent(suggested)}` }], [{ text: 'Cancel', callback_data: `P:${year}:${projectId}` }]] })
      if (m?.message_id) {
        const edit = await readPendingEdit(chatId, cq.from?.id as number)
        if (edit) { edit.controllerMessageId = m.message_id; await putPendingEdit(edit) }
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NIC:NUMOK:')) {
      const [, , year, projectId, encNum] = data.split(':')
      const invoiceNumber = decodeURIComponent(encNum)
      // Proceed to ask client company
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'INV_CREATE', year, projectId, controllerMessageId: msgId, step: 'await_value', field: 'companyName', draft: { invoiceNumber } })
      const m = await sendBubble(token, chatId, 'Send Client Company Name (or type "-" to skip/use project default):', { inline_keyboard: [[{ text: 'Cancel', callback_data: `P:${year}:${projectId}` }]] })
      if (m?.message_id) {
        const edit = await readPendingEdit(chatId, cq.from?.id as number)
        if (edit) { edit.controllerMessageId = m.message_id; await putPendingEdit(edit) }
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NIC:TITLE:')) {
      const parts = data.split(':')
      const year = parts[2]; const projectId = parts[3]; const val = decodeURIComponent(parts[4])
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (edit && edit.kind === 'INV_CREATE') {
        const draft = { ...(edit.draft || {}) }
        draft.repTitle = (val === '_' ? null : val)
        edit.draft = draft
        edit.field = 'representative'
        edit.step = 'await_value'
        await putPendingEdit(edit)
        await tgEditMessage(token, chatId, edit.controllerMessageId, 'Send Representative Name:', { inline_keyboard: [[{ text: 'Cancel', callback_data: `P:${year}:${projectId}` }]] })
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NIC:REVISE:')) {
      const [, , year, projectId] = data.split(':')
      const menu = { inline_keyboard: [
        [{ text: 'Invoice Number', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:invoiceNumber` }],
        [{ text: 'Client Company', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:companyName` }],
        [{ text: 'Address Line 1', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:addressLine1` }],
        [{ text: 'Address Line 2', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:addressLine2` }],
        [{ text: 'Address Line 3', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:addressLine3` }],
        [{ text: 'Region', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:region` }],
        [{ text: 'Representative Title', callback_data: `NIC:TITLE:${year}:${projectId}:_` }],
        [{ text: 'Representative Name', callback_data: `EPF:INV:${year}:${projectId}:${encodeURIComponent('')}:representative` }],
      ] }
      await tgEditMessage(token, chatId, msgId, 'Select a field to revise:', menu)
      return res.status(200).end('ok')
    }
    if (data.startsWith('NPC:REVISE:')) {
      const [, , year] = data.split(':')
      const menu = { inline_keyboard: [
        [{ text: 'Project Number', callback_data: `EPF:PROJ:${year}:_:projectNumber` }],
        [{ text: 'Project Title', callback_data: `EPF:PROJ:${year}:_:projectTitle` }],
        [{ text: 'Presenter / Worktype', callback_data: `EPF:PROJ:${year}:_:presenterWorkType` }],
        [{ text: 'Project Nature', callback_data: `EPF:PROJ:${year}:_:projectNature` }],
        [{ text: 'Project Pickup Date', callback_data: `EPF:PROJ:${year}:_:projectDate` }],
        [{ text: 'Subsidiary', callback_data: `EPF:PROJ:${year}:_:subsidiary` }],
      ] }
      await tgEditMessage(token, chatId, msgId, 'Select a field to revise:', menu)
      return res.status(200).end('ok')
    }
    // Create New Item — start
    if (data.startsWith('NEW:ITEM:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      // Fresh page as this leads to user input
      await clearInvoiceBubbles(chatId)
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'INV_ITEM_CREATE', year, projectId, invoiceNumber: encInvoice, controllerMessageId: msgId, step: 'await_value', field: 'title', draft: {} })
      const m = await sendBubble(token, chatId, 'Send Item Title:', { inline_keyboard: [[{ text: 'Cancel', callback_data: `INV:${year}:${projectId}:${encInvoice}` }]] })
      if (m?.message_id) {
        const edit = await readPendingEdit(chatId, cq.from?.id as number)
        if (edit) { edit.controllerMessageId = m.message_id; await putPendingEdit(edit); await appendCreationBubble(chatId, m.message_id) }
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NIT:CONFIRM:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      const userId = cq.from?.id as number
      const edit = await readPendingEdit(chatId, userId)
      if (!edit || edit.kind !== 'INV_ITEM_CREATE' || !edit.draft) {
        await tgAnswerCallback(token, cqid, 'Nothing to add')
        return res.status(200).end('ok')
      }
      try {
        const invNum = decodeURIComponent(encInvoice)
        const invoices = await fetchInvoicesForProject(year, projectId)
        const current = invoices.find((i) => i.invoiceNumber === invNum)
        if (!current) throw new Error('Invoice not found')
        const items = (current.items || []).map((it) => ({
          title: it.title || '', feeType: it.feeType || '', unitPrice: Number(it.unitPrice || 0), quantity: Number(it.quantity || 0), discount: Number(it.discount || 0), subQuantity: it.subQuantity || '', notes: it.notes || '', quantityUnit: it.quantityUnit || '',
        }))
        // Append new item
        const d: any = edit.draft || {}
        items.push({
          title: d.title || '', feeType: d.feeType || '', unitPrice: Number(d.unitPrice || 0), quantity: Number(d.quantity || 0), discount: Number(d.discount || 0), subQuantity: d.subQuantity || '', notes: d.notes || '', quantityUnit: d.quantityUnit || '',
        })
        const client = {
          companyName: current.companyName || null,
          addressLine1: current.addressLine1 || null,
          addressLine2: current.addressLine2 || null,
          addressLine3: current.addressLine3 || null,
          region: current.region || null,
          representative: current.representative || null,
        }
        await updateInvoiceForProject({
          year, projectId, collectionId: 'invoice', invoiceNumber: invNum, baseInvoiceNumber: extractBaseFromInvoice(invNum), editedBy: `tg:${userId}`,
          items, client, taxOrDiscountPercent: current.taxOrDiscountPercent ?? null, paymentStatus: current.paymentStatus ?? null, paidTo: current.paidTo ?? null, paidOn: current.paidOnIso ?? null, onDate: current.paidOnIso ?? null,
        })
        // Transform preview into controller
        const keepMsgId = edit.controllerMessageId
        await clearPendingEdit(chatId, userId)
        await clearCreationBubblesExcept(chatId, keepMsgId)
        await clearInvoiceBubblesExcept(chatId, keepMsgId)
        await sendInvoiceDetailBubbles(token, chatId, keepMsgId, year, projectId, encInvoice)
      } catch (e: any) {
        await tgEditMessage(token, chatId, msgId, e?.message || 'Failed to add item.')
      }
      return res.status(200).end('ok')
    }
    // Create New Project — start
    if (data.startsWith('NEW:PROJ:')) {
      const [, , year] = data.split(':')
      // Clear current project listing bubbles for a clean creation flow
      await clearProjectBubbles(chatId)
      const { projects } = await adminFetchAllProjectsForYear(year)
      const existing = projects.map((p) => p.projectNumber).filter(Boolean)
      const suggested = generateSequentialProjectNumber(year, existing)
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'PROJ_CREATE', year, projectId: '', controllerMessageId: msgId, step: 'await_value', field: 'projectNumber', draft: { projectNumber: suggested } })
      const m = await sendBubble(token, chatId, `Suggested project number:\n<b>#${suggested}</b>\n\nUse this or enter a different number.`, { inline_keyboard: [[{ text: 'Use suggested', callback_data: `NPC:NUMOK:${year}:${encodeURIComponent(suggested)}` }], [{ text: 'Cancel', callback_data: `BK:YEARS` }]] })
      if (m?.message_id) {
        const edit = await readPendingEdit(chatId, cq.from?.id as number)
        if (edit) { edit.controllerMessageId = m.message_id; await putPendingEdit(edit) }
        await appendCreationBubble(chatId, m.message_id)
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('NPC:NUMOK:')) {
      const [, , year, encSuggested] = data.split(':')
      const projectNumber = decodeURIComponent(encSuggested)
      // Move to projectTitle prompt using a new message
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'PROJ_CREATE', year, projectId: '', controllerMessageId: msgId, step: 'await_value', field: 'projectTitle', draft: { projectNumber } })
      const m = await sendBubble(token, chatId, 'Send Project Title:', { inline_keyboard: [[{ text: 'Cancel', callback_data: `BK:YEARS` }]] })
      if (m?.message_id) {
        const edit = await readPendingEdit(chatId, cq.from?.id as number)
        if (edit) { edit.controllerMessageId = m.message_id; await putPendingEdit(edit) }
        await appendCreationBubble(chatId, m.message_id)
      }
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPI:LIST:')) {
      const [, , year, projectId, encInvoice] = data.split(':')
      const invs = await fetchInvoicesForProject(year, projectId)
      const inv = invs.find(i => i.invoiceNumber === decodeURIComponent(encInvoice))
      const count = inv?.items?.length || 0
      await tgEditMessage(token, chatId, msgId, 'Select an item to edit:', buildInvoiceItemsListKeyboard(year, projectId, decodeURIComponent(encInvoice), count))
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPI:SEL:')) {
      const parts = data.split(':')
      const year = parts[2]; const projectId = parts[3]; const encInvoice = parts[4]; const idx = parseInt(parts[5] || '0', 10) || 0
      await tgEditMessage(token, chatId, msgId, `Edit fields for Item ${idx + 1}:`, buildInvoiceItemFieldsKeyboard(year, projectId, decodeURIComponent(encInvoice), idx))
      return res.status(200).end('ok')
    }
    if (data.startsWith('EPI:FLD:')) {
      const parts = data.split(':')
      const year = parts[2]; const projectId = parts[3]; const encInvoice = parts[4]; const idx = parseInt(parts[5] || '0', 10) || 0; const field = parts[6]
      await putPendingEdit({ chatId, userId: cq.from?.id as number, kind: 'INV', year, projectId, invoiceNumber: encInvoice, controllerMessageId: msgId, step: 'await_value', field, itemIndex: idx })
      await tgEditMessage(token, chatId, msgId, `Send new value for <b>Item ${idx + 1} ${INVOICE_ITEM_FIELD_LABELS[field] || field}</b>`, { inline_keyboard: [[{ text: '⬅ Cancel', callback_data: `INV:${year}:${projectId}:${encInvoice}` }]] })
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
      if (!edit || edit.step !== 'preview' || !edit.field || (!edit.proposedValue && edit.proposedValue !== '')) {
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
          rows.push([{ text: '✍️ Edit Project Detail', callback_data: `EDIT:PROJ:${edit.year}:${edit.projectId}` }])
          rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${edit.year}:${edit.projectId}` }])
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
          if (f === 'invoiceNumber') {
            const newNumber = String(edit.proposedValue).replace(/^#/, '')
            const renamed = await renameInvoiceForProject({ year: edit.year, projectId: edit.projectId, fromInvoiceNumber: invNum, toInvoiceNumber: newNumber, editedBy: `tg:${userId}` })
            const text = await buildInvoiceDetailsText(edit.year, edit.projectId, encodeURIComponent(renamed.invoiceNumber))
            const rows = [
              [{ text: 'Edit', callback_data: `EDIT:INV:${edit.year}:${edit.projectId}:${encodeURIComponent(renamed.invoiceNumber)}` }],
              [{ text: '⬅ Back to Projects', callback_data: `BK:PROJ:${edit.year}:${edit.projectId}` }],
            ]
            await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
            await clearPendingEdit(chatId, userId)
            return res.status(200).end('ok')
          }
          if (f && f in INVOICE_FIELD_LABELS) {
            if (f === 'representative') (client as any).representative = edit.proposedValue
            else if (f.startsWith('addressLine')) (client as any)[f] = edit.proposedValue
            else if (f === 'region') (client as any).region = edit.proposedValue
            else if (f === 'companyName') (client as any).companyName = edit.proposedValue
            else if (f === 'paymentStatus') (current as any).paymentStatus = edit.proposedValue
            else if (f === 'paidTo') (current as any).paidTo = edit.proposedValue
          }
          // Item-level edits
          if (edit.itemIndex !== undefined && edit.itemIndex !== null && edit.itemIndex >= 0 && edit.itemIndex < items.length) {
            const idx = edit.itemIndex as number
            if (edit.field === 'unitPrice') items[idx].unitPrice = Number(edit.proposedValue || 0)
            else if (edit.field === 'quantity') items[idx].quantity = Number(edit.proposedValue || 0)
            else if (edit.field === 'discount') items[idx].discount = Number(edit.proposedValue || 0)
            else if (edit.field === 'title') items[idx].title = String(edit.proposedValue || '')
            else if (edit.field === 'feeType') items[idx].feeType = String(edit.proposedValue || '')
            else if (edit.field === 'subQuantity') items[idx].subQuantity = String(edit.proposedValue || '')
            else if (edit.field === 'notes') items[idx].notes = String(edit.proposedValue || '')
            else if (edit.field === 'quantityUnit') items[idx].quantityUnit = String(edit.proposedValue || '')
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
          await clearInvoiceBubblesExcept(chatId, edit.controllerMessageId)
          await sendInvoiceDetailBubbles(token, chatId, edit.controllerMessageId, edit.year, edit.projectId, encodeURIComponent(invNum))
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
          rows.push([{ text: '✍️ Edit Project Detail', callback_data: `EDIT:PROJ:${edit.year}:${edit.projectId}` }])
          rows.push([{ text: '⬅ Back', callback_data: `BK:PROJ:${edit.year}:${edit.projectId}` }])
          await tgEditMessage(token, chatId, edit.controllerMessageId, text, { inline_keyboard: rows })
        } else {
          const inv = edit.invoiceNumber || ''
          await clearInvoiceBubblesExcept(chatId, edit.controllerMessageId)
          await sendInvoiceDetailBubbles(token, chatId, edit.controllerMessageId, edit.year, edit.projectId, inv)
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
      // Clear existing project bubbles from the screen
      await clearProjectBubbles(chatId)
      await clearInvoiceBubbles(chatId)
      // Re-post the split welcome/year list and save their IDs
      const m1 = await sendBubble(token, chatId, welcomeText())
      const m2 = await sendBubble(
        token,
        chatId,
        'To locate the project you\'re looking for, please select the year the project was picked up below:',
        buildYearsKeyboard(years),
      )
      await saveYearMenu(chatId, m1?.message_id, m2?.message_id)
      return res.status(200).end('ok')
    }
    if (data.startsWith('BK:PROJ:')) {
      const [, , year, projectId] = data.split(':')
      try {
        // Delete the current detail bubble and re-list all projects
        try { await tgDeleteMessage(token, chatId, msgId) } catch {}
        await clearInvoiceBubbles(chatId)
        const { projects } = await adminFetchAllProjectsForYear(year)
        const ids: number[] = []
        const head = await sendBubble(token, chatId, `Projects of ${year} ⬇️`, {
          inline_keyboard: [
            [{ text: '➕ Add New Project', callback_data: `NEW:PROJ:${year}` }],
            [{ text: '⬅ Back to Years', callback_data: 'BK:YEARS' }],
          ],
        })
        if (head?.message_id) ids.push(head.message_id)
        for (const p of projects) {
          const resp = await sendBubble(token, chatId, projectSummaryText(p), {
            inline_keyboard: [[
              { text: 'Select', callback_data: `P:${year}:${p.id}` },
              { text: 'Edit', callback_data: `EDIT:PROJ:${year}:${p.id}` },
            ]],
          })
          if (resp?.message_id) ids.push(resp.message_id)
        }
        // Add a tail marker with the same actions for convenience
        const tail = await sendBubble(token, chatId, `Projects of ${year} ⬆️`, {
          inline_keyboard: [
            [{ text: '➕ Add New Project', callback_data: `NEW:PROJ:${year}` }],
            [{ text: '⬅ Back to Years', callback_data: 'BK:YEARS' }],
          ],
        })
        if (tail?.message_id) ids.push(tail.message_id)
        await saveProjectBubbles(chatId, ids)
      } catch {
        await tgSendMessage(token, chatId, 'Back to projects. Select another above.', { inline_keyboard: [[{ text: '⬅ Back to Years', callback_data: 'BK:YEARS' }]] })
      }
      return res.status(200).end('ok')
    }
  }

  // Default ack
  return res.status(200).end('ok')
}
