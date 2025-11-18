import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { pdf } from '@react-pdf/renderer'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import { buildClassicInvoiceDocument } from '../../../../../../lib/pdfTemplates/classicInvoice'

const computeHash = (obj: any): string =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { year, projectId, invoiceNumber } = req.query as Record<string, string>
  if (!year || !projectId || !invoiceNumber) return res.status(400).json({ error: 'Missing parameters' })

  const meta = (req.query.meta as string) || null
  const inline = req.query.inline === '1'

  let inv: any
  try {
    const invoices = await fetchInvoicesForProject(year, projectId)
    inv = invoices.find((invoice) => invoice.invoiceNumber === invoiceNumber)
  } catch (error: any) {
    try { console.error('[pdf] fetch error', { error: error?.message || String(error) }) } catch {}
    return res.status(500).send('Failed to load invoice data')
  }

  if (!inv) return res.status(404).send('Invoice not found')

  if (meta === 'itemsPages') {
    const items = Array.isArray(inv.items) ? inv.items : []
    let lines = 0
    items.forEach((item: any) => {
      lines += 2
      if (item.subQuantity) lines += 1
      if (item.feeType) lines += 1
      if (item.notes) lines += Math.ceil(String(item.notes).length / 80)
    })
    const pages = Math.max(1, Math.ceil(lines / 28))
    return res.status(200).json({ itemsPages: pages })
  }

  const model = {
    invoiceNumber: inv.invoiceNumber,
    companyName: inv.companyName,
    addressLine1: inv.addressLine1,
    addressLine2: inv.addressLine2,
    addressLine3: inv.addressLine3,
    region: inv.region,
    representative: inv.representative,
    items: (inv.items || []).map((item: any) => ({
      title: item.title,
      subQuantity: item.subQuantity,
      feeType: item.feeType,
      notes: item.notes,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit,
      discount: item.discount,
    })),
    amount: inv.amount,
    paymentStatus: inv.paymentStatus,
    paidTo: inv.paidTo,
  }
  const hash = computeHash(model)
  try { console.info('[pdf] build model hash', { hash }) } catch {}

  const docInput = {
    invoiceNumber: inv.invoiceNumber,
    companyName: inv.companyName ?? null,
    addressLine1: inv.addressLine1 ?? null,
    addressLine2: inv.addressLine2 ?? null,
    addressLine3: inv.addressLine3 ?? null,
    region: inv.region ?? null,
    representative: inv.representative ?? null,
    presenterWorkType: inv.presenterWorkType ?? null,
    projectTitle: inv.projectTitle ?? null,
    projectNature: inv.projectNature ?? null,
    subsidiaryEnglishName: inv.companyName ?? null,
    subsidiaryChineseName: inv.subsidiaryChineseName ?? null,
    items: Array.isArray(inv.items) ? inv.items : [],
    subtotal: typeof inv.subtotal === 'number' ? inv.subtotal : null,
    total: typeof inv.total === 'number' ? inv.total : null,
    amount: typeof inv.amount === 'number' ? inv.amount : null,
    paidTo: inv.paidTo ?? null,
    paymentStatus: inv.paymentStatus ?? null,
    bankName: inv.bankName ?? null,
    bankCode: inv.bankCode ?? null,
    accountType: inv.accountType ?? null,
  }

  let pdfBuffer: Buffer
  try {
    const document = buildClassicInvoiceDocument(docInput)
    const instance = pdf(document)
    const rendered: any = await instance.toBuffer()
    pdfBuffer = Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered)
  } catch (renderError: any) {
    const errorMessage = renderError?.message || String(renderError)
    try { console.error('[pdf] react-pdf render failed', { error: errorMessage }) } catch {}
    if ((req.query.debug as string) === '1') {
      return res.status(500).send(`Failed to render PDF: ${errorMessage}`)
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ size: 'A4', margins: { top: 36, bottom: 36, left: 40, right: 40 } })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      doc.on('error', () => {})
      doc.fontSize(16).text(`Invoice #${inv.invoiceNumber}`, { align: 'left' })
      doc.moveDown(0.5)
      if (inv.companyName) doc.fontSize(10).text(inv.companyName)
      if (inv.addressLine1) doc.text(inv.addressLine1)
      if (inv.addressLine2) doc.text(inv.addressLine2)
      if (inv.addressLine3 || inv.region) doc.text([inv.addressLine3, inv.region].filter(Boolean).join(', '))
      if (inv.representative) doc.text(`ATTN: ${inv.representative}`)
      doc.moveDown(0.5)
      ;(inv.items || []).forEach((item: any) => {
        const total = (typeof item.unitPrice === 'number' && typeof item.quantity === 'number') ? item.unitPrice * item.quantity : 0
        if (item.title) doc.fontSize(10).text(item.title)
        if (item.feeType) doc.text(item.feeType)
        if (item.notes) doc.text(item.notes)
        doc.text(`${item.unitPrice ?? ''} x ${item.quantity ?? ''}${item.quantityUnit ? `/${item.quantityUnit}` : ''} = ${total}`, { align: 'right' })
        doc.moveDown(0.25)
      })
      doc.moveDown(0.5)
      const amt = typeof inv.amount === 'number' ? inv.amount.toFixed(2) : '-'
      doc.fontSize(12).text(`Total: ${amt}`, { align: 'right' })
      if (inv.paidTo) doc.fontSize(10).text(`To: ${inv.paidTo}`)
      if (inv.paymentStatus) doc.text(`(${inv.paymentStatus})`)
      doc.end()
      await new Promise<void>((resolve) => doc.on('end', () => resolve()))
      pdfBuffer = Buffer.concat(chunks)
    } catch (fallbackError) {
      try { console.error('[pdf] fallback render failed', { error: fallbackError?.message || String(fallbackError) }) } catch {}
      return res.status(500).send('Failed to render PDF')
    }
  }

  const filename = `Invoice-${inv.invoiceNumber}.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Length', String(pdfBuffer.byteLength))
  res.status(200).end(pdfBuffer)
}

export const config = { api: { bodyParser: false } }
