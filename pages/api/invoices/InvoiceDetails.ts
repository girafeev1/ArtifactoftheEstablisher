// pages/api/invoices/InvoiceDetails.ts

import { applyDimensions, createMergeRequests, applyCellFormatting, applyBorders, applyBackgroundColors } from '../../../lib/utils';

export const applyInvoiceDetailsFormatting = (sheetId: number) => {
  const requests = [
    ...applyDimensions(sheetId, "ROWS", [
      { startIndex: 15, endIndex: 16, size: 53 },
      { startIndex: 16, endIndex: 17, size: 2 },
      { startIndex: 17, endIndex: 18, size: 15 },
      { startIndex: 18, endIndex: 19, size: 17 },
      { startIndex: 19, endIndex: 20, size: 38 },
      { startIndex: 20, endIndex: 21, size: 14 },
      { startIndex: 21, endIndex: 23, size: 21 },
      { startIndex: 23, endIndex: 24, size: 23 },
      { startIndex: 24, endIndex: 25, size: 21 },
      { startIndex: 25, endIndex: 27, size: 14 },
      { startIndex: 27, endIndex: 30, size: 21 },
      { startIndex: 30, endIndex: 32, size: 14 },
      { startIndex: 32, endIndex: 33, size: 25 },
      { startIndex: 33, endIndex: 34, size: 23 },
      { startIndex: 34, endIndex: 35, size: 21 },
      { startIndex: 35, endIndex: 37, size: 14 },
      { startIndex: 37, endIndex: 38, size: 25 },
      { startIndex: 38, endIndex: 39, size: 22 },
      { startIndex: 39, endIndex: 40, size: 21 },
      { startIndex: 40, endIndex: 41, size: 25 },
      { startIndex: 41, endIndex: 42, size: 21 },
      { startIndex: 42, endIndex: 43, size: 21 },
      { startIndex: 43, endIndex: 44, size: 21 },
      { startIndex: 44, endIndex: 45, size: 22 },
      { startIndex: 45, endIndex: 46, size: 29 },
      { startIndex: 46, endIndex: 47, size: 19 },
      { startIndex: 47, endIndex: 57, size: 21 },
    ]),
    ...createMergeRequests(sheetId, [
      { startRowIndex: 15, endRowIndex: 16, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 15, endRowIndex: 16, startColumnIndex: 7, endColumnIndex: 11 },
      { startRowIndex: 18, endRowIndex: 19, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 19, endRowIndex: 20, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 20, endRowIndex: 21, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 22, endRowIndex: 23, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 22, endRowIndex: 24, startColumnIndex: 8, endColumnIndex: 10 },
      { startRowIndex: 22, endRowIndex: 24, startColumnIndex: 10, endColumnIndex: 11 },
      { startRowIndex: 23, endRowIndex: 24, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 24, endRowIndex: 25, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 27, endRowIndex: 28, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 27, endRowIndex: 29, startColumnIndex: 8, endColumnIndex: 10 },
      { startRowIndex: 27, endRowIndex: 29, startColumnIndex: 10, endColumnIndex: 11 },
      { startRowIndex: 28, endRowIndex: 29, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 29, endRowIndex: 30, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 32, endRowIndex: 33, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 32, endRowIndex: 34, startColumnIndex: 8, endColumnIndex: 10 },
      { startRowIndex: 32, endRowIndex: 34, startColumnIndex: 10, endColumnIndex: 11 },
      { startRowIndex: 33, endRowIndex: 34, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 34, endRowIndex: 35, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 37, endRowIndex: 38, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 37, endRowIndex: 39, startColumnIndex: 8, endColumnIndex: 10 },
      { startRowIndex: 37, endRowIndex: 39, startColumnIndex: 10, endColumnIndex: 11 },
      { startRowIndex: 38, endRowIndex: 39, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 39, endRowIndex: 40, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 40, endRowIndex: 41, startColumnIndex: 1, endColumnIndex: 6 },
      { startRowIndex: 40, endRowIndex: 41, startColumnIndex: 6, endColumnIndex: 10 },
      { startRowIndex: 44, endRowIndex: 47, startColumnIndex: 5, endColumnIndex: 6 },
      { startRowIndex: 44, endRowIndex: 45, startColumnIndex: 6, endColumnIndex: 11 },
      { startRowIndex: 45, endRowIndex: 46, startColumnIndex: 8, endColumnIndex: 11 },
      { startRowIndex: 46, endRowIndex: 47, startColumnIndex: 6, endColumnIndex: 11 },
      { startRowIndex: 56, endRowIndex: 57, startColumnIndex: 1, endColumnIndex: 12 },
    ]),
    ...applyCellFormatting(sheetId, [
      { row: 15, col: 1, value: "DESCRIPTION", runs: [{ start: 0, end: 11, format: { fontFamily: "Roboto Mono", fontSize: 20, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 15, col: 7, value: "AMOUNT", runs: [{ start: 0, end: 6, format: { fontFamily: "Roboto Mono", fontSize: 25, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 18, col: 1, value: "Tsz Shan Monastery presents:", runs: [{ start: 0, end: 28, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: true, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 19, col: 1, value: "New Year Bell Ringing Ceremony 2025", runs: [{ start: 0, end: 35, format: { fontFamily: "Varela Round", fontSize: 24, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 22, col: 1, value: "Choral Arrangement x4 song(s)", runs: [{ start: 0, end: 19, format: { fontFamily: "\"Roboto Mono\"", fontSize: 14, bold: true, italic: true, foregroundColor: "#000000" } }, { start: 19, end: 29, format: { fontFamily: "\"Roboto Mono\"", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 22, col: 7, value: 4000, alignment: { horizontal: "RIGHT", vertical: "BOTTOM" } },
      { row: 22, col: 8, value: "x4", runs: [{ start: 0, end: 2, format: { fontFamily: "Roboto Serif", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 22, col: 10, value: 16000, alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 23, col: 1, value: "Arrangement Fee", runs: [{ start: 0, end: 15, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 23, col: 7, value: "each", runs: [{ start: 0, end: 4, format: { fontFamily: "Roboto Mono", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "TOP" } },
      { row: 24, col: 1, value: "1.You Raise Me Up, 2. 心燈, 3.慈山歌, 4.Auld Lang Syne", runs: [{ start: 0, end: 49, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: true, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 27, col: 1, value: "Music Preparation x5 song(s)", runs: [{ start: 0, end: 18, format: { fontFamily: "\"Roboto Mono\"", fontSize: 14, bold: true, italic: true, foregroundColor: "#000000" } }, { start: 18, end: 28, format: { fontFamily: "\"Roboto Mono\"", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 27, col: 7, value: 1500, alignment: { horizontal: "RIGHT", vertical: "BOTTOM" } },
      { row: 27, col: 8, value: "x5", runs: [{ start: 0, end: 2, format: { fontFamily: "Roboto Serif", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 27, col: 10, value: 7500, alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 28, col: 1, value: "Music Preparation Fee (Demo recording & score preperation)", runs: [{ start: 0, end: 22, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: true, foregroundColor: "#000000" } }, { start: 22, end: 58, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 28, col: 7, value: "each", runs: [{ start: 0, end: 4, format: { fontFamily: "Roboto Mono", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "TOP" } },
      { row: 29, col: 1, value: "1.The Prayer, 2.You Raise Me Up, 3.心燈, 4.慈山歌, 5.Auld Lang Syne", runs: [{ start: 0, end: 62, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: true, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 32, col: 1, value: "Rehearsal x6  [2 hrs/session(s)]", runs: [{ start: 0, end: 10, format: { fontFamily: "Roboto Mono", fontSize: 14, bold: true, italic: true, foregroundColor: "#000000" } }, { start: 10, end: 14, format: { fontFamily: "Roboto Mono", fontSize: 14, bold: false, italic: true, foregroundColor: "#000000" } }, { start: 14, end: 15, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }, { start: 15, end: 16, format: { fontFamily: "Courier New", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }, { start: 16, end: 21, format: { fontFamily: "Courier New", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }, { start: 21, end: 33, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 32, col: 7, value: 1500, alignment: { horizontal: "RIGHT", vertical: "BOTTOM" } },
      { row: 32, col: 8, value: "x12", runs: [{ start: 0, end: 3, format: { fontFamily: "Roboto Serif", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 32, col: 10, value: 18000, alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 33, col: 1, value: "Rehearsal & Coaching Fee", runs: [{ start: 0, end: 24, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 33, col: 7, value: "per hour", runs: [{ start: 0, end: 8, format: { fontFamily: "Roboto Mono", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "TOP" } },
      { row: 34, col: 1, value: "2024 Nov 17, 24; Dec 1, 15, 22 & 30", runs: [{ start: 0, end: 35, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 37, col: 1, value: "Featured Performance x2 song(s)", runs: [{ start: 0, end: 21, format: { fontFamily: "\"Roboto Mono\"", fontSize: 14, bold: true, italic: true, foregroundColor: "#000000" } }, { start: 21, end: 31, format: { fontFamily: "Google Sans Mono", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 37, col: 7, value: 2000, alignment: { horizontal: "RIGHT", vertical: "BOTTOM" } },
      { row: 37, col: 8, value: "x3", runs: [{ start: 0, end: 2, format: { fontFamily: "Roboto Serif", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 37, col: 10, value: 6000, alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 38, col: 1, value: "Artist Fee", runs: [{ start: 0, end: 10, format: { fontFamily: "Google Sans Mono", fontSize: 12, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 38, col: 7, value: "each", runs: [{ start: 0, end: 4, format: { fontFamily: "Roboto Mono", fontSize: 8, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "TOP" } },
      { row: 39, col: 1, value: "The Prayer\nYou Raise Me Up\nAuld Lang Syne", runs: [{ start: 0, end: 41, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: true, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 40, col: 6, value: "Fee Adjustment in Good Faith", runs: [{ start: 0, end: 28, format: { fontFamily: "Consolas", fontSize: 9, bold: false, italic: true, foregroundColor: "#999999" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 40, col: 10, value: -12500, alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 44, col: 5, value: "INVOICE TOTAL", runs: [{ start: 0, end: 13, format: { fontFamily: "Roboto Mono", fontSize: 20, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
      { row: 44, col: 6, value: "參萬伍仟元正", runs: [{ start: 0, end: 6, format: { fontFamily: "Klee One", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 45, col: 7, value: "(HKD)", runs: [{ start: 0, end: 5, format: { fontFamily: "Roboto Mono", fontSize: 17, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 45, col: 8, value: 35000, alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 46, col: 6, value: "Thirty Five Thousand Dollars Only", runs: [{ start: 0, end: 33, format: { fontFamily: "Consolas", fontSize: 10, bold: false, italic: true, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 50, col: 1, value: "Cheque Payable To : Establish Records Limited", runs: [{ start: 0, end: 20, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: false, italic: false, foregroundColor: "#000000" } }, { start: 20, end: 45, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 50, col: 6, value: "Bank: Dah Sing Bank (040)", runs: [{ start: 0, end: 6, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: false, italic: false, foregroundColor: "#000000" } }, { start: 6, end: 25, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 52, col: 1, value: "FPS ID: 114418007        ", runs: [{ start: 0, end: 8, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 12, bold: false, italic: false, foregroundColor: "#000000" } }, { start: 8, end: 25, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 12, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 52, col: 6, value: "Bank Account Number: 747-018-22400-8", runs: [{ start: 0, end: 21, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: false, italic: false, foregroundColor: "#000000" } }, { start: 21, end: 36, format: { fontFamily: "\"Roboto Mono\", Arial", fontSize: 11, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "BOTTOM" } },
      { row: 56, col: 1, value: "      PAYMENT TERMS: FULL PAYMENT WITHIN 7 DAYS                ", runs: [{ start: 0, end: 63, format: { fontFamily: "\"Roboto Mono\"", fontSize: 11, bold: true, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "BOTTOM" } },
    ]),
    ...applyBorders(sheetId, [
      { row: 44, col: 5, top: { style: "SOLID_MEDIUM", color: "#000000" }, bottom: { style: "SOLID_MEDIUM", color: "#000000" }, left: { style: "SOLID_MEDIUM", color: "#000000" } },
      { row: 44, col: 6, top: { style: "SOLID_MEDIUM", color: "#000000" }, right: { style: "SOLID_MEDIUM", color: "#000000" } },
      { row: 45, col: 10, right: { style: "SOLID_MEDIUM", color: "#000000" } },
      { row: 46, col: 6, bottom: { style: "SOLID_MEDIUM", color: "#000000" }, right: { style: "SOLID_MEDIUM", color: "#000000" } },
      { row: 56, col: 1, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 2, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 3, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 4, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 5, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 6, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 7, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 8, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 9, bottom: { style: "SOLID", color: "#000000" } },
      { row: 56, col: 10, bottom: { style: "SOLID", color: "#000000" } },
    ]),
    ...applyBackgroundColors(sheetId, [
      { row: 14, col: 1, color: "#000000" },
      { row: 14, col: 2, color: "#000000" },
      { row: 14, col: 3, color: "#000000" },
      { row: 14, col: 4, color: "#000000" },
      { row: 14, col: 5, color: "#000000" },
      { row: 14, col: 6, color: "#000000" },
      { row: 14, col: 7, color: "#000000" },
      { row: 14, col: 8, color: "#000000" },
      { row: 14, col: 9, color: "#000000" },
      { row: 14, col: 10, color: "#000000" },
      { row: 16, col: 1, color: "#000000" },
      { row: 16, col: 2, color: "#000000" },
      { row: 16, col: 3, color: "#000000" },
      { row: 16, col: 4, color: "#000000" },
      { row: 16, col: 5, color: "#000000" },
      { row: 16, col: 6, color: "#000000" },
      { row: 16, col: 7, color: "#000000" },
      { row: 16, col: 8, color: "#000000" },
      { row: 16, col: 9, color: "#000000" },
      { row: 16, col: 10, color: "#000000" },
    ]),
  ];
  return requests;
};
