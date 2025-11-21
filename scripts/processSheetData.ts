// scripts/processSheetData.ts
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'sheet-data.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');
const TARGET_SHEET_TITLE = 'Classic Single-Item Invoice (Sample';

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function simplifyCell(cell: any) {
  if (!cell) return null;

  const simplified: {
    value?: string | number | boolean;
    format?: {
      fontFamily?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      horizontalAlignment?: string;
      verticalAlignment?: string;
    };
    note?: string;
  } = {};

  if (cell.effectiveValue) {
    const value = Object.values(cell.effectiveValue)[0];
    simplified.value = value as string | number | boolean;
  }

  if (cell.effectiveFormat) {
    const { textFormat, horizontalAlignment, verticalAlignment } = cell.effectiveFormat;
    simplified.format = {
      fontFamily: textFormat?.fontFamily,
      fontSize: textFormat?.fontSize,
      bold: textFormat?.bold,
      italic: textFormat?.italic,
      horizontalAlignment,
      verticalAlignment,
    };
  }
  if(cell.note) {
    simplified.note = cell.note
  }

  return simplified;
}

async function main() {
  console.log(`Reading large sheet data from ${INPUT_PATH}...`);

  try {
    const fileContent = await fs.readFile(INPUT_PATH, 'utf-8');
    const sheetData = JSON.parse(fileContent);

    if (!sheetData.sheets) {
      throw new Error('No sheets found in the JSON data.');
    }

    const targetSheet = sheetData.sheets.find(
      (sheet: any) => sheet.properties?.title === TARGET_SHEET_TITLE
    );

    if (!targetSheet) {
      throw new Error(`Sheet with title "${TARGET_SHEET_TITLE}" not found.`);
    }

    console.log(`Found target sheet: "${TARGET_SHEET_TITLE}"`);

    const simplifiedData = {
      properties: targetSheet.properties,
      rows: targetSheet.data[0].rowData.map((row: any) => {
        if (!row.values) return [];
        return row.values.map(simplifyCell);
      }),
      merges: targetSheet.merges,
      rowMetadata: targetSheet.data[0].rowMetadata,
      columnMetadata: targetSheet.data[0].columnMetadata,
    };

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(simplifiedData, null, 2));
    console.log(`Successfully extracted and simplified template data to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error processing sheet data:', error);
  }
}

main();