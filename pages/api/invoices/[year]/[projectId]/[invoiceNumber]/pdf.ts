import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import { getAdminFirestore } from '../../../../../../lib/firebaseAdmin'
import { PROJECTS_FIRESTORE_DATABASE_ID } from '../../../../../../lib/firebase'
import { ensureYearFolder, uploadPdfBuffer } from '../../../../../../lib/googleDrive'
import crypto from 'crypto'

// Simple native PDF generator using @react-pdf/renderer to keep serverless-friendly
// Avoid headless Chrome for now; continue improving layout in iterations
import * as React from 'react'
import { pdf, Document as PdfDocument, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const DRIVE_ROOT_FOLDER = process.env.GOOGLE_INVOICE_DRIVE_ROOT_FOLDER_ID || '158FNB18B_LLLahSssBxzIMoQN-VwEXqt'

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

function amount(n?: number | null) { return typeof n === 'number' ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '-' }

function computeHash(obj: any): string {
  const json = JSON.stringify(obj)
  return crypto.createHash('sha256').update(json).digest('hex')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { year, projectId, invoiceNumber } = req.query as Record<string, string>
  if (!year || !projectId || !invoiceNumber) return res.status(400).json({ error: 'Missing parameters' })

  // Load invoice
  const invoices = await fetchInvoicesForProject(year, projectId)
  const inv = invoices.find((i) => i.invoiceNumber === invoiceNumber)
  if (!inv) return res.status(404).json({ error: 'Invoice not found' })

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
      React.createElement(Text, { style: styles.itemUnit }, typeof it.unitPrice === 'number' ? amount(it.unitPrice) : ''),
      React.createElement(Text, { style: styles.itemTotal }, amount(total)),
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
          React.createElement(Text, null, new Date().toLocaleDateString()),
        ),
      ),
      React.createElement(View, { style: styles.divider }),
      ...items,
      React.createElement(
        View,
        { style: styles.totalRow },
        React.createElement(Text, { style: styles.totalLabel }, 'Total:'),
        React.createElement(Text, { style: styles.totalValue }, amount(inv.amount)),
      ),
      inv.paidTo ? React.createElement(Text, null, `To: ${inv.paidTo}`) : null,
      inv.paymentStatus ? React.createElement(Text, null, inv.paymentStatus) : null,
    ),
  )
  const anyBuf: any = await pdf(docEl).toBuffer()
  const pdfBuf: Buffer = Buffer.isBuffer(anyBuf) ? anyBuf : Buffer.from(anyBuf)

  // Upload to Drive
  const yearFolderId = await ensureYearFolder(DRIVE_ROOT_FOLDER, year)
  const filename = `Invoice-${inv.invoiceNumber}.pdf`
  const { fileId } = await uploadPdfBuffer(yearFolderId, filename, pdfBuf)

  // Persist metadata on invoice doc (admin path)
  try {
    const fs = getAdminFirestore(PROJECTS_FIRESTORE_DATABASE_ID)
    const docRef = fs.collection('projects').doc(year).collection('projects').doc(projectId).collection('invoice').doc(inv.invoiceNumber)
    await docRef.set({ pdfFileId: fileId, pdfHash: hash, pdfGeneratedAt: new Date().toISOString() }, { merge: true })
  } catch {}

  // Return PDF for browser download
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send(Buffer.from(pdfBuf))
}
