import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import crypto from 'crypto'

// Simple native PDF generator using @react-pdf/renderer to keep serverless-friendly
// Avoid headless Chrome for now; continue improving layout in iterations
// Switch to HTML/CSS + Puppeteer for pixel-parity rendering
import { buildInvoiceHtml, type InvoiceVariant } from '../../../../../../lib/renderer/invoiceHtml'
import { renderHtmlToPdf } from '../../../../../../lib/renderer/puppeteerRender'
import { amountHK, num2eng, num2chi } from '../../../../../../lib/invoiceFormat'

// Drive upload disabled per current requirement (download only)

// keep helpers available for potential inline text usage

function num2eng(number: number) {
  if (number == null || isNaN(number) || Number(number) === 0) return ''
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion']
  const numParts = number.toFixed(2).split('.')
  const wholePart = parseInt(numParts[0], 10)
  const decimalPart = parseInt(numParts[1], 10)
  let dollarWords: string[] = []
  let lastIntegerIndexInDollars = -1
  function convertChunk(num: number) {
    const chunkWords: string[] = []
    let lastIntegerIndex = -1
    if (num >= 100) {
      chunkWords.push(ones[Math.floor(num / 100)])
      chunkWords.push('Hundred')
      num = num % 100
    }
    if (num > 0) {
      lastIntegerIndex = chunkWords.length
      if (num < 20) chunkWords.push(ones[num])
      else {
        chunkWords.push(tens[Math.floor(num / 10)])
        if (num % 10 > 0) chunkWords.push(ones[num % 10])
      }
    }
    return { words: chunkWords, lastIntegerIndex }
  }
  if (wholePart > 0) {
    let numString = wholePart.toString()
    const chunks: string[] = []
    while (numString.length > 0) {
      const end = numString.length
      const start = Math.max(0, end - 3)
      chunks.unshift(numString.substring(start, end))
      numString = numString.substring(0, start)
    }
    const dollarWordArray: { words: string[]; lastIntegerIndex: number }[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunkNum = parseInt(chunks[i], 10)
      if (chunkNum > 0) {
        const chunkObj = convertChunk(chunkNum)
        const chunkWords = chunkObj.words
        const scale = scales[chunks.length - i - 1]
        if (scale) chunkWords.push(scale)
        dollarWordArray.push({ words: chunkWords, lastIntegerIndex: chunkObj.lastIntegerIndex })
      }
    }
    for (let i = 0; i < dollarWordArray.length; i++) {
      const chunk = dollarWordArray[i]
      dollarWords = dollarWords.concat(chunk.words)
    }
    const lastChunk = dollarWordArray[dollarWordArray.length - 1]
    if (lastChunk.lastIntegerIndex > -1) {
      lastIntegerIndexInDollars = dollarWords.length - lastChunk.words.length + lastChunk.lastIntegerIndex
    } else {
      lastIntegerIndexInDollars = dollarWords.length - lastChunk.words.length
    }
  }
  let words: string[] = []
  if (wholePart > 0) {
    words = words.concat(dollarWords)
    words.push('Dollars')
  }
  if (decimalPart > 0) {
    const centsChunk = convertChunk(decimalPart).words
    words.push('And')
    words = words.concat(centsChunk)
    words.push('Cents')
  } else {
    if (lastIntegerIndexInDollars > 0) words.splice(lastIntegerIndexInDollars, 0, 'And')
    words.push('Only')
  }
  const result = words.join(' ').replace(/\s+/g, ' ').trim()
  return result.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function num2chi(n: number) {
  if (n === undefined || n === null) return ''
  const s = String(n.toFixed(2))
  const digit = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
  const unit = ['', '拾', '佰', '仟']
  const sectionUnit = ['', '萬', '億', '兆']
  const decimalUnit = ['毫', '仙']
  const parts = s.split('.')
  let integerPart = parseInt(parts[0], 10)
  const decimalPart = parts.length > 1 ? parts[1].substr(0, 2) : ''
  function sectionToFinancialChinese(section: number) {
    let str = ''
    let unitPos = 0
    let zero = true
    while (section > 0) {
      const v = section % 10
      if (v === 0) {
        if (!zero) { zero = true; str = digit[0] + str }
      } else {
        zero = false
        str = digit[v] + unit[unitPos] + str
      }
      unitPos++
      section = Math.floor(section / 10)
    }
    return str
  }
  function integerToChequeChinese(val: number) {
    if (val === 0) return digit[0]
    let str = ''
    let sectionPos = 0
    let needZero = false
    while (val > 0) {
      const section = val % 10000
      const sectionStr = sectionToFinancialChinese(section)
      if (needZero && sectionStr !== '') str = digit[0] + str
      if (sectionStr !== '') str = sectionStr + sectionUnit[sectionPos] + str
      else if (str !== '') str = sectionUnit[sectionPos] + str
      needZero = section < 1000 && section > 0
      val = Math.floor(val / 10000)
      sectionPos++
    }
    return str
  }
  const integerStr = integerToChequeChinese(integerPart)
  let decimalStr = ''
  if (decimalPart && parseInt(decimalPart, 10) !== 0) {
    for (let i = 0; i < decimalPart.length && i < 2; i++) {
      const num = parseInt(decimalPart.charAt(i), 10)
      if (num !== 0) decimalStr += digit[num] + decimalUnit[i]
      else if (i < decimalPart.length - 1 && parseInt(decimalPart.charAt(i + 1), 10) !== 0) decimalStr += digit[0]
    }
  } else {
    decimalStr = '正'
  }
  return integerStr + '元' + decimalStr
}

function computeHash(obj: any): string {
  const json = JSON.stringify(obj)
  return crypto.createHash('sha256').update(json).digest('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { year, projectId, invoiceNumber } = req.query as Record<string, string>
  if (!year || !projectId || !invoiceNumber) return res.status(400).json({ error: 'Missing parameters' })
  const variant = ((req.query.variant as string) || 'bundle') as InvoiceVariant
  const meta = (req.query.meta as string) || null
  const inline = req.query.inline === '1'
  try { console.info('[pdf] request', { year, projectId, invoiceNumber }) } catch {}

  // Load invoice
  let inv: any
  try {
    const invoices = await fetchInvoicesForProject(year, projectId)
    inv = invoices.find((i) => i.invoiceNumber === invoiceNumber)
  } catch (e: any) {
    try { console.error('[pdf] failed to fetch invoices', { error: e?.message || String(e) }) } catch {}
    return res.status(500).send('Failed to load invoice data')
  }
  if (!inv) return res.status(404).send('Invoice not found')

  if (meta === 'itemsPages') {
    // Heuristic items page count: 1 page minimum; more pages if notes are long/many items.
    const items = Array.isArray(inv.items) ? inv.items : []
    let lines = 0
    for (const it of items) {
      lines += 2 // title + calc line baseline
      if (it.subQuantity) lines += 1
      if (it.feeType) lines += 1
      if (it.notes) {
        const len = String(it.notes).length
        lines += Math.ceil(len / 80)
      }
    }
    const LINES_PER_PAGE = 28
    const pages = Math.max(1, Math.ceil(lines / LINES_PER_PAGE))
    return res.status(200).json({ itemsPages: pages, variant })
  }

  // Compute hash of relevant fields for staleness
  const model = {
    invoiceNumber: inv.invoiceNumber,
    companyName: inv.companyName,
    addressLine1: inv.addressLine1,
    addressLine2: inv.addressLine2,
    addressLine3: inv.addressLine3,
    region: inv.region,
    representative: inv.representative,
    items: (inv.items || []).map((it) => ({ title: it.title, subQuantity: it.subQuantity, feeType: it.feeType, notes: it.notes, unitPrice: it.unitPrice, quantity: it.quantity, quantityUnit: it.quantityUnit, discount: it.discount })),
    amount: inv.amount,
    paymentStatus: inv.paymentStatus,
    paidTo: inv.paidTo,
  }
  const hash = computeHash(model)

  // Render quick native PDF (baseline; refine layout iteratively)
  // Build variant-aware HTML and render via Puppeteer
  const html = buildInvoiceHtml({
    invoiceNumber: inv.invoiceNumber,
    companyName: inv.companyName ?? null,
    addressLine1: inv.addressLine1 ?? null,
    addressLine2: inv.addressLine2 ?? null,
    addressLine3: inv.addressLine3 ?? null,
    region: inv.region ?? null,
    representative: inv.representative ?? null,
    items: Array.isArray(inv.items) ? inv.items : [],
    subtotal: typeof inv.subtotal === 'number' ? inv.subtotal : null,
    total: typeof inv.total === 'number' ? inv.total : null,
    amount: typeof inv.amount === 'number' ? inv.amount : null,
    paidTo: inv.paidTo ?? null,
    paymentStatus: inv.paymentStatus ?? null,
    subsidiaryEnglishName: inv.companyName ?? null,
  }, variant)

  let pdfBuf: Buffer
  try {
    pdfBuf = await renderHtmlToPdf(html)
  } catch (e: any) {
    try { console.error('[pdf] puppeteer render failed', { error: e?.message || String(e) }) } catch {}
    return res.status(500).send('Failed to render PDF')
  }

  // Prepare response headers early
  const filename = `Invoice-${inv.invoiceNumber}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', String(pdfBuf.byteLength))
  // Send PDF to client for download
  res.status(200).end(pdfBuf)
}
export const config = { api: { bodyParser: false } }
