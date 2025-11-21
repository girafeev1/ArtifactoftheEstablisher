import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { pdf } from '@react-pdf/renderer'
import { doc, getDoc } from 'firebase/firestore'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import { buildGeneratedInvoiceDocument } from '../../../../../../lib/pdfTemplates/generatedInvoicePdf'
import { FONT_DATA } from '../../../../../../lib/pdfTemplates/fontData'
import { projectsDb } from '../../../../../../lib/firebase'
import { fetchSubsidiaryById } from '../../../../../../lib/subsidiaries'
import { resolveBankAccountIdentifier } from '../../../../../../lib/erlDirectory'

const computeHash = (obj: any): string =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')



const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

const toNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

const formatDisplayDate = (value: unknown): string | null => {
  if (!value) return null
  const fromString = toStringValue(value)
  if (!fromString) return null
  const parsed = new Date(fromString)
  if (Number.isNaN(parsed.getTime())) return fromString
  return parsed.toLocaleDateString('en-HK', { month: 'short', day: '2-digit', year: 'numeric' })
}

const fallbackSubsidiaryProfile = {
  englishName: 'Establish Records Limited',
  chineseName: '別樹唱片有限公司',
  addressLines: [
    '1/F 18 Wang Toi Shan Leung Uk Tsuen',
    'Yuen Long Pat Heung',
    'N.T.',
    'Hong Kong',
  ],
  phone: '+(852) 6694 9527',
  email: 'account@establishrecords.com',
}

