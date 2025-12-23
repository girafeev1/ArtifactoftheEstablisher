import { paginateInvoice, type InvoiceItem } from '../lib/invoiceTemplates/paginationEngine';
import { PAGE_DIMENSIONS, SECTION_HEIGHTS } from '../lib/invoiceTemplates/contentHeightCalculator';

function createTestItems(count: number): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      title: 'Service Item ' + (i + 1) + ': Professional Consulting',
      feeType: 'Hourly Rate',
      unitPrice: 1500,
      quantity: 8,
      quantityUnit: 'hours',
      subQuantity: i % 2 === 0 ? '8 sessions' : undefined,
      notes: 'Standard notes for this item.',
    });
  }
  return items;
}

console.log('=== Invoice Pagination E2E Test ===\n');

const testCases = [1, 3, 5, 6, 7, 10, 15];

for (const count of testCases) {
  const items = createTestItems(count);
  const result = paginateInvoice(items);
  
  console.log('\n--- ' + count + ' items ---');
  console.log('Layout mode: ' + result.layoutMode);
  console.log('Total pages: ' + result.totalPages);
  console.log('Item distribution: [' + result.itemDistribution.join(', ') + ']');
  
  result.pages.forEach(page => {
    const firstIdx = page.sections.items[0]?.itemIndex ?? 0;
    const lastIdx = page.sections.items[page.sections.items.length - 1]?.itemIndex ?? -1;
    console.log('  Page ' + page.pageNumber + ' (' + page.type + '):');
    console.log('    - Items: ' + page.sections.items.length + ' (indices ' + firstIdx + '-' + lastIdx + ')');
    console.log('    - Total Box: ' + (page.sections.totalBox ? 'YES' : 'NO'));
    console.log('    - Rows: ' + page.rowsUsed + '/' + page.rowsAvailable);
  });
}

console.log('\n\n=== Page Dimensions ===');
console.log('Content height limit: ' + PAGE_DIMENSIONS.contentHeight + 'px');
console.log('Header Full: ' + SECTION_HEIGHTS.headerFull + 'px');
console.log('Header Continuation: ' + SECTION_HEIGHTS.headerContinuation + 'px');
console.log('Total Box + Footer Full: ' + (SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull) + 'px');

const firstPageFixed = SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader;
const totalBoxAndFooter = SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull;
const availableForItems = PAGE_DIMENSIONS.contentHeight - firstPageFixed - totalBoxAndFooter;
console.log('First page available for items + spacing: ' + availableForItems + 'px');
