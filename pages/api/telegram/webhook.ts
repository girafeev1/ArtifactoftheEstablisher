import type { NextApiRequest, NextApiResponse } from 'next'
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

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`

async function tgSendMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: any
) {
  try {
    await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    })
  } catch {
    // ignore network errors
  }
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

async function handleYearSelected(token: string, chatId: number, year: string) {
  const projects = await fetchProjectsForYear(year)
  if (!projects.length) {
    await tgSendMessage(token, chatId, `No projects found for ${year}.`)
    return
  }
  const kb = buildProjectsKeyboard(year, projects, 1)
  await tgSendMessage(token, chatId, `Projects in ${year}:`, kb)
}

async function handleProjectDetails(token: string, chatId: number, year: string, projectId: string) {
  const list = await fetchProjectsForYear(year)
  const p = list.find((x) => x.id === projectId)
  if (!p) {
    await tgSendMessage(token, chatId, 'Project not found. Please go back and pick another.')
    return
  }
  const lines = [
    `${p.projectNumber} ${p.projectDateDisplay ? '/ ' + p.projectDateDisplay : ''}`.trim(),
    [p.presenterWorkType, p.projectTitle].filter(Boolean).join(' — '),
    p.projectNature || '',
    p.clientCompany ? `Client: ${p.clientCompany}` : '',
    p.paymentStatus ? `Status: ${p.paymentStatus}` : '',
  ].filter(Boolean)
  await tgSendMessage(token, chatId, lines.join('\n'))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (!token) return res.status(200).end('ok')

  // Verify optional webhook secret header
  const hdr = (req.headers['x-telegram-bot-api-secret-token'] || '') as string
  if (secret && hdr !== secret) return res.status(200).end('ok')

  const raw = await readRawBody(req)
  let update: any
  try {
    update = JSON.parse(raw.toString('utf8'))
  } catch {
    return res.status(200).end('ok')
  }

  // Always ACK immediately
  res.status(200).end('ok')

  const msg = update.message
  const cq = update.callback_query

  if (msg && msg.text) {
    const chatId = msg.chat?.id as number
    const text = (msg.text as string).trim()
    if (text === '/start' || text === '/menu') {
      // Static year list (fast) — can later fetch from DB if needed
      const years = ['2025', '2024', '2023', '2022', '2021']
      const keyboard = years.map((y) => [{ text: y, callback_data: `Y:${y}` }])
      await tgSendMessage(token, chatId, 'Select a year:', { inline_keyboard: keyboard })
      return
    }
  }

  if (cq && cq.data) {
    const data: string = cq.data
    const chatId = cq.message?.chat?.id as number
    if (data.startsWith('Y:')) {
      const year = data.split(':')[1]
      await handleYearSelected(token, chatId, year)
      return
    }
    if (data.startsWith('PG:')) {
      // Pagination: PG:<year>:<page>
      const [, year, pageStr] = data.split(':')
      const page = parseInt(pageStr || '1', 10) || 1
      const projects = await fetchProjectsForYear(year)
      const kb = buildProjectsKeyboard(year, projects, page)
      await tgSendMessage(token, chatId, `Projects in ${year}:`, kb)
      return
    }
    if (data.startsWith('P:')) {
      const [, year, projectId] = data.split(':')
      await handleProjectDetails(token, chatId, year, projectId)
      return
    }
  }
}

