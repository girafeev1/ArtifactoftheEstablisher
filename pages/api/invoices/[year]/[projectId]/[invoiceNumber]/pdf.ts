import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import * as ReactPdf from '@react-pdf/renderer'
const { pdf } = ReactPdf
import { doc as docFs, getDoc } from 'firebase/firestore'
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
    const projectSnap = await getDoc(docFs(projectsDb, 'projects', year, 'projects', projectId))
    if (!projectSnap.exists()) {
      return res.status(404).send('Project not found')
    }
    const projectData = projectSnap.data()
    const invoice = (projectData as any)?.invoices?.[invoiceNumber]
    if (!invoice) {
      return res.status(404).send('Invoice not found')
    }

    const subsidiary = await fetchSubsidiaryById((projectData as any).subsidiaryId)
    const bankDetails = await resolveBankAccountIdentifier(invoice.paidTo)

    const invoiceData: ClassicInvoiceDocInput = {
      // --- Map your invoice and project data here ---
      invoiceNumber: invoice.invoiceNumber,
      invoiceDateDisplay: invoice.invoiceDate,
      companyName: projectData.clientName,
      addressLine1: projectData.clientAddressLine1,
      addressLine2: projectData.clientAddressLine2,
      addressLine3: projectData.clientAddressLine3,
      region: projectData.clientRegion,
      representative: projectData.clientContactPerson,
      projectTitle: projectData.projectName,
      projectNature: projectData.projectNature,
      items: invoice.items,
      total: invoice.totalAmount,
      // --- Map subsidiary and bank details ---
      subsidiaryEnglishName: subsidiary?.englishName,
      subsidiaryChineseName: subsidiary?.chineseName,
      subsidiaryAddressLines: subsidiary?.addressLine1 ? [subsidiary.addressLine1] : [],
      subsidiaryPhone: subsidiary?.phone,
      subsidiaryEmail: subsidiary?.email,
      paidTo: bankDetails?.bankName,
      bankName: bankDetails?.bankName,
      bankCode: bankDetails?.bankCode,
      bankAccountNumber: bankDetails?.accountNumber,
      fpsId: bankDetails?.fpsId,
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