const fetchProjectSnapshot = async (year: string, projectId: string) => {
  try {
    const nested = doc(projectsDb, 'projects', year, 'projects', projectId)
    const nestedSnap = await getDoc(nested)
    if (nestedSnap.exists()) {
      return nestedSnap
    }
  } catch {
    // ignore nested errors and fall back
  }
  try {
    const legacy = doc(projectsDb, year, projectId)
    const legacySnap = await getDoc(legacy)
    if (legacySnap.exists()) {
      return legacySnap
    }
  } catch {
    // ignore
  }
  return null
}

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
    try { console.error('[pdf] fetch error', { error: error?.message || String(error) }) } catch {
      /* ignore logging errors */
    }
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
    const perPage = 28;
    const pages = Math.max(1, Math.ceil(lines / perPage))
    return res.status(200).json({ itemsPages: pages })
  }

  const projectSnap = await fetchProjectSnapshot(year, projectId)
  const projectData = projectSnap?.data() ?? null
  const projectTitle = toStringValue(projectData?.projectTitle) ?? toStringValue(inv.projectTitle)
  const presenterWorkType =
    toStringValue(projectData?.presenterWorkType) ?? toStringValue(inv.presenterWorkType)
  const projectNature = toStringValue(projectData?.projectNature) ?? toStringValue(inv.projectNature)
  const projectNumber = toStringValue(projectData?.projectNumber) ?? toStringValue(inv.projectNumber)
  const projectDate = formatDisplayDate(
    (projectData as any)?.projectDateDisplay ??
      (projectData as any)?.projectDateIso ??
      (projectData as any)?.projectDate ??
      inv.projectDateDisplay ??
      inv.projectDateIso ??
      inv.projectDate ??
      null,
  )
  const projectPickupDate = formatDisplayDate((projectData as any)?.projectPickupDate ?? null)
  const subsidiaryId = toStringValue((projectData as any)?.subsidiary ?? inv.subsidiary ?? null)
  let subsidiaryDoc: Awaited<ReturnType<typeof fetchSubsidiaryById>> | null = null
  if (subsidiaryId) {
    try {
      subsidiaryDoc = await fetchSubsidiaryById(subsidiaryId)
    } catch {
      subsidiaryDoc = null
    }
  }
  const subsidiaryProfile = {
    englishName:
      toStringValue(subsidiaryDoc?.englishName) ?? fallbackSubsidiaryProfile.englishName,
    chineseName:
      toStringValue(subsidiaryDoc?.chineseName) ?? fallbackSubsidiaryProfile.chineseName,
    addressLines: [
      toStringValue((subsidiaryDoc as any)?.addressLine1),
      toStringValue((subsidiaryDoc as any)?.addressLine2),
      toStringValue((subsidiaryDoc as any)?.addressLine3),
      toStringValue((subsidiaryDoc as any)?.region),
    ].filter((line): line is string => Boolean(line && line.trim())),
    phone: toStringValue(subsidiaryDoc?.phone) ?? fallbackSubsidiaryProfile.phone,
    email: toStringValue(subsidiaryDoc?.email) ?? fallbackSubsidiaryProfile.email,
  }
  if (!subsidiaryProfile.addressLines.length) {
    subsidiaryProfile.addressLines = [...fallbackSubsidiaryProfile.addressLines]
  }

  const normalizedItems = (Array.isArray(inv.items) ? inv.items : []).map((item: any) => ({
    title: toStringValue(item.title),
    subQuantity: toStringValue(item.subQuantity),
    feeType: toStringValue(item.feeType),
    notes: toStringValue(item.notes),
    unitPrice: toNumberValue(item.unitPrice),
    quantity: toNumberValue(item.quantity),
    quantityUnit: toStringValue(item.quantityUnit),
    discount: toNumberValue(item.discount),
  }))

  let bankProfile: Awaited<ReturnType<typeof resolveBankAccountIdentifier>> | null = null
  if (typeof inv.paidTo === 'string' && inv.paidTo.trim()) {
    try {
      bankProfile = await resolveBankAccountIdentifier(inv.paidTo.trim())
    } catch {
      bankProfile = null
    }
  }

  const bankName = toStringValue(inv.bankName) ?? toStringValue(bankProfile?.bankName)
  const bankCode = toStringValue(inv.bankCode) ?? toStringValue(bankProfile?.bankCode)
  const accountType = toStringValue(inv.accountType) ?? toStringValue(bankProfile?.accountType)
  const accountNumber = toStringValue((inv as any)?.bankAccountNumber) ?? toStringValue(bankProfile?.accountNumber)
  const fpsId = toStringValue((inv as any)?.fpsId) ?? toStringValue(bankProfile?.fpsId)
  const fpsEmail = toStringValue((inv as any)?.fpsEmail) ?? toStringValue(bankProfile?.fpsEmail)
  const paidToLabel =
    toStringValue((inv as any)?.paidToLabel) ??
    toStringValue((inv as any)?.payeeName) ??
    toStringValue(inv.paidTo) ??
    subsidiaryProfile.englishName

  const paymentStatus = toStringValue(inv.paymentStatus) ?? 'Due'
  const subtotalValue = typeof inv.subtotal === 'number' ? inv.subtotal : null
  const totalValue = typeof inv.total === 'number' ? inv.total : null
  const amountValue = typeof inv.amount === 'number' ? inv.amount : null
  const taxOrDiscountPercent =
    typeof inv.taxOrDiscountPercent === 'number' ? inv.taxOrDiscountPercent : null
  const invoiceDateDisplay = new Date().toLocaleDateString('en-HK', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
  const paymentTerms =
    toStringValue((inv as any)?.paymentTerms) ?? 'FULL PAYMENT WITHIN 7 DAYS'

  const model = {
    invoiceNumber: inv.invoiceNumber,
    companyName: inv.companyName,
    addressLine1: inv.addressLine1,
    addressLine2: inv.addressLine2,
    addressLine3: inv.addressLine3,
    region: inv.region,
    representative: inv.representative,
    items: normalizedItems,
    amount: amountValue,
    paymentStatus,
    paidTo: paidToLabel,
    projectTitle,
    presenterWorkType,
    projectNature,
    projectNumber,
    projectDate,
  }
  const hash = computeHash(model)
  try { console.info('[pdf] build model hash', { hash }) } catch {
    /* ignore logging errors */
  }

  // Font presence snapshot (helps diagnose font registration issues in serverless)
  try {
    console.info('[pdf][fonts] presence', {
      hasRobotoRegular: Boolean((FONT_DATA as any)['RobotoMono-Regular.ttf']),
      hasRobotoBold: Boolean((FONT_DATA as any)['RobotoMono-Bold.ttf']),
      hasVarelaRound: Boolean((FONT_DATA as any)['VarelaRound-Regular.ttf']),
      hasRampartOne: Boolean((FONT_DATA as any)['RampartOne-Regular.ttf']),
      hasIansui: Boolean((FONT_DATA as any)['Iansui-Regular.ttf']),
    })
  } catch {
    /* ignore font presence logging errors */
  }

  const docInput = {
    invoiceNumber: inv.invoiceNumber,
    invoiceDateDisplay,
    companyName: inv.companyName ?? null,
    addressLine1: inv.addressLine1 ?? null,
    addressLine2: inv.addressLine2 ?? null,
    addressLine3: inv.addressLine3 ?? null,
    region: inv.region ?? null,
    representative: inv.representative ?? null,
    presenterWorkType: presenterWorkType ?? null,
    projectTitle: projectTitle ?? null,
    projectNature: projectNature ?? null,
    projectNumber: projectNumber ?? null,
    projectDate: projectDate ?? null,
    projectPickupDate: projectPickupDate ?? null,
    subsidiaryEnglishName: subsidiaryProfile.englishName,
    subsidiaryChineseName: subsidiaryProfile.chineseName ?? null,
    subsidiaryAddressLines: subsidiaryProfile.addressLines,
    subsidiaryPhone: subsidiaryProfile.phone,
    subsidiaryEmail: subsidiaryProfile.email,
    items: normalizedItems,
    subtotal: subtotalValue,
    total: totalValue,
    amount: amountValue,
    taxOrDiscountPercent,
    paidTo: paidToLabel,
    paymentStatus,
    bankName,
    bankCode,
    accountType,
    bankAccountNumber: accountNumber,
    fpsId,
    fpsEmail,
    paymentTerms,
  }

  const bufferFromStream = (stream: any): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', (err: any) => reject(err))
    })

  const bufferFromWebStream = async (webStream: any): Promise<Buffer> => {
    try {
      const reader = webStream.getReader()
      const chunks: Buffer[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(Buffer.from(value))
      }
      return Buffer.concat(chunks)
    } catch (err) {
      throw err
    }
  }

  let pdfBuffer: Buffer
  try {
    const document = buildGeneratedInvoiceDocument(docInput as any);
    const instance = pdf(document)
    const rendered: any = await instance.toBuffer()
    if (Buffer.isBuffer(rendered)) {
      pdfBuffer = rendered
    } else if (
      rendered instanceof Uint8Array ||
      (typeof rendered === 'object' && rendered && typeof (rendered as any).byteLength === 'number')
    ) {
      pdfBuffer = Buffer.from(rendered as Uint8Array)
    } else if (rendered && typeof (rendered as any).getReader === 'function') {
      // Web ReadableStream (browser-like)
      pdfBuffer = await bufferFromWebStream(rendered)
    } else if (rendered && typeof (rendered as any).on === 'function' && typeof (rendered as any).pipe === 'function') {
      // Node.js readable stream (or pdfkit doc)
      pdfBuffer = await bufferFromStream(rendered)
    } else {
      // Final attempt: render directly to stream via renderer API
      const { renderToStream } = await import('@react-pdf/renderer')
      const stream: any = await renderToStream(document as any)
      if (stream && typeof stream.getReader === 'function') {
        pdfBuffer = await bufferFromWebStream(stream)
      } else {
        pdfBuffer = await bufferFromStream(stream)
      }
    }
  } catch (renderError: any) {
    const errorMessage = renderError?.message || String(renderError)
    try { console.error('[pdf] react-pdf render failed', { error: errorMessage }) } catch {
      /* ignore logging errors */
    }
    if ((req.query.debug as string) === '1') {
      return res.status(500).send(`Failed to render PDF: ${errorMessage}`)
    }
    try {
      const { default: PDFDocument } = await import('pdfkit')
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
      try { console.error('[pdf] fallback render failed', { error: fallbackError?.message || String(fallbackError) }) } catch {
        /* ignore logging errors */
      }
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
