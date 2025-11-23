// scripts/generatePdfStyles.js
const fs = require('fs/promises');
const path = require('path');

const INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'lib', 'pdfTemplates', 'generatedStyles.ts');

async function main() {
  console.log('Generating styles from sheet data...');

  try {
    const fileContent = await fs.readFile(INPUT_PATH, 'utf-8');
    const sheetData = JSON.parse(fileContent);

    const styles = {
      page: {
        fontFamily: 'Roboto',
        fontSize: 11,
        padding: 40,
        flexDirection: 'column',
      },
      // ... more styles to be added here from parsing sheetData
    };

    const firstRow = sheetData.rows[0];
    if (firstRow && firstRow[0] && firstRow[0].format) {
      styles.logoMark = {
        fontFamily: firstRow[0].format.fontFamily,
        fontSize: firstRow[0].format.fontSize,
      };
    }
    
    // Add placeholders to prevent build failure
    styles.sectionLabel = { fontSize: 10 };
    styles.billName = { fontSize: 12 };
    styles.projectTitle = { fontSize: 14 };
    styles.projectNature = { fontSize: 9 };
    styles.tableHeader = {};
    styles.tableColDesc = {};
    styles.tableColAmount = {};
    styles.itemRow = {};
    styles.amountCell = {};
    styles.totalsBlock = {};
    styles.totalsRow = {};
    styles.footer = {};
    styles.footerZh = {};
    styles.pageNumber = {};
    styles.qrContainer = {};
    styles.invoiceLabel = {};
    styles.headerRow = {};


    const outputContent = "// This file is auto-generated. Do not edit.\n\nimport { StyleSheet } from '@react-pdf/renderer';\n\nexport const generatedStyles = StyleSheet.create(" + JSON.stringify(styles, null, 2) + ");";

    await fs.writeFile(OUTPUT_PATH, outputContent);
    console.log(`Successfully generated styles to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating styles:', error);
  }
}

main();
