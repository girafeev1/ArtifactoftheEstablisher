// scripts/generatePdfStyles.ts
import fs from 'fs/promises';
import path from 'path';

const INPUT_PATH = path.resolve(process.cwd(), 'tmp', 'invoice-template-data.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'lib', 'pdfTemplates', 'generatedStyles.ts');

async function main() {
  console.log(`Reading simplified sheet data from ${INPUT_PATH}...`);

  try {
    const fileContent = await fs.readFile(INPUT_PATH, 'utf-8');
    const sheetData = JSON.parse(fileContent);

    const styles: Record<string, any> = {};

    // This is a simplified example of how you might extract styles.
    // A more robust implementation would handle merges, different value types, etc.
    sheetData.rows.forEach((row: any, rowIndex: number) => {
      if (row) {
        row.forEach((cell: any, colIndex: number) => {
          if (cell && cell.format) {
            const styleKey = `cell_${rowIndex}_${colIndex}`;
            styles[styleKey] = {
              fontFamily: cell.format.fontFamily,
              fontSize: cell.format.fontSize,
              fontWeight: cell.format.bold ? 'bold' : 'normal',
              fontStyle: cell.format.italic ? 'italic' : 'normal',
              textAlign: cell.format.horizontalAlignment?.toLowerCase() || 'left',
              verticalAlign: cell.format.verticalAlignment?.toLowerCase() || 'top',
            };
          }
        });
      }
    });

    const outputContent = `// Auto-generated from spreadsheet data
export const generatedStyles = ${JSON.stringify(styles, null, 2)};
`;

    await fs.writeFile(OUTPUT_PATH, outputContent);
    console.log(`Successfully generated styles to ${OUTPUT_PATH}`);

  } catch (error) {
    console.error('Error generating styles:', error);
  }
}

main();
