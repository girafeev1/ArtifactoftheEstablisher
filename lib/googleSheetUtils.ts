// lib/googleSheetUtils.ts

export const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { red: r, green: g, blue: b };
};

export const applyDimensions = (sheetId: number, dimension: 'ROWS' | 'COLUMNS', sizes: number[], offset = 0) =>
  sizes.map((size, index) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension, startIndex: index + offset, endIndex: index + offset + 1 },
      properties: { pixelSize: size },
      fields: 'pixelSize'
    }
  }));

export const createMergeRequests = (sheetId: number, merges: any[]) =>
  merges.map(merge => ({
    mergeCells: { range: { sheetId, ...merge }, mergeType: 'MERGE_ALL' }
  }));

export const applyRichTextFormatting = (
  sheetId: number,
  richText: (any | null)[][],
  offset = 0,
  horizontalAlignments: (string | null)[][],
  verticalAlignments: (string | null)[][]
) => {
  const requests: any[] = [];
  richText.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell || !cell.value) return;

      const hAlign = (horizontalAlignments[rowIndex]?.[colIndex] || 'LEFT').toUpperCase().replace('GENERAL-', '');
      const vAlign = (verticalAlignments[rowIndex]?.[colIndex] || 'MIDDLE').toUpperCase();
      const textFormatRuns = Array.isArray(cell.runs) ? cell.runs : [];

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: rowIndex + offset,
            endRowIndex: rowIndex + offset + 1,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1
          },
          cell: {
            userEnteredValue: {
              stringValue: String(cell.value)
            },
            textFormatRuns: textFormatRuns.map(run => ({
              startIndex: run.start,
              format: {
                fontFamily: run.format?.fontFamily || 'Arial',
                fontSize: run.format?.fontSize || 10,
                bold: !!run.format?.bold,
                italic: !!run.format?.italic,
                foregroundColor: run.format?.foregroundColor ? hexToRgb(run.format.foregroundColor) : undefined
              }
            })),
            userEnteredFormat: {
              horizontalAlignment: hAlign === 'GENERAL' ? 'LEFT' : hAlign,
              verticalAlignment: vAlign
            }
          },
          fields: 'userEnteredValue.stringValue,textFormatRuns,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment'
        }
      });
    });
  });
  return requests;
};

export const applyBorders = (sheetId: number, borders: any[], offset = 0) => {
  const requests: any[] = [];
  borders.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell && (cell.top || cell.bottom || cell.left || cell.right)) {
        requests.push({
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: rowIndex + offset,
              endRowIndex: rowIndex + offset + 1,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1
            },
            top: cell.top ? { style: cell.top.style, color: hexToRgb(cell.top.color) } : undefined,
            bottom: cell.bottom ? { style: cell.bottom.style, color: hexToRgb(cell.bottom.color) } : undefined,
            left: cell.left ? { style: cell.left.style, color: hexToRgb(cell.left.color) } : undefined,
            right: cell.right ? { style: cell.right.style, color: hexToRgb(cell.right.color) } : undefined
          }
        });
      }
    });
  });
  return requests;
};

export const applyBackgroundColors = (sheetId: number, backgrounds: string[][], offset = 0) => {
  const requests: any[] = [];
  backgrounds.forEach((row, rowIndex) => {
    row.forEach((color, colIndex) => {
      if (color && color !== '#ffffff') {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex + offset,
              endRowIndex: rowIndex + offset + 1,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1
            },
            cell: { userEnteredFormat: { backgroundColor: hexToRgb(color) } },
            fields: 'userEnteredFormat.backgroundColor'
          }
        });
      }
    });
  });
  return requests;
};
