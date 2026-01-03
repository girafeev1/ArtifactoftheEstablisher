/**
 * Analyze footer rows 202-252 and continuation header rows 52-58
 * from gid=403093960 (Classic Single-Item Invoice)
 */

const fs = require('fs');
const path = require('path');

const schemePath = path.join(__dirname, '..', 'tmp', 'payment-details-sheet.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

const cols = 'ABCDEFGHIJKLMN'.split('');
const colName = (idx) => cols[idx - 1] || 'Col' + idx;

function analyzeRows(startRow, endRow, title) {
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`=== ${title} (Rows ${startRow}-${endRow}) ===`);
  console.log('='.repeat(60));

  // Row heights
  console.log('\n--- ROW HEIGHTS (px) ---');
  const rowHeights = [];
  for (let r = startRow; r <= endRow; r++) {
    const height = scheme.rowHeightsPx[r - 1] || 21;
    const localIdx = r - startRow;
    rowHeights.push(height);
    console.log(`Row ${r} (index ${localIdx}): ${height}px`);
  }
  console.log(`\nTotal height: ${rowHeights.reduce((a, b) => a + b, 0)}px`);
  console.log(`\nconst ROW_HEIGHTS = [${rowHeights.join(', ')}];`);

  // Merges for the range
  console.log('\n--- MERGES ---');
  const merges = scheme.merges
    .filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .map(m => ({
      startRow: m.r1,
      endRow: m.r2,
      startCol: colName(m.c1),
      endCol: colName(m.c2),
      startColNum: m.c1,
      endColNum: m.c2,
      rowSpan: m.r2 - m.r1,
      colSpan: m.c2 - m.c1,
      content: scheme.cells[`${m.r1}:${m.c1}`]?.value?.substring(0, 50) || ''
    }))
    .sort((a, b) => a.startRow - b.startRow || a.startColNum - b.startColNum);

  merges.forEach(m => {
    console.log(`Row ${m.startRow}: Merge ${m.startCol}-${m.endCol} (cols ${m.startColNum}-${m.endColNum}) | ${m.rowSpan}r x ${m.colSpan}c | "${m.content}"`);
  });

  // Detailed row-by-row analysis
  console.log('\n--- ROW BY ROW DETAILS ---');
  for (let r = startRow; r <= endRow; r++) {
    const localIdx = r - startRow;
    const height = scheme.rowHeightsPx[r - 1] || 21;
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
      if (cell && (cell.value || cell.bold || (cell.fontFamily && cell.fontFamily !== 'Arial') || cell.border)) {
        let info = `  ${colName(c)} (col ${c}):`;
        if (cell.value) info += ` "${cell.value.substring(0, 60)}"`;
        if (cell.fontFamily) info += ` | font: ${cell.fontFamily}`;
        if (cell.fontSize) info += ` ${cell.fontSize}pt`;
        if (cell.bold) info += ' BOLD';
        if (cell.italic) info += ' italic';
        if (cell.hAlign) info += ` | hAlign: ${cell.hAlign}`;
        if (cell.vAlign) info += ` | vAlign: ${cell.vAlign}`;
        if (cell.fgColor) info += ` | color: rgb(${Math.round((cell.fgColor.red||0)*255)},${Math.round((cell.fgColor.green||0)*255)},${Math.round((cell.fgColor.blue||0)*255)})`;
        if (cell.border && Object.keys(cell.border).length > 0) {
          const sides = Object.keys(cell.border).filter(s => cell.border[s]?.style);
          if (sides.length > 0) info += ` | borders: ${sides.join(',')}`;
        }
        console.log(info);
      }
    }
  }

  return { rowHeights, merges };
}

// Analyze footer rows 202-252
const footerData = analyzeRows(202, 252, 'FOOTER AREA');

// Analyze continuation header rows 52-58
const headerData = analyzeRows(52, 58, 'CONTINUATION HEADER');

console.log('\n\n' + '='.repeat(60));
console.log('=== SUMMARY ===');
console.log('='.repeat(60));

console.log('\nFOOTER (rows 202-252):');
console.log(`  Row heights: [${footerData.rowHeights.join(', ')}]`);
console.log(`  Total: ${footerData.rowHeights.reduce((a, b) => a + b, 0)}px`);
console.log(`  Merges: ${footerData.merges.length}`);

console.log('\nCONTINUATION HEADER (rows 52-58):');
console.log(`  Row heights: [${headerData.rowHeights.join(', ')}]`);
console.log(`  Total: ${headerData.rowHeights.reduce((a, b) => a + b, 0)}px`);
console.log(`  Merges: ${headerData.merges.length}`);
