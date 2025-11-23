// scripts/generatePdfStyles.js
const fs = require('fs/promises');
const path = require('path');

const INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'lib', 'pdfTemplates', 'generatedStyles.ts');

// Helper to convert Google Sheets color to hex
const toHex = (rgb) => {
  if (!rgb) return '#000000';
  const r = Math.round((rgb.red || 0) * 255);
  const g = Math.round((rgb.green || 0) * 255);
  const b = Math.round((rgb.blue || 0) * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

async function main() {
  console.log('Generating styles from sheet data...');

  try {
    const fileContent = await fs.readFile(INPUT_PATH, 'utf-8');
    const sheetData = JSON.parse(fileContent);

    const styles = {};

    const rows = sheetData.sheets[0].data[0].rowData;

    if (!Array.isArray(rows)) {
      console.error('Error: sheetData.sheets[0].data[0].rowData is not an array.');
      process.exit(1);
    }

    rows.forEach((row) => {
      if (!row || !row.values) return;
      row.values.forEach((cell) => {
        if (!cell || !cell.format || !cell.note) return;
        
        const style = {};
        const { format } = cell;

        if (format.fontFamily) style.fontFamily = format.fontFamily;
        if (format.fontSize) style.fontSize = format.fontSize;
        if (format.bold) style.fontWeight = 'bold';
        if (format.italic) style.fontStyle = 'italic';
        if (format.horizontalAlignment) style.textAlign = format.horizontalAlignment.toLowerCase();
        if (format.verticalAlignment) style.verticalAlign = format.verticalAlignment.toLowerCase();
        if (format.textFormat && format.textFormat.foregroundColor) {
          style.color = toHex(format.textFormat.foregroundColor);
        }
        
        styles[cell.note] = style;
      });
    });

    const outputContent = "// This file is auto-generated from a Google Sheet. Do not edit.\n\nimport { StyleSheet } from '@react-pdf/renderer';\n\nexport const generatedStyles = StyleSheet.create(" + JSON.stringify(styles, null, 2) + ");";

    await fs.writeFile(OUTPUT_PATH, outputContent);
    console.log(`Successfully generated styles to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating styles:', error);
    process.exit(1);
  }
}

main();
