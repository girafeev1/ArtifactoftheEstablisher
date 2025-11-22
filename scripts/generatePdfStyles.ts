// scripts/generatePdfStyles.ts
import fs from 'fs/promises';
import path from 'path';

const INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'lib', 'pdfTemplates', 'generatedStyles.ts');

async function main() {
  console.log('Generating styles from sheet data...');

  try {
    const fileContent = await fs.readFile(INPUT_PATH, 'utf-8');
    const sheetData = JSON.parse(fileContent);

    const styles: { [key: string]: any } = {
      page: {
        fontFamily: 'Roboto',
        fontSize: 11,
        padding: 40,
        flexDirection: 'column',
      },
      // ... more styles to be added here
    };

    // This is a simplified example. A more robust implementation would
    // iterate through all rows and cells and generate styles based on their
    // `effectiveFormat`. This is a complex task that will be done iteratively.
    // For now, we will just add a few key styles.

    const firstRow = sheetData.rows[0];
    if (firstRow && firstRow[0] && firstRow[0].format) {
      styles.logoMark = {
        fontFamily: firstRow[0].format.fontFamily,
        fontSize: firstRow[0].format.fontSize,
      };
    }

    // These are just placeholders to get the build to pass.
    // I will replace these with the actual styles from the sheet data.
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


    const outputContent = `// This file is auto-generated. Do not edit.\n\nimport { StyleSheet } from '@react-pdf/renderer';\n\nexport const generatedStyles = StyleSheet.create(${JSON.stringify(styles, null, 2)});`;

    await fs.writeFile(OUTPUT_PATH, outputContent);
    console.log(`Successfully generated styles to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating styles:', error);
  }
}

main();