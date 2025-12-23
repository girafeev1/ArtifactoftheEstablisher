import { paginateInvoice, type InvoiceItem } from '../lib/invoiceTemplates/paginationEngine';
import { composeInvoicePackage } from '../lib/invoiceTemplates/layoutComposer';
import { calculateItemHeight } from '../lib/invoiceTemplates/contentHeightCalculator';

// Simulate the actual invoice with 28 session dates
const testItems: InvoiceItem[] = [
  {
    title: 'Coaching Sessions',
    feeType: 'Coaching Fee',
    unitPrice: 1000,
    quantity: 28,
    quantityUnit: 'session',
    subQuantity: 'x28',
    notes: `2022 -
1. Dec 23 14:00 - 20:00
2023 -
2. Sep 10 15:00 -19:00
2024 -
3. Jan 20 — 14:00–23:00
4. Feb 4 — 16:00–18:00
5. Mar 17 — 16:00–19:00
6. Mar 24 — 14:00–16:00
7. Mar 31 — 15:00–18:00
8. Apr 5 — 15:00–18:00
9. Apr 6 — 13:00–16:00
10. May 18 — 15:30–19:00
11. Jun 2 — 15:00–19:00
12. Jun 9 — 18:30–21:30
13. Jun 16 — 14:30–18:00
14. Jun 29 — 19:00–23:00
15. Jul 6 — 19:00–22:00
16. Jul 11 — 18:00–22:00
17. Jul 13 — 19:30–23:00
18. Jul 30 — 19:00–23:00
19. Aug 6 — 19:30–22:00
20. Aug 24 — 13:00–17:00
21. Sep 18 — 12:00–18:00
22. Sep 21 — 12:00–18:00
23. Oct 8 — 10:00–22:00
24. Oct 19 - 10:00-22:00
25. Nov 2 - 14:00-18:00
26. Nov 16 - 14:00-18:00
27. Nov 23 - 14:00-22:00
28. Dec 7 - 14:00-22:00`,
  },
];

console.log('=== Debug Layout Heights ===\n');

// Step 1: Check item height calculation
console.log('Step 1: Item Height Calculation');
testItems.forEach((item, idx) => {
  const height = calculateItemHeight({
    title: item.title,
    feeType: item.feeType,
    notes: item.notes,
  });
  console.log(`Item ${idx + 1}: "${item.title}"`);
  console.log(`  hasNotes: ${height.hasNotes}`);
  console.log(`  notesLineCount: ${height.notesLineCount}`);
  console.log(`  notesRowHeight: ${height.notesRowHeight}px`);
  console.log(`  totalHeight: ${height.totalHeight}px`);
  console.log(`  equivalentItems: ${height.equivalentItems}`);
  console.log('');
});

// Step 2: Check pagination result
console.log('Step 2: Pagination Result');

// Debug: Check the raw breakpoint calculation
import {
  calculatePaginationBreakpoints,
  PAGE_DIMENSIONS,
  SECTION_HEIGHTS,
  calculateSpacing,
  getTotalEquivalentItems,
} from '../lib/invoiceTemplates/contentHeightCalculator';

const contentItems = testItems.map(item => ({
  title: item.title,
  feeType: item.feeType,
  notes: item.notes,
}));

console.log(`\nPAGE_DIMENSIONS.contentHeight: ${PAGE_DIMENSIONS.contentHeight}px`);
console.log(`SECTION_HEIGHTS.headerFull: ${SECTION_HEIGHTS.headerFull}px`);
console.log(`SECTION_HEIGHTS.tableHeader: ${SECTION_HEIGHTS.tableHeader}px`);
console.log(`SECTION_HEIGHTS.footerFull: ${SECTION_HEIGHTS.footerFull}px`);

const totalEquiv = getTotalEquivalentItems(contentItems);
const spacing = calculateSpacing(totalEquiv);
console.log(`\nSpacing (${totalEquiv} equivalent items): preItem=${spacing.preItem}, beforeTotal=${spacing.beforeTotal}, afterTotal=${spacing.afterTotal}`);

// Calculate projectedHeight like the breakpoint function does
const currentPageHeight = SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader + (spacing.preItem * PAGE_DIMENSIONS.spacerRowHeight);
const itemHeight = calculateItemHeight(contentItems[0]).totalHeight;
const reservedSpace = (spacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight) + SECTION_HEIGHTS.totalBox + (spacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight) + SECTION_HEIGHTS.footerFull;
const projectedHeight = currentPageHeight + itemHeight + reservedSpace;

