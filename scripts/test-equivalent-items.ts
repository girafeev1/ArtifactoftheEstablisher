import {
  calculateItemHeight,
  getEquivalentItemCount,
  getTotalEquivalentItems,
  calculateSpacing,
  calculatePaginationBreakpoints,
  getPaginationSummary,
  type InvoiceItem,
} from '../lib/invoiceTemplates/contentHeightCalculator';

// Test with mixed items: 1 normal, 1 with 28 lines, 1 normal
const testItems: InvoiceItem[] = [
  { title: 'Item 1', feeType: 'Professional Fee' },
  {
    title: 'Item 2 with 28 session dates',
    feeType: 'Consultation',
    notes: Array.from({ length: 28 }, (_, i) => `Session ${i + 1}: Jan ${i + 1}, 2025`).join('\n'),
  },
  { title: 'Item 3', feeType: 'Administrative Fee' },
];

console.log('=== Equivalent Item Count Test ===\n');

testItems.forEach((item, idx) => {
  const height = calculateItemHeight(item);
  const equiv = getEquivalentItemCount(item);
  console.log(`Item ${idx + 1}: "${item.title}"`);
  console.log(`  Has notes: ${height.hasNotes}`);
  console.log(`  Notes lines: ${height.notesLineCount}`);
  console.log(`  Actual rows: ${height.actualRowCount}`);
  console.log(`  Equivalent items: ${equiv}`);
  console.log(`  Total height: ${height.totalHeight}px`);
  console.log(`  Notes height: ${height.notesRowHeight}px`);
  console.log('');
});

const totalEquiv = getTotalEquivalentItems(testItems);
console.log(`Total equivalent items: ${totalEquiv}`);
console.log(`(Should use 5+ items spacing rules: 1 pre, 2 between, 2 before total)\n`);

const spacing = calculateSpacing(totalEquiv);
console.log('Spacing rules applied:');
console.log(`  Pre-item: ${spacing.preItem} rows`);
console.log(`  Between items: ${spacing.betweenItems} rows`);
console.log(`  Before total: ${spacing.beforeTotal} rows`);
console.log(`  After total: ${spacing.afterTotal} rows`);
console.log('');

console.log('=== Pagination Breakpoints ===\n');
const breakpoints = calculatePaginationBreakpoints(testItems);
breakpoints.forEach(bp => {
  console.log(`Page ${bp.pageNumber}:`);
  console.log(`  Items ${bp.startItemIndex + 1}-${bp.endItemIndex + 1} (${bp.itemCount} items)`);
  console.log(`  Content height: ${bp.contentHeight}px`);
  console.log(`  Remaining space: ${bp.remainingSpace}px`);
  console.log(`  Includes total box: ${bp.includesTotalBox}`);
  console.log('');
});

console.log('=== Summary ===\n');
const summary = getPaginationSummary(testItems);
console.log(`Total pages: ${summary.totalPages}`);
console.log(`Breakdown:\n${summary.breakdown}`);
console.log(`Warnings: ${JSON.stringify(summary.warnings)}`);
console.log(`Overflow amount: ${summary.details.overflowAmount} px`);
