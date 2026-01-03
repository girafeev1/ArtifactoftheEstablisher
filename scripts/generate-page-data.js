/**
 * Generate TypeScript data files from the supplementary cells JSON
 * This creates static data that can be imported and rendered by React components
 */

const fs = require('fs');
const path = require('path');

const cellsPath = path.join(__dirname, '..', 'tmp', 'supplementary-cells.json');
const data = JSON.parse(fs.readFileSync(cellsPath, 'utf8'));

function generateRowData(rows, merges, pageName) {
  const lines = [];

  lines.push(`/**`);
  lines.push(` * ${pageName} - Cell data from Google Sheets scheme`);
  lines.push(` * Auto-generated from tmp/supplementary-cells.json`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import type { SchemeRowData, SchemeMerge } from '../../grid';`);
  lines.push(``);

  // Generate row heights array
  lines.push(`export const ROW_HEIGHTS = [`);
  rows.forEach((row, idx) => {
    lines.push(`  ${row.height}, // Row ${idx + 1} (Sheet ${row.row})`);
  });
  lines.push(`];`);
  lines.push(``);

  // Calculate total height
  const totalHeight = rows.reduce((sum, r) => sum + r.height, 0);
  lines.push(`export const TOTAL_HEIGHT = ${totalHeight}; // ${rows.length} rows`);
  lines.push(``);

  // Generate merges
  lines.push(`export const MERGES: SchemeMerge[] = [`);
  merges.forEach(m => {
    lines.push(`  { startRow: ${m.startRow}, endRow: ${m.endRow}, startCol: '${m.startCol}', endCol: '${m.endCol}', rowSpan: ${m.rowSpan}, colSpan: ${m.colSpan} },`);
  });
  lines.push(`];`);
  lines.push(``);

  // Generate rows with cells
  lines.push(`export const ROWS: SchemeRowData[] = [`);

  rows.forEach((row, rowIdx) => {
    lines.push(`  // Row ${rowIdx + 1} (Sheet ${row.row}): ${row.height}px`);
    lines.push(`  {`);
    lines.push(`    row: ${row.row},`);
    lines.push(`    height: ${row.height},`);
    lines.push(`    cells: [`);

    row.cells.forEach(cell => {
      const parts = [];
      parts.push(`col: '${cell.col}'`);
      parts.push(`colNum: ${cell.colNum}`);

      if (cell.value) {
        // Escape special characters in value
        const escapedValue = cell.value
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n');
        parts.push(`value: '${escapedValue}'`);
      }

      if (cell.fontFamily) parts.push(`fontFamily: '${cell.fontFamily}'`);
      if (cell.fontSize) parts.push(`fontSize: ${cell.fontSize}`);
      if (cell.bold) parts.push(`bold: true`);
      if (cell.italic) parts.push(`italic: true`);
      if (cell.textColor) parts.push(`textColor: '${cell.textColor}'`);
      if (cell.backgroundColor) parts.push(`backgroundColor: '${cell.backgroundColor}'`);
      if (cell.hAlign) parts.push(`hAlign: '${cell.hAlign}'`);
      if (cell.vAlign) parts.push(`vAlign: '${cell.vAlign}'`);
      if (cell.wrapStrategy) parts.push(`wrapStrategy: '${cell.wrapStrategy}'`);

      // Text runs for mixed formatting
      if (cell.textRuns && cell.textRuns.length > 0) {
        const runsStr = cell.textRuns.map(run => {
          const formatParts = [];
          formatParts.push(`startIndex: ${run.startIndex}`);
          const fmt = run.format || {};
          const fmtParts = [];
          if (fmt.fontFamily) fmtParts.push(`fontFamily: '${fmt.fontFamily}'`);
          if (fmt.fontSize) fmtParts.push(`fontSize: ${fmt.fontSize}`);
          if (fmt.bold) fmtParts.push(`bold: true`);
          if (fmt.italic) fmtParts.push(`italic: true`);
          if (fmt.foregroundColor) fmtParts.push(`foregroundColor: '${fmt.foregroundColor}'`);
          formatParts.push(`format: { ${fmtParts.join(', ')} }`);
          return `{ ${formatParts.join(', ')} }`;
        }).join(', ');
        parts.push(`textRuns: [${runsStr}]`);
      }

      if (cell.borders && Object.keys(cell.borders).length > 0) {
        const borderParts = [];
        for (const [side, border] of Object.entries(cell.borders)) {
          if (border) {
            borderParts.push(`${side}: { style: '${border.style}', color: '${border.color}' }`);
          }
        }
        if (borderParts.length > 0) {
          parts.push(`borders: { ${borderParts.join(', ')} }`);
        }
      }

      lines.push(`      { ${parts.join(', ')} },`);
    });

    lines.push(`    ],`);
    lines.push(`  },`);
  });

  lines.push(`];`);
  lines.push(``);

  return lines.join('\n');
}

// Generate Payment Instructions data
const piData = generateRowData(
  data.paymentInstructions.rows,
  data.paymentInstructions.merges,
  'PaymentInstructionsPage'
);

fs.writeFileSync(
  path.join(__dirname, '..', 'lib', 'invoice', 'components', 'pages', 'PaymentInstructionsData.ts'),
  piData
);
console.log('Generated PaymentInstructionsData.ts');

// Generate Payment Details data
const pdData = generateRowData(
  data.paymentDetails.rows,
  data.paymentDetails.merges,
  'PaymentDetailsPage'
);

fs.writeFileSync(
  path.join(__dirname, '..', 'lib', 'invoice', 'components', 'pages', 'PaymentDetailsData.ts'),
  pdData
);
console.log('Generated PaymentDetailsData.ts');

console.log('\nDone! Data files generated in lib/invoice/components/pages/');
