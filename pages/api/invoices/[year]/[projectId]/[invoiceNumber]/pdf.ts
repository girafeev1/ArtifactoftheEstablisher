import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import * as ReactPdf from '@react-pdf/renderer';
const { pdf } = ReactPdf;
import { doc as docFs, getDoc } from 'firebase/firestore';
import { buildClassicInvoiceDocument, type ClassicInvoiceDocInput, type ClassicInvoiceVariant } from '../../../../../../lib/pdfTemplates/classicInvoice';
import { projectsDb } from '../../../../../../lib/firebase';
import { fetchSubsidiaryById } from '../../../../../../lib/subsidiaries';
import { resolveBankAccountIdentifier } from '../../../../../../lib/erlDirectory';

const VARIANTS: ClassicInvoiceVariant[] = ['bundle', 'A', 'A2', 'B', 'B2'];

const computeHash = (obj: any): string =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');

const parseVariant = (raw: string | undefined | null): ClassicInvoiceVariant => {
  if (!raw) return 'bundle';
  const normalized = raw.trim();
  return (VARIANTS.includes(normalized as ClassicInvoiceVariant) ? normalized : 'bundle') as ClassicInvoiceVariant;
};

// ... (keep all helper functions: toStringValue, toNumberValue, etc.)

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { year, projectId, invoiceNumber, variant: variantQuery } = req.query;

  if (typeof year !== 'string' || typeof projectId !== 'string' || typeof invoiceNumber !== 'string') {
    return res.status(400).send('Invalid request parameters');
  }

  try {
    const projectSnap = await getDoc(docFs(projectsDb, 'projects', year, 'projects', projectId));
    if (!projectSnap.exists()) {
      return res.status(404).send('Project not found');
    }
    const projectData = projectSnap.data();
    const invoice = projectData?.invoices?.[invoiceNumber];
    if (!invoice) {
      return res.status(404).send('Invoice not found');
    }

    const subsidiary = await fetchSubsidiaryById(projectData.subsidiaryId);
    const bankDetails = await resolveBankAccountIdentifier(invoice.paidTo);

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
      subsidiaryAddressLines: subsidiary?.addressLines,
      subsidiaryPhone: subsidiary?.phone,
      subsidiaryEmail: subsidiary?.email,
      paidTo: bankDetails?.beneficiaryName,
      bankName: bankDetails?.bankName,
      bankCode: bankDetails?.bankCode,
      bankAccountNumber: bankDetails?.accountNumber,
      fpsId: bankDetails?.fpsId,
      sheetData: null, // We are not using live sheet data anymore
    };

    const variant = parseVariant(variantQuery as string);
    
    // --- START DEBUG LOGGING ---
    console.log('--- PDF GENERATION ---');
    console.log('Using variant:', variant);
    console.log('Passing invoice data to document builder:', JSON.stringify(invoiceData, null, 2));
    // --- END DEBUG LOGGING ---

    const doc = buildClassicInvoiceDocument(invoiceData, { variant });
    const stream = await pdf(doc).toStream();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceNumber}.pdf"`);
    
    stream.pipe(res);
    stream.on('end', () => {});

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
};

export default handler;