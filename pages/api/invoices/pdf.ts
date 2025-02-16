// pages/api/invoices/pdf.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { getAuthOptions } from '../auth/[...nextauth]';
import { initializeApis } from '../../../lib/googleApi';
import PDFDocument from 'pdfkit';

export const config = {
  api: {
    // If you need a big PDF, you might set bodyParser false
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authOptions = await getAuthOptions();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.accessToken) {
      return res.status(401).send('Unauthorized');
    }

    const fileId = req.query.fileId as string;
    const invoice = req.query.invoice as string;
    if (!fileId || !invoice) {
      return res.status(400).send('Missing fileId or invoice');
    }

    // Example: you might fetch the invoice tab data here
    // const { sheets } = initializeApis('user', { accessToken: session.accessToken as string });
    // do something like: find the sheet tab with title=invoice, read the line items, etc.

    // We'll build a simple PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    // Because we stream, we can't call res.json afterwards
    doc.pipe(res);

    doc.fontSize(20).text(Invoice: ${invoice});
    doc.moveDown();
    doc.fontSize(12).text(This is a sample PDF for invoice "${invoice}".);
    // ... add more fancy layout, images, etc. ...
    doc.end();
  } catch (err: any) {
    console.error('[GET /api/invoices/pdf] error:', err);
    res.status(500).send(err.message || 'Internal Server Error');
  }
}
