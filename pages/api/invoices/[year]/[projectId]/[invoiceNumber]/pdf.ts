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
    const msg = e?.message || String(e)
    try { console.error('[pdf] puppeteer render failed', { error: msg }) } catch {}
    if ((req.query.debug as string) === '1') {
      return res.status(500).send(`Failed to render PDF: ${msg}`)
    }
    // Fallback: minimal PDF via pdfkit to avoid blocking users
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ size: 'A4', margins: { top: 36, bottom: 36, left: 40, right: 40 } })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(Buffer.from(c)))
      doc.on('error', () => {})
      doc.fontSize(16).text(`Invoice #${inv.invoiceNumber}`, { align: 'left' })
      doc.moveDown(0.5)
      if (inv.companyName) doc.fontSize(10).text(inv.companyName)
      if (inv.addressLine1) doc.text(inv.addressLine1)
      if (inv.addressLine2) doc.text(inv.addressLine2)
      if (inv.addressLine3 || inv.region) doc.text([inv.addressLine3, inv.region].filter(Boolean).join(', '))
      if (inv.representative) doc.text(`ATTN: ${inv.representative}`)
      doc.moveDown(0.5)
      ;(inv.items || []).forEach((it: any) => {
        const total = (typeof it.unitPrice === 'number' && typeof it.quantity === 'number') ? it.unitPrice * it.quantity : 0
        if (it.title) doc.fontSize(10).text(it.title)
        if (it.feeType) doc.text(it.feeType)
        if (it.notes) doc.text(it.notes)
        doc.text(`${it.unitPrice ?? ''} x ${it.quantity ?? ''}${it.quantityUnit ? `/${it.quantityUnit}` : ''} = ${total}`, { align: 'right' })
        doc.moveDown(0.25)
      })
      doc.moveDown(0.5)
      const amt = typeof inv.amount === 'number' ? inv.amount.toFixed(2) : '-'
      doc.fontSize(12).text(`Total: ${amt}`, { align: 'right' })
      if (inv.paidTo) doc.fontSize(10).text(`To: ${inv.paidTo}`)
      if (inv.paymentStatus) doc.text(`(${inv.paymentStatus})`)
      doc.end()
      await new Promise<void>((resolve) => doc.on('end', () => resolve()))
      pdfBuf = Buffer.concat(chunks)
    } catch (fallbackErr) {
      try { console.error('[pdf] fallback render failed', { error: fallbackErr?.message || String(fallbackErr) }) } catch {}
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
