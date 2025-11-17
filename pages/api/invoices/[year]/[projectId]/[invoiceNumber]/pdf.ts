import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import crypto from 'crypto'

// Simple native PDF generator using @react-pdf/renderer to keep serverless-friendly
// Avoid headless Chrome for now; continue improving layout in iterations
import * as React from 'react'
import { pdf, Document as PdfDocument, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Drive upload disabled per current requirement (download only)

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 36, paddingHorizontal: 40, fontSize: 10, fontFamily: 'Helvetica' },
  heading: { fontSize: 18, marginBottom: 8 },
  subheading: { fontSize: 12, marginBottom: 4 },
  row: { display: 'flex', flexDirection: 'row', marginBottom: 2 },
  colLeft: { flex: 1 },
  colRight: { flex: 1, textAlign: 'right' },
  divider: { marginVertical: 10, borderBottomWidth: 1, borderBottomColor: '#000' },
  itemRow: { display: 'flex', flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: '#999' },
  itemTitle: { flex: 3 },
  itemQty: { flex: 1, textAlign: 'right' },
  itemUnit: { flex: 1, textAlign: 'right' },
  itemTotal: { flex: 1, textAlign: 'right' },
  totalRow: { display: 'flex', flexDirection: 'row', marginTop: 8 },
  totalLabel: { flex: 3, textAlign: 'right' },
  totalValue: { flex: 1, textAlign: 'right' },
})

function amountHK(n?: number | null) {
  if (typeof n !== 'number') return '-'
  const f = new Intl.NumberFormat('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `HK$ ${f.format(n)}`
}

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
  const variant = (req.query.variant as string) || 'bundle'
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
  const items = (inv.items || []).map((it, idx) => {
    const total = (typeof it.unitPrice === 'number' && typeof it.quantity === 'number') ? it.unitPrice * it.quantity : 0
    return React.createElement(
      View,
      { key: String(idx), style: styles.itemRow },
      React.createElement(Text, { style: styles.itemTitle }, `${it.title || ''}${it.subQuantity ? ` x${it.subQuantity}` : ''}${it.feeType ? `\n${it.feeType}` : ''}${it.notes ? `\n${it.notes}` : ''}`),
      React.createElement(Text, { style: styles.itemQty }, `${it.quantity ?? ''}${it.quantityUnit ? `/${it.quantityUnit}` : ''}`),
      React.createElement(Text, { style: styles.itemUnit }, typeof it.unitPrice === 'number' ? amountHK(it.unitPrice) : ''),
      React.createElement(Text, { style: styles.itemTotal }, amountHK(total)),
    )
  })

  const docEl: any = React.createElement(
    PdfDocument,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.heading }, `Invoice #${inv.invoiceNumber}`),
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(
          View,
          { style: styles.colLeft },
          inv.companyName ? React.createElement(Text, null, inv.companyName) : null,
          inv.addressLine1 ? React.createElement(Text, null, inv.addressLine1) : null,
          inv.addressLine2 ? React.createElement(Text, null, inv.addressLine2) : null,
          (inv.addressLine3 || inv.region) ? React.createElement(Text, null, [inv.addressLine3, inv.region].filter(Boolean).join(', ')) : null,
          inv.representative ? React.createElement(Text, null, `ATTN: ${inv.representative}`) : null,
        ),
        React.createElement(
          View,
          { style: styles.colRight },
          React.createElement(Text, null, new Date().toLocaleDateString('en-HK')),
        ),
      ),
      React.createElement(View, { style: styles.divider }),
      ...items,
      React.createElement(
        View,
        { style: styles.totalRow },
        React.createElement(Text, { style: styles.totalLabel }, 'Total:'),
        React.createElement(Text, { style: styles.totalValue }, amountHK(inv.amount)),
      ),
      // Amount-in-words lines: English above, Chinese below
      typeof inv.amount === 'number' ? React.createElement(Text, null, `For the amount of: ${num2eng(inv.amount)}`) : null,
      inv.paidTo ? React.createElement(Text, null, `To: ${inv.paidTo}`) : null,
      typeof inv.amount === 'number' ? React.createElement(Text, null, `茲付金額：${num2chi(inv.amount)}`) : null,
      inv.paymentStatus ? React.createElement(Text, null, `(${inv.paymentStatus})`) : null,
    ),
  )
  let pdfBuf: Buffer
  try {
    const anyBuf: any = await pdf(docEl).toBuffer()
    pdfBuf = Buffer.isBuffer(anyBuf) ? anyBuf : Buffer.from(anyBuf)
    try { console.info('[pdf] rendered', { size: pdfBuf.byteLength }) } catch {}
  } catch (e: any) {
    try { console.error('[pdf] render failed', { error: e?.message || String(e) }) } catch {}
    // Fallback: render a minimal PDF via pdfkit to avoid a hard failure
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ size: 'A4', margins: { top: 36, bottom: 36, left: 40, right: 40 } })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
      doc.on('error', () => {})
      doc.fontSize(18).text(`Invoice #${inv.invoiceNumber}`, { align: 'left' })
      doc.moveDown(0.5)
      if (inv.companyName) doc.fontSize(10).text(inv.companyName)
      if (inv.addressLine1) doc.text(inv.addressLine1)
      if (inv.addressLine2) doc.text(inv.addressLine2)
      if (inv.addressLine3 || inv.region) doc.text([inv.addressLine3, inv.region].filter(Boolean).join(', '))
      if (inv.representative) doc.text(`ATTN: ${inv.representative}`)
      doc.moveDown(0.5)
      doc.text('')
      ;(inv.items || []).forEach((it: any) => {
        const total = (typeof it.unitPrice === 'number' && typeof it.quantity === 'number') ? it.unitPrice * it.quantity : 0
        doc.fontSize(10).text(`${it.title || ''}${it.subQuantity ? ` x${it.subQuantity}` : ''}`)
        if (it.feeType) doc.text(it.feeType)
        if (it.notes) doc.text(it.notes)
        doc.text(`${it.quantity ?? ''}${it.quantityUnit ? `/${it.quantityUnit}` : ''}  @ ${typeof it.unitPrice==='number'?it.unitPrice.toFixed(2):''}  = ${total.toFixed(2)}`, { align: 'right' })
        doc.moveDown(0.25)
      })
      doc.moveDown(0.5)
      const amt = typeof inv.amount === 'number' ? inv.amount.toFixed(2) : '-'
      doc.fontSize(12).text(`Total: ${amt}`, { align: 'right' })
      if (inv.paidTo) doc.fontSize(10).text(`To: ${inv.paidTo}`)
      if (inv.paymentStatus) doc.text(inv.paymentStatus)
      doc.end()
      await new Promise<void>((resolve) => doc.on('end', () => resolve()))
      pdfBuf = Buffer.concat(chunks)
      try { console.info('[pdf] rendered via pdfkit', { size: pdfBuf.byteLength }) } catch {}
    } catch (e2: any) {
      try { console.error('[pdf] pdfkit fallback failed', { error: e2?.message || String(e2) }) } catch {}
      return res.status(500).send('Failed to render PDF')
    }
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
