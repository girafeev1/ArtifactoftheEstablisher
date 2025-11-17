import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath()
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: executablePath || undefined,
    args: [...chromium.args, '--font-render-hinting=medium'],
    defaultViewport: chromium.defaultViewport,
    ignoreHTTPSErrors: true,
  })
  try {
    const page = await browser.newPage()
    // Emulate screen for proper font rendering
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
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
