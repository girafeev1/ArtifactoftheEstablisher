// pages/api/invoices/InvoiceGenerator.ts

import { applyDimensions } from '../../../lib/utils';
import { applyBasicInfoFormatting } from './BasicInfo';
import { applyBillToFormatting } from './BillTo';
import { applyInvoiceDetailsFormatting } from './InvoiceDetails';

const COLUMN_WIDTHS = [
  { startIndex: 0, endIndex: 1, size: 28 },
  { startIndex: 1, endIndex: 2, size: 48 },
  { startIndex: 2, endIndex: 3, size: 26 },
  { startIndex: 3, endIndex: 4, size: 26 },
  { startIndex: 4, endIndex: 5, size: 185 },
  { startIndex: 5, endIndex: 6, size: 226 },
  { startIndex: 6, endIndex: 7, size: 110 },
  { startIndex: 7, endIndex: 8, size: 63 },
  { startIndex: 8, endIndex: 9, size: 16 },
  { startIndex: 9, endIndex: 10, size: 14 },
  { startIndex: 10, endIndex: 11, size: 128 },
];

export const applyInvoiceFormatting = (sheetId: number) => {
  const requests = [
    ...applyDimensions(sheetId, "COLUMNS", COLUMN_WIDTHS),
    ...applyBasicInfoFormatting(sheetId),
    ...applyBillToFormatting(sheetId),
    ...applyInvoiceDetailsFormatting(sheetId),
  ];
  return requests;
};
