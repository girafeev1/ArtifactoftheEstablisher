// pages/api/invoices/BillTo.ts

import {
  applyDimensions,
  createMergeRequests,
  applyCellFormatting,
  applyBackgroundColors,
} from '../../../lib/googleSheetUtils';

export const applyBillToFormatting = (sheetId: number, billToData: any = {}) => {
  // Safely destructure billToData with defaults
  const {
    companyName = "Tsz Shan Monastery Limited",
    addressLine1 = "25/F, Neich Tower",
    addressLine2 = "128 Gloucester Road",
    addressLine3 = "Wan Chai, Hong Kong",
    invoiceNumber = "#2024-1025-016",
  } = billToData || {};

  console.log('[applyBillToFormatting] Using billToData:', {
    companyName,
    addressLine1,
    addressLine2,
    addressLine3,
    invoiceNumber,
  });

  const requests = [
    ...applyDimensions(sheetId, "ROWS", [
      { startIndex: 6, endIndex: 7, size: 43 },
      { startIndex: 7, endIndex: 8, size: 29 },
      { startIndex: 8, endIndex: 9, size: 25 },
      { startIndex: 9, endIndex: 12, size: 21 },
      { startIndex: 12, endIndex: 13, size: 21 },
      { startIndex: 13, endIndex: 14, size: 2 },
      { startIndex: 14, endIndex: 15, size: 53 },
    ]),
    ...createMergeRequests(sheetId, [
      { startRowIndex: 6, endRowIndex: 7, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 6, endRowIndex: 7, startColumnIndex: 7, endColumnIndex: 10 },
      { startRowIndex: 7, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 8, endRowIndex: 9, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 9, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 10, endRowIndex: 11, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 11, endRowIndex: 12, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 12, endRowIndex: 13, startColumnIndex: 1, endColumnIndex: 4 },
    ]),
    ...applyCellFormatting(sheetId, [
      { row: 6, col: 1, value: "Bill To", runs: [{ start: 0, end: 7, format: { fontFamily: "Courier New", fontSize: 19, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 7, col: 1, value: companyName, runs: [{ start: 0, end: companyName.length, format: { fontFamily: "Google Sans Mono", fontSize: 14, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 8, col: 1, value: addressLine1, runs: [{ start: 0, end: addressLine1.length, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 9, col: 1, value: addressLine2, runs: [{ start: 0, end: addressLine2.length, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 9, col: 10, value: "Invoice #", runs: [{ start: 0, end: 9, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "BOTTOM" } },
      { row: 10, col: 1, value: addressLine3, runs: [{ start: 0, end: addressLine3.length, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 10, col: 10, value: invoiceNumber, runs: [{ start: 0, end: invoiceNumber.length, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "TOP" } },
      { row: 12, col: 1, value: "Issued Date:", runs: [{ start: 0, end: 12, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 12, col: 4, value: new Date().toISOString(), runs: [{ start: 0, end: new Date().toISOString().length, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "BOTTOM" } },
    ]),
    ...applyBackgroundColors(sheetId, []),
  ];
  return requests;
};
