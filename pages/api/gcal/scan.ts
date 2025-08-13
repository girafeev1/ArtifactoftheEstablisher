import type { NextApiRequest, NextApiResponse } from 'next'
import { google } from 'googleapis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }
  try {
    const email = process.env.GCAL_CLIENT_EMAIL
    const key = (process.env.GCAL_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    const calendarIds = (process.env.GOOGLE_CALENDAR_ID || '').split(',').filter(Boolean)
    if (!email || !key || calendarIds.length === 0) {
      res.status(500).json({ error: 'missing calendar credentials' })
      return
    }
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    const calendar = google.calendar({ version: 'v3', auth })
    const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    let added = 0
    let updated = 0
    let skipped = 0
    for (const id of calendarIds) {
      const resp = await calendar.events.list({ calendarId: id, timeMin })
      const events = resp.data.items || []
      events.forEach(() => {
        skipped += 1
      })
    }
    res.status(200).json({ added, updated, skipped })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'scan failed' })
  }
}

