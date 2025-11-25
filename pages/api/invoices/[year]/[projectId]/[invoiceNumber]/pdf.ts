import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import * as ReactPdf from '@react-pdf/renderer'
const { pdf } = ReactPdf
import { doc as docFs, getDoc } from 'firebase/firestore'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import {
  buildClassicInvoiceDocument,
  type ClassicInvoiceDocInput,
  type ClassicInvoiceVariant,
} from '../../../../../../lib/pdfTemplates/classicInvoice'
import { projectsDb } from '../../../../../../lib/firebase'
import { fetchSubsidiaryById } from '../../../../../../lib/subsidiaries'
import { resolveBankAccountIdentifier } from '../../../../../../lib/erlDirectory'

const VARIANTS: ClassicInvoiceVariant[] = ['bundle', 'A', 'A2', 'B', 'B2']

const computeHash = (obj: any): string =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')

const parseVariant = (raw: string | undefined | null): ClassicInvoiceVariant => {
  if (!raw) return 'bundle'
  const normalized = raw.trim()
  return (VARIANTS.includes(normalized as ClassicInvoiceVariant) ? normalized : 'bundle') as ClassicInvoiceVariant
}

// Helpers for converting different stream outputs to a Node Buffer
const bufferFromNodeStream = (stream: any): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', (err: any) => reject(err))
  })

const bufferFromWebStream = async (webStream: any): Promise<Buffer> => {
  const reader = webStream.getReader()
  const chunks: Buffer[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks)
}

// ... (keep all helper functions: toStringValue, toNumberValue, etc.)

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { year, projectId, invoiceNumber, variant: variantQuery } = req.query

  if (typeof year !== 'string' || typeof projectId !== 'string' || typeof invoiceNumber !== 'string') {
    return res.status(400).send('Invalid request parameters')
  }

  try {
    // Load project (for subsidiary metadata) — prefer nested path
    const projectSnap = await getDoc(docFs(projectsDb, 'projects', year, 'projects', projectId))
    if (!projectSnap.exists()) {
      // Fall back to legacy root if nested is missing
      const legacySnap = await getDoc(docFs(projectsDb, year, projectId))
      if (!legacySnap.exists()) {
        return res.status(404).send('Project not found')
      }
    }

    // Fetch invoices via our library (works with current Firestore layout)
    const invoices = await fetchInvoicesForProject(year, projectId)
    const invoice = invoices.find((inv) => inv.invoiceNumber === invoiceNumber)
    if (!invoice) {
      return res.status(404).send('Invoice not found')
    }

    const projectData = projectSnap.exists() ? projectSnap.data() : null
    const subsidiaryId = (projectData as any)?.subsidiaryId || (projectData as any)?.subsidiary || null
    const subsidiary = subsidiaryId ? await fetchSubsidiaryById(subsidiaryId) : null
    const bankDetails = invoice.paidTo ? await resolveBankAccountIdentifier(invoice.paidTo) : null

    const invoiceData: ClassicInvoiceDocInput = {
      // --- Map your invoice and project data here ---
      invoiceNumber: invoice.invoiceNumber,
      invoiceDateDisplay: invoice.updatedAt || invoice.createdAt || null,
      companyName: invoice.companyName,
      addressLine1: invoice.addressLine1,
      addressLine2: invoice.addressLine2,
      addressLine3: invoice.addressLine3,
      region: invoice.region,
      representative: invoice.representative,
      projectTitle: (projectData as any)?.projectTitle ?? (projectData as any)?.projectName ?? null,
      projectNature: (projectData as any)?.projectNature ?? null,
      items: invoice.items as any,
      subtotal: invoice.subtotal ?? null,
      total: invoice.total ?? invoice.amount ?? null,
      // --- Map subsidiary and bank details ---
      subsidiaryEnglishName: subsidiary?.englishName ?? null,
      subsidiaryChineseName: subsidiary?.chineseName ?? null,
      // Include all known lines + region to mirror the sheet header block
      subsidiaryAddressLines: (
        subsidiary
          ? [
              subsidiary.addressLine1 || null,
              subsidiary.addressLine2 || null,
              subsidiary.addressLine3 || null,
              subsidiary.region ? `${subsidiary.region}` : null,
            ].filter((v): v is string => Boolean(v && v.trim()))
          : undefined
      ),
      subsidiaryPhone: subsidiary?.phone ?? null,
      subsidiaryEmail: subsidiary?.email ?? null,
      paidTo: invoice.paidTo ?? null,
      bankName: bankDetails?.bankName ?? null,
      bankCode: bankDetails?.bankCode ?? null,
      bankAccountNumber: bankDetails?.accountNumber ?? null,
      fpsId: (bankDetails as any)?.fpsId ?? null,
      sheetData: null, // We are not using live sheet data anymore
    }

    const variant = parseVariant(variantQuery as string)
    
    // --- START DEBUG LOGGING ---
    console.log('--- PDF GENERATION ---')
    console.log('Using variant:', variant)
    console.log('Passing invoice data to document builder:', JSON.stringify(invoiceData, null, 2))
    // --- END DEBUG LOGGING ---

    const doc = buildClassicInvoiceDocument(invoiceData, { variant })
    const instance: any = pdf(doc)

    let buffer: Buffer
    try {
      const out: any = await (instance.toBuffer?.() ?? instance.toBlob?.())
      if (out && typeof out.getReader === 'function') {
        buffer = await bufferFromWebStream(out)
      } else if (out && typeof out.pipe === 'function') {
        buffer = await bufferFromNodeStream(out)
      } else if (Buffer.isBuffer(out)) {
        buffer = out
      } else if (typeof instance.toString === 'function') {
        const str = await instance.toString()
        buffer = Buffer.from(str, 'binary')
      } else {
        throw new Error('Unknown PDF output type')
      }
    } catch (e) {
      console.error('[pdf] Failed to obtain buffer, attempting toString fallback', e)
      const str = await instance.toString()
      buffer = Buffer.from(str, 'binary')
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceNumber}.pdf"`)
    res.setHeader('Content-Length', String(buffer.length))
    res.status(200).send(buffer)

  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).send('Error generating PDF')
  }
}

export default handler
