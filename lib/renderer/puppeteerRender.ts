import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--single-process',
      '--font-render-hinting=medium',
    ],
    defaultViewport: chromium.defaultViewport,
    ignoreHTTPSErrors: true,
  })
  try {
    const page = await browser.newPage()
    // Emulate screen for proper font rendering
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 })
    await page.emulateMediaType('screen')
    // Avoid waiting on external fonts/styles; block heavy types for stability
    try {
      await page.setRequestInterception(true)
      page.on('request', (req) => {
        const type = req.resourceType()
        if (type === 'font' || type === 'image' || type === 'media' || type === 'stylesheet') {
          return req.abort()
        }
        return req.continue()
      })
    } catch {}
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    // Support <!--pagebreak--> markers
    await page.addStyleTag({ content: '@media print { .pagebreak { page-break-before: always; } }' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0.2in', bottom: '0.2in', left: '0.3in', right: '0.3in' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