console.log(`\nHeight calculation:`);
console.log(`  Header + TableHeader: ${SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader}px`);
console.log(`  Pre-item spacing: ${spacing.preItem * PAGE_DIMENSIONS.spacerRowHeight}px`);
console.log(`  Current page height: ${currentPageHeight}px`);
console.log(`  Item height: ${itemHeight}px`);
console.log(`  Reserved (beforeTotal + totalBox + afterTotal + footer): ${reservedSpace}px`);
console.log(`  Projected total: ${projectedHeight}px`);
console.log(`  Page capacity: ${PAGE_DIMENSIONS.contentHeight}px`);
console.log(`  OVERFLOW: ${projectedHeight > PAGE_DIMENSIONS.contentHeight ? 'YES' : 'NO'} (${projectedHeight - PAGE_DIMENSIONS.contentHeight}px over)`);

const breakpoints = calculatePaginationBreakpoints(contentItems);
console.log(`\nBreakpoints: ${JSON.stringify(breakpoints, null, 2)}`);

const paginationResult = paginateInvoice(testItems);
console.log(`\nLayout mode: ${paginationResult.layoutMode}`);
console.log(`Total pages: ${paginationResult.totalPages}`);
console.log(`Item distribution: [${paginationResult.itemDistribution.join(', ')}]`);
paginationResult.pages.forEach((page, idx) => {
  console.log(`\nPage ${idx + 1}:`);
  console.log(`  Type: ${page.type}`);
  console.log(`  Items: ${page.sections.items.length}`);
  console.log(`  Has Total Box: ${page.sections.totalBox}`);
  console.log(`  Spacing: pre=${page.spacing.preItem}, between=${page.spacing.betweenItems}, beforeTotal=${page.spacing.beforeTotal}`);
  console.log(`  Rows used: ${page.rowsUsed}`);
});

// Step 3: Check composed layout
console.log('\n\nStep 3: Composed Layout');
try {
  const composedLayout = composeInvoicePackage(
    paginationResult.pages,
    testItems.length,
    paginationResult.layoutMode,
    'bundle'
  );

  composedLayout.pages.forEach((page, pageIdx) => {
    if (page.pageType === 'invoice' || page.pageType === 'invoice-continuation') {
      console.log(`\nPage ${pageIdx + 1} (${page.pageType}):`);
      console.log(`  Total rows: ${page.totalRows}`);
      console.log(`  Row heights array length: ${page.rowHeightsPx.length}`);

      // Find the notes row (should be taller than usual)
      const tallRows = page.rowHeightsPx
        .map((h, i) => ({ height: h, row: i + 1 }))
        .filter(r => r.height > 50)
        .slice(0, 5);

      console.log(`  Tall rows (>50px): ${JSON.stringify(tallRows)}`);

      // Find the notes cell
      const notesCells = Object.entries(page.cells)
        .filter(([key, cell]) => {
          const val = String(cell.value || '');
          return val.includes('Notes>') || val.includes('2022') || val.includes('Dec 23');
        })
        .slice(0, 3);

      if (notesCells.length > 0) {
        console.log('  Notes-related cells:');
        notesCells.forEach(([key, cell]) => {
          console.log(`    ${key}: "${String(cell.value).substring(0, 50)}..."`);
        });
      }

      // Show row heights around the notes row (row 27)
      console.log('\n  Row heights around notes (rows 23-32):');
      for (let i = 22; i < Math.min(32, page.rowHeightsPx.length); i++) {
        const marker = i === 26 ? ' <-- NOTES ROW' : '';
        console.log(`    Row ${i + 1}: ${page.rowHeightsPx[i]}px${marker}`);
      }

      // Calculate total height
      const totalHeight = page.rowHeightsPx.reduce((acc, h) => acc + h, 0);
      console.log(`\n  Total page height: ${totalHeight}px`);

      // Check the gridTemplateRows that would be generated
      const rowTemplate = page.rowHeightsPx.map(h => `${h}px`).join(' ');
      console.log(`  Grid template rows (first 200 chars): ${rowTemplate.substring(0, 200)}...`);
      console.log(`  Grid template rows contains "434": ${rowTemplate.includes('434')}`)
    }
  });
} catch (error) {
  console.error('Error composing layout:', error);
}
