import type { NextApiRequest, NextApiResponse } from 'next'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import fs from 'fs'

/**
 * HTML-to-PDF endpoint using headless Chromium.
 *
 * Renders the invoice preview page in a single, controlled Chromium instance
 * and returns an A4 portrait PDF. The preview HTML acts as the single source
 * of truth for layout and fonts.
 */

async function getExecutablePath() {
  // 1) Explicit override wins.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // 2) Local macOS dev convenience: use system Chrome if available.
  if (process.platform === 'darwin') {
    const macChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if (fs.existsSync(macChromePath)) {
      return macChromePath
    }
  }

  // 3) Serverless / Linux environments: use sparticuz chromium.
  try {
    const p = await chromium.executablePath()
    if (p) return p
  } catch {
    // fall through
  }

  throw new Error(
    'No Chromium executable path found. Set PUPPETEER_EXECUTABLE_PATH or configure @sparticuz/chromium for this environment.',
  )
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { year, projectId, invoiceNumber } = req.query

  if (typeof year !== 'string' || typeof projectId !== 'string' || typeof invoiceNumber !== 'string') {
    return res.status(400).send('Invalid request parameters')
  }

  try {
    const protocol = (req.headers['x-forwarded-proto'] as string) || 'http'
    const host = req.headers.host
    if (!host) {
      return res.status(500).send('Missing Host header')
    }

    const projectNumber = typeof req.query.projectNumber === 'string' ? req.query.projectNumber : ''
    const gridParam = req.query.grid === '1' || req.query.grid === 'true' ? '1' : ''

    const baseUrl = `${protocol}://${host}`
    const previewPath = `/dashboard/new-ui/projects/show/${encodeURIComponent(
      projectId,
    )}/invoice/${encodeURIComponent(invoiceNumber)}/preview?year=${encodeURIComponent(
      year,
    )}&projectNumber=${encodeURIComponent(projectNumber)}${
      gridParam ? '&grid=1' : ''
    }&pdf=1`

    const url = `${baseUrl}${previewPath}`

    const executablePath = await getExecutablePath()

    const browser = await puppeteer.launch(
      process.platform === 'darwin'
        ? {
            executablePath,
            headless: true,
          }
        : {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            headless: true,
            executablePath,
          },
    )

    try {
      const page = await browser.newPage()
      // Surface console output from the headless preview page into the Node
      // logs so we can see what data the Chromium session actually has at
      // the moment the PDF is generated.
      page.on('console', (msg) => {
        // eslint-disable-next-line no-console
        console.log('[invoice-pdf][console]', msg.type(), msg.text())
      })
      page.on('pageerror', (err) => {
        // eslint-disable-next-line no-console
        console.error('[invoice-pdf][pageerror]', err)
      })

      // Propagate the incoming request's cookies into the headless browser so
      // that authenticated API routes (e.g. /api/projects/by-id/[id]) behave
      // the same way they do in the user's real browser session. This ensures
      // the preview loaded under Puppeteer can see the same project,
      // subsidiary and bank data that the HTML preview uses.
      const rawCookie = req.headers.cookie
      if (rawCookie) {
        const cookieDomain = host.split(':')[0]
        const parsed = rawCookie.split(';').map((pair) => {
          const [name, ...rest] = pair.split('=')
          return {
            name: name.trim(),
            value: rest.join('=').trim(),
            domain: cookieDomain,
            path: '/',
          }
        })
        if (parsed.length > 0) {
          await page.setCookie(...parsed)
        }
      }

      // Ensure that print-specific CSS (@media print) is applied when
      // rendering the PDF. Without this, Chromium will render in "screen"
      // mode and still include the surrounding app chrome.
      await page.emulateMediaType('print')
      // In dev, Next.js keeps long‑lived connections open, so "networkidle0"
      // can easily time out. Use "networkidle2" and then explicitly wait for
      // the preview to settle, and additionally wait for the React invoice
      // root to signal that all async data (project, subsidiary, bank) has
      // finished loading via data-ready=\"1\".
      // eslint-disable-next-line no-console
      console.log('[invoice-pdf][navigate]', { url })
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
      await page.waitForSelector('#invoice-print-root .scheme-grid', { timeout: 60000 })
      await page.waitForFunction(
        () => {
          const el = document.getElementById('invoice-print-root')
          return !!el && el.getAttribute('data-ready') === '1'
        },
        { timeout: 60000 },
      )

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        landscape: false,
        margin: {
          top: '0.2in',
          bottom: '0.2in',
          left: '0.3in',
          right: '0.3in',
        },
      })

      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="invoice-${encodeURIComponent(invoiceNumber)}.pdf"`,
      )
      res.setHeader('Content-Length', String(pdfBuffer.length))
      res.status(200).send(pdfBuffer)
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.error('Error generating PDF via headless Chromium:', error)
    res.status(500).send('Error generating PDF')
  }
}
