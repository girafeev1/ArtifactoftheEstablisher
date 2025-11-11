import type { NextApiRequest, NextApiResponse } from 'next'

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

async function tgSendMessage(token: string, chatId: number | string, text: string, replyMarkup?: any) {
  try {
    await fetch(`${TELEGRAM_API(token)}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    })
  } catch (e) {
    // ignore network errors
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN || ''
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (!token) {
    return res.status(200).end('ok')
  }

  // Verify webhook secret token header (optional but recommended)
  const hdr = (req.headers['x-telegram-bot-api-secret-token'] || '') as string
  if (secret && hdr !== secret) {
    // Still ack to avoid retries, but ignore processing
    return res.status(200).end('ok')
  }

  const raw = await readRawBody(req)
  let update: any
  try {
    update = JSON.parse(raw.toString('utf8'))
  } catch {
    return res.status(200).end('ok')
  }

  // Always ack immediately
  res.status(200).end('ok')

  // Handle message commands
  const msg = update.message
  const cq = update.callback_query

  if (msg && msg.text) {
    const chatId = msg.chat?.id
    const text = (msg.text as string).trim()
    if (text === '/start' || text === '/menu') {
      const years = ['2025', '2024', '2023', '2022', '2021']
      const keyboard = years.map((y) => [{ text: y, callback_data: `Y:${y}` }])
      await tgSendMessage(token, chatId, 'Select a year:', { inline_keyboard: keyboard })
      return
    }
  }

  if (cq && cq.data) {
    const data: string = cq.data
    const chatId = cq.message?.chat?.id
    if (data.startsWith('Y:')) {
      const year = data.split(':')[1]
      await tgSendMessage(token, chatId, `Year ${year} selected. (Project listing coming next)`) 
      return
    }
  }
}

