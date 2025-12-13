import type { NextApiRequest, NextApiResponse } from 'next'
import ExcelJS from 'exceljs'
import { doc as docFs, getDoc } from 'firebase/firestore'
import { fetchInvoicesForProject } from '../../../../../../lib/projectInvoices'
import { projectsDb } from '../../../../../../lib/firebase'
import { fetchSubsidiaryById } from '../../../../../../lib/subsidiaries'
import { resolveBankAccountIdentifier } from '../../../../../../lib/erlDirectory'
import { representativeToDisplay } from '../../../../../../lib/representative'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { year, projectId, invoiceNumber } = req.query

  if (typeof year !== 'string' || typeof projectId !== 'string' || typeof invoiceNumber !== 'string') {
    return res.status(400).send('Invalid request parameters')
  }

  try {
    // Load project (for subsidiary metadata) — prefer nested path
    const projectSnap = await getDoc(docFs(projectsDb, 'projects', year, 'projects', projectId))
    if (!projectSnap.exists()) {
      const legacySnap = await getDoc(docFs(projectsDb, year, projectId))
      if (!legacySnap.exists()) {
        return res.status(404).send('Project not found')
      }
    }

    const projectData = projectSnap.exists() ? projectSnap.data() : null

    // Fetch invoices via shared library
    const invoices = await fetchInvoicesForProject(year, projectId)
    const invoice = invoices.find((inv) => inv.invoiceNumber === invoiceNumber)
    if (!invoice) {
      return res.status(404).send('Invoice not found')
    }

    // Resolve subsidiary + bank metadata used in the PDF layout so the XLSX
    // has the same underlying data for diagnosis.
    const subsidiaryId = (projectData as any)?.subsidiaryId || (projectData as any)?.subsidiary || null
    const subsidiary = subsidiaryId ? await fetchSubsidiaryById(subsidiaryId) : null
    const bankDetails = invoice.paidTo ? await resolveBankAccountIdentifier(invoice.paidTo) : null

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Invoice')

    sheet.columns = [
      { header: 'Field', key: 'field', width: 32 },
      { header: 'Value', key: 'value', width: 64 },
    ]

    const add = (field: string, value: unknown) =>
      sheet.addRow({ field, value: value == null ? '' : String(value) })

    // High‑level invoice metadata
    add('Invoice Number', invoice.invoiceNumber)
    add('Invoice Date', invoice.updatedAt || invoice.createdAt || '')
    add('Project Number', (projectData as any)?.projectNumber || projectId)
    add('Project Title', (projectData as any)?.projectTitle ?? (projectData as any)?.projectName ?? '')
    add('Project Nature', (projectData as any)?.projectNature ?? '')
    add('Presenter / Worktype', (projectData as any)?.presenterWorkType ?? (projectData as any)?.presenter_worktype ?? '')

    sheet.addRow({})

    // Bill‑to client info
    add('Client Company', invoice.companyName || '')
    add('Client Address Line 1', invoice.addressLine1 || '')
    add('Client Address Line 2', invoice.addressLine2 || '')
    add('Client Address Line 3', invoice.addressLine3 || '')
    add('Client Region', invoice.region || '')
    add('Client Representative', representativeToDisplay(invoice.representative) || '')

    sheet.addRow({})

    // Subsidiary / beneficiary info
    add('Subsidiary English Name', subsidiary?.englishName ?? '')
    add('Subsidiary Chinese Name', subsidiary?.chineseName ?? '')
    add('Subsidiary Address Line 1', subsidiary?.addressLine1 ?? '')
    add('Subsidiary Address Line 2', subsidiary?.addressLine2 ?? '')
    add('Subsidiary Address Line 3', subsidiary?.addressLine3 ?? '')
    add('Subsidiary Region', subsidiary?.region ?? '')
    add('Subsidiary Phone', subsidiary?.phone ?? '')
    add('Subsidiary Email', subsidiary?.email ?? '')

    sheet.addRow({})

    // Bank / payment identifiers
    add('Paid To (Identifier)', invoice.paidTo ?? '')
    add('Bank Name', bankDetails?.bankName ?? '')
    add('Bank Code', bankDetails?.bankCode ?? '')
    add('Bank Account Number', bankDetails?.accountNumber ?? '')
    add('FPS ID', (bankDetails as any)?.fpsId ?? '')

    sheet.addRow({})

    // Items section – one row per item with key details for alignment checks.
    sheet.addRow({ field: 'Items', value: '' })
    sheet.addRow({ field: 'Title', value: 'UnitPrice / Quantity / QuantityUnit / FeeType / Notes' })

    for (const item of invoice.items as any[]) {
      const summary = [
        item.unitPrice != null ? `HK$ ${item.unitPrice.toFixed?.(2) ?? item.unitPrice}` : '',
        item.quantity != null ? `x${item.quantity}` : '',
        item.quantityUnit ? `/${item.quantityUnit}` : '',
        item.feeType ? `; ${item.feeType}` : '',
        item.notes ? `; ${item.notes}` : '',
      ]
        .join(' ')
        .trim()
      sheet.addRow({
        field: item.title || '',
        value: summary,
      })
    }

    // Adjust header row style a bit for readability (not critical for diagnosis)
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true }

    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${invoiceNumber}.xlsx"`,
    )
    res.status(200).send(Buffer.from(buffer))
  } catch (error) {
    console.error('Error generating XLSX invoice:', error)
    res.status(500).send('Error generating XLSX invoice')
  }
}

export default handler
