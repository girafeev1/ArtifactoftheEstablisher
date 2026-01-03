/**
 * Analyze rows 55-77 from Google Sheets scheme for InvoiceHeaderFullVersionA
 * Outputs: row heights, merges, cell values, and formatting
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'paginated-invoice-scheme.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;

// Helper to format color
function formatColor(color) {
  if (!color) return null;
  if (typeof color === 'string') return color;
  if (color.red !== undefined || color.green !== undefined || color.blue !== undefined) {
    const r = Math.round((color.red || 0) * 255);
    const g = Math.round((color.green || 0) * 255);
    const b = Math.round((color.blue || 0) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return null;
}

console.log('=== ROWS 55-77 ANALYSIS (InvoiceHeaderFullVersionA) ===\n');

// Row heights
console.log('--- ROW HEIGHTS (px) ---');
const rowHeights = [];
for (let r = 55; r <= 77; r++) {
  const height = scheme.rowHeightsPx[r - 1];
  const localIdx = r - 55;
  rowHeights.push(height);
  console.log(`Row ${r} (index ${localIdx}): ${height}px`);
}
console.log(`\nTotal height: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
console.log(`\nJavaScript array:\nconst ROW_HEIGHTS = [${rowHeights.join(', ')}];`);

// Merges for rows 55-77
console.log('\n\n--- MERGES ---');
const merges = scheme.merges
  .filter(m => m.r1 >= 55 && m.r1 <= 77)
  .map(m => ({
    startRow: m.r1,
    endRow: m.r2,
    startCol: colName(m.c1),
    endCol: colName(m.c2),
    startColNum: m.c1,
    endColNum: m.c2,
    rowSpan: m.r2 - m.r1 + 1,
    colSpan: m.c2 - m.c1 + 1,
    content: scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 50) || ''
  }))
  .sort((a, b) => a.startRow - b.startRow || a.startColNum - b.startColNum);

merges.forEach(m => {
  console.log(`Row ${m.startRow}: Merge ${m.startCol}-${m.endCol} (cols ${m.startColNum}-${m.endColNum}) | ${m.rowSpan}r x ${m.colSpan}c | "${m.content}"`);
});

// Detailed row-by-row analysis
console.log('\n\n--- ROW BY ROW DETAILS ---');
for (let r = 55; r <= 77; r++) {
  const localIdx = r - 55;
  const height = scheme.rowHeightsPx[r - 1];
  console.log(`\n=== ROW ${r} (index ${localIdx}): ${height}px ===`);

  // Find merges that START in this row
  const rowMerges = merges.filter(m => m.startRow === r);
  if (rowMerges.length > 0) {
    console.log('  MERGES starting here:');
    rowMerges.forEach(m => {
      console.log(`    ${m.startCol}-${m.endCol} (${m.rowSpan}r x ${m.colSpan}c)`);
    });
  }

  // Cell contents
  for (let c = 1; c <= 14; c++) {
    const cellKey = `${r}:${c}`;
    const cell = scheme.cells[cellKey];
    if (cell && (cell.value || cell.bold || cell.fontFamily !== 'Arial')) {
      let info = `  ${colName(c)} (col ${c}):`;
      if (cell.value) info += ` "${cell.value.substring(0, 60)}"`;
      if (cell.fontFamily) info += ` | font: ${cell.fontFamily}`;
      if (cell.fontSize) info += ` ${cell.fontSize}pt`;
      if (cell.bold) info += ' BOLD';
      if (cell.italic) info += ' italic';
      if (cell.hAlign) info += ` | hAlign: ${cell.hAlign}`;
      if (cell.vAlign) info += ` | vAlign: ${cell.vAlign}`;
      if (cell.wrapStrategy) info += ` | wrap: ${cell.wrapStrategy}`;
      console.log(info);
    }
  }
}

// Output summary for implementation
console.log('\n\n=== IMPLEMENTATION SUMMARY ===\n');
console.log('ROW_HEIGHTS array:');
console.log(`[${rowHeights.join(', ')}]`);
console.log(`\nTotal: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
console.log('\nMerges (0-indexed columns as stored in scheme):');
merges.forEach(m => {
  console.log(`  Row ${m.startRow}: c1=${m.startColNum} (${m.startCol}) to c2=${m.endColNum} (${m.endCol}) | span: ${m.rowSpan}r x ${m.colSpan}c`);
});
