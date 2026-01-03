/**
 * Extract section definitions from Google Sheets scheme for invoice pages
 * Usage: node scripts/extract-sections.js
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'paginated-invoice-scheme.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;
const getCell = (row, col) => {
  const colIdx = typeof col === 'string' ? cols.indexOf(col) + 1 : col;
  return scheme.cells[row + ':' + colIdx];
};

function analyzeSection(name, startRow, endRow) {
  console.log('\n' + '='.repeat(60));
  console.log('=== ' + name.toUpperCase() + ' (Rows ' + startRow + '-' + endRow + ') ===');
  console.log('='.repeat(60) + '\n');

  let totalHeight = 0;
  const rowHeights = [];
  for (let r = startRow; r <= endRow; r++) {
    const h = scheme.rowHeightsPx[r - 1];
    totalHeight += h;
    rowHeights.push(h);
  }

  console.log('Total height: ' + totalHeight + 'px');
  console.log('Row count: ' + (endRow - startRow + 1));
  console.log('Row heights: [' + rowHeights.join(', ') + ']');

  const sectionMerges = scheme.merges.filter(m => m.r1 >= startRow && m.r1 <= endRow);
  sectionMerges.sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1);

  console.log('\nMerges (' + sectionMerges.length + '):');
  sectionMerges.forEach(m => {
    const cell = getCell(m.r1, m.c1);
    const localRow = m.r1 - startRow + 1;
    const rowSpan = m.r2 - m.r1;
    const colSpan = m.c2 - m.c1;
    const startCol = colName(m.c1);
    const endCol = colName(m.c2);
    const value = (cell && cell.value ? cell.value : '').replace(/\n/g, '\\n').substring(0, 30);
    if (rowSpan > 0 || colSpan > 1) {
      console.log('  Local Row ' + localRow + ': ' + startCol + '-' + endCol + ' (rowSpan=' + (rowSpan+1) + ', colSpan=' + colSpan + ') "' + value + '"');
    }
  });

  console.log('\nRow-by-row:');
  for (let r = startRow; r <= endRow; r++) {
    const localRow = r - startRow + 1;
    const height = scheme.rowHeightsPx[r - 1];
    const rowCells = [];
    for (let c = 1; c <= 14; c++) {
      const cell = getCell(r, c);
      if (cell && cell.value && cell.value.trim()) {
        const value = cell.value.replace(/\n/g, '\\n').substring(0, 20);
        const font = (cell.fontFamily || 'default') + ' ' + (cell.fontSize || 10) + 'px';
        const style = (cell.bold ? ' bold' : '') + (cell.italic ? ' italic' : '');
        rowCells.push({ col: colName(c), value: value, font: font + style });
      }
    }
    const rowMerges = sectionMerges.filter(m => m.r1 === r && (m.r2 - m.r1 > 0 || m.c2 - m.c1 > 1));

    let output = 'Row ' + localRow + ' (' + r + '): ' + height + 'px';
    if (rowCells.length > 0) {
      output += ' | ' + rowCells.map(c => c.col + ':"' + c.value + '"').join(', ');
    }
    if (rowMerges.length > 0) {
      output += ' | MERGES: ' + rowMerges.map(m => colName(m.c1) + '-' + colName(m.c2) + (m.r2-m.r1 > 0 ? '(' + (m.r2-m.r1+1) + 'rows)' : '')).join(', ');
    }
    console.log(output);
  }
}

console.log('=== INVOICE STRUCTURE FROM SCHEME ===');
console.log('Sheet: ' + scheme.sheetTitle);

const markers = [];
for (let r = 1; r <= scheme.rowHeightsPx.length; r++) {
  const cellA = getCell(r, 1);
  const cellK = getCell(r, 11);
  const cellL = getCell(r, 12);
  if (cellA && cellA.value && cellA.value.includes('P a y m e n t')) {
    markers.push({ row: r, type: cellA.value.includes('Details') ? 'PaymentDetails' : 'PaymentInstructions' });
  }
  if ((cellK && cellK.value && cellK.value.includes('Invoice')) || (cellL && cellL.value && cellL.value.includes('Invoice'))) {
    markers.push({ row: r, type: 'InvoiceTitle' });
  }
}

console.log('\nSection markers:');
markers.forEach(m => console.log('  Row ' + m.row + ': ' + m.type));

const piStart = markers.find(m => m.type === 'PaymentInstructions');
if (piStart) {
  const nextMarker = markers.find(m => m.row > piStart.row);
  const piEnd = nextMarker ? nextMarker.row - 1 : scheme.rowHeightsPx.length;
  analyzeSection('Payment Instructions', piStart.row, Math.min(piEnd, piStart.row + 60));
}

const pdStart = markers.find(m => m.type === 'PaymentDetails');
if (pdStart) {
  const nextMarker = markers.find(m => m.row > pdStart.row);
  const pdEnd = nextMarker ? nextMarker.row - 1 : scheme.rowHeightsPx.length;
  analyzeSection('Payment Details', pdStart.row, Math.min(pdEnd, pdStart.row + 45));
}
