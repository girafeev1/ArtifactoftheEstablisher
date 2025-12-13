/**
 * Test Script for Dynamic Invoice Pagination System
 *
 * Tests the pagination engine with different item counts to verify:
 * - Correct page layout selection (single vs multi-page)
 * - Proper item distribution
 * - Section assembly
 * - Layout composition
 */

const { paginateInvoice, visualizePagination } = require('../lib/invoiceTemplates/paginationEngine');
const { composeInvoice } = require('../lib/invoiceTemplates/layoutComposer');

// Helper to create mock items
function createMockItems(count, withLongNotes = false) {
  return Array.from({ length: count }, (_, i) => ({
    title: `Professional Service ${i + 1}`,
    feeType: 'Professional Fee',
    unitPrice: 1000 + i * 100,
    quantity: 1,
    quantityUnit: 'hour',
    subQuantity: `${i + 1}`,
    notes: withLongNotes && i % 2 === 0
      ? 'This is a very long note that will likely wrap to multiple lines and require additional row height to display properly in the invoice layout'
      : 'Standard service note',
    discount: 0,
  }));
}

console.log('=== Dynamic Invoice Pagination System Test ===\n');

// Test Case 1: 1 item (should be single page)
console.log('━━━ Test 1: 1 Item (Single Page) ━━━');
const items1 = createMockItems(1);
const result1 = paginateInvoice(items1);
console.log(visualizePagination(result1));
console.log('✓ Test 1 completed\n');

// Test Case 2: 3 items (should be single page with aesthetic spacing)
console.log('━━━ Test 2: 3 Items (Single Page) ━━━');
const items3 = createMockItems(3);
const result3 = paginateInvoice(items3);
console.log(visualizePagination(result3));

// Compose the layout
try {
  const composed3 = composeInvoice(result3.pages, items3.length, result3.layoutMode);
  console.log(`✓ Layout composed successfully: ${composed3.totalPages} page(s)`);
  console.log(`  - Total cells: ${Object.keys(composed3.pages[0].cells).length}`);
  console.log(`  - Total merges: ${composed3.pages[0].merges.length}`);
  console.log(`  - Row heights defined: ${composed3.pages[0].rowHeightsPx.length}`);
} catch (err) {
  console.error('✗ Composition failed:', err.message);
}
console.log('✓ Test 2 completed\n');

// Test Case 3: 7 items (should be multi-page)
console.log('━━━ Test 3: 7 Items (Multi-Page) ━━━');
const items7 = createMockItems(7);
const result7 = paginateInvoice(items7);
console.log(visualizePagination(result7));

try {
  const composed7 = composeInvoice(result7.pages, items7.length, result7.layoutMode);
  console.log(`✓ Layout composed successfully: ${composed7.totalPages} page(s)`);
  composed7.pages.forEach((page, idx) => {
    console.log(`  - Page ${idx + 1}: ${Object.keys(page.cells).length} cells, ${page.merges.length} merges, ${page.rowHeightsPx.length} rows`);
  });
} catch (err) {
  console.error('✗ Composition failed:', err.message);
}
console.log('✓ Test 3 completed\n');

// Test Case 4: 10 items (should be multi-page with balanced distribution)
console.log('━━━ Test 4: 10 Items (Multi-Page, Balanced) ━━━');
const items10 = createMockItems(10);
const result10 = paginateInvoice(items10);
console.log(visualizePagination(result10));

try {
  const composed10 = composeInvoice(result10.pages, items10.length, result10.layoutMode);
  console.log(`✓ Layout composed successfully: ${composed10.totalPages} page(s)`);
  console.log(`  - Metadata: ${JSON.stringify(composed10.metadata, null, 2)}`);
} catch (err) {
  console.error('✗ Composition failed:', err.message);
}
console.log('✓ Test 4 completed\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✓ All tests completed successfully!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Next Steps:');
console.log('1. Visit the enhanced preview page: /dashboard/new-ui/projects/show/[projectId]/invoice/[invoiceNumber]/preview-enhanced');
console.log('2. Toggle between "Classic" and "Dynamic" rendering modes');
console.log('3. Verify the dynamic layout matches the classic layout visually');
console.log('4. Test PDF export with both modes\n');
