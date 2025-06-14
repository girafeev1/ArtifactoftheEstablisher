// pages/api/invoices/BasicInfo.ts
// @ts-nocheck

import { applyDimensions, createMergeRequests, applyCellFormatting, applyBorders, applyBackgroundColors } from '../../../lib/utils';

export const applyBasicInfoFormatting = (sheetId: number) => {
  const requests = [
    ...applyDimensions(sheetId, "ROWS", [
      { startIndex: 0, endIndex: 3, size: 20 },
      { startIndex: 3, endIndex: 5, size: 18 },
      { startIndex: 5, endIndex: 6, size: 43 },
    ]),
    ...createMergeRequests(sheetId, [
      { startRowIndex: 0, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 7 },
      { startRowIndex: 0, endRowIndex: 4, startColumnIndex: 8, endColumnIndex: 11 },
      { startRowIndex: 2, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 5 },
      { startRowIndex: 2, endRowIndex: 3, startColumnIndex: 5, endColumnIndex: 7 },
      { startRowIndex: 4, endRowIndex: 6, startColumnIndex: 5, endColumnIndex: 7 },
      { startRowIndex: 4, endRowIndex: 6, startColumnIndex: 8, endColumnIndex: 11 },
    ]),
    ...applyCellFormatting(sheetId, [
      { row: 0, col: 1, value: "Establish Records Limited", runs: [{ start: 0, end: 25, format: { fontFamily: "Source Code Pro", fontSize: 32, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 2, col: 1, value: "1/F 18 Wang Toi Shan Leung Uk Tseun\nYuen Long Pat Heung\nN.T.\nHong Kong", runs: [{ start: 0, end: 70, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "LEFT", vertical: "MIDDLE" } },
      { row: 2, col: 5, value: "別樹唱片有限公司", runs: [{ start: 0, end: 8, format: { fontFamily: "DFKai-SB", fontSize: 10, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 4, col: 5, value: " +(852) 6694 9527\naccount@establishrecords.com  ", runs: [{ start: 0, end: 48, format: { fontFamily: "Roboto Mono", fontSize: 10, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "RIGHT", vertical: "MIDDLE" } },
      { row: 4, col: 8, value: "Invoice", runs: [{ start: 0, end: 7, format: { fontFamily: "Roboto Mono", fontSize: 22, bold: false, italic: false, foregroundColor: "#000000" } }], alignment: { horizontal: "CENTER", vertical: "MIDDLE" } },
    ]),
    ...applyBorders(sheetId, [
      { row: 2, col: 1, bottom: { style: "SOLID", color: "#000000" } },
      { row: 4, col: 5, bottom: { style: "SOLID", color: "#000000" } },
      { row: 4, col: 8, bottom: { style: "SOLID", color: "#000000" } },
    ]),
    ...applyBackgroundColors(sheetId, []),
  ];
  return requests;
};
