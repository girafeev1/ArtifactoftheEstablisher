/**
 * Pagination Engine for Dynamic Invoice Generation
 *
 * Handles multi-page invoice layout with:
 * - Version B single page (1-5 items)
 * - Version B multi-page (6+ items with continuation pages)
 * - Aesthetic item distribution
 * - Dynamic spacing based on item count
 */

import {
  getSpacingRules,
  calculateItemSectionRows,
  calculateItemCapacity,
  distributeItemsAcrossPages,
  calculateNoteRows,
} from './spacingCalculator';

export interface InvoiceItem {
  title: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  quantityUnit: string;
  subQuantity?: string;
  notes?: string;
  discount?: number;
}

export interface PageLayout {
  pageNumber: number;
  type: 'single' | 'first' | 'continuation';
  sections: {
    header: string;           // Section ID
    tableHeader: string;      // Section ID
    items: InvoiceItem[];     // Items on this page
    totalBox: boolean;        // Include total box?
    footer: string;           // Section ID
  };
  spacing: {
    preItem: number;          // Rows before first item
    betweenItems: number;     // Rows between items
    beforeTotal: number;      // Rows before total/footer
  };
  rowsUsed: number;
  rowsAvailable: number;
}

export interface InvoicePaginationResult {
  pages: PageLayout[];
  totalPages: number;
  itemDistribution: number[];
  layoutMode: 'single-page' | 'multi-page';
}

/**
 * Calculate pagination for an invoice
 */
export function paginateInvoice(items: InvoiceItem[]): InvoicePaginationResult {
  const itemCount = items.length;

  // Calculate item rows (accounting for expanded notes)
  const itemRowCounts = items.map(item => {
    const baseRows = 3; // title + fee type + notes
    if (item.notes && item.notes.length > 100) {
      // Estimate additional rows for long notes
      return baseRows + calculateNoteRows(item.notes) - 1;
    }
    return baseRows;
  });

  // Page 1 available space
  // Total page: 51 rows
  // Header: 22 rows
  // Footer (simple): 2 rows
  // Available for items: 51 - 22 - 2 = 27 rows
  const page1AvailableRows = 27;

  // Continuation page available space
  // Total page: 56 rows (from row 52 to row 107)
  // Header: 10 rows
  // Footer (full): 10 rows
  // Total box: 3 rows
  // Available for items: 56 - 10 - 10 - 3 = 33 rows
  const continuationAvailableRows = 33;

  // Calculate capacity for Page 1 (no total box on Page 1 when multi-page)
  const page1Capacity = calculateItemCapacity(
    page1AvailableRows,
    3, // rows per item
    true, // include table header
    false // NO total box on Page 1 if paginating
  );

  // Single page scenario
  if (itemCount <= page1Capacity) {
    // Check if items + total box fit on single page
    const singlePageCalc = calculateItemSectionRows(
      itemCount,
      3,
      true, // table header
      true  // total box
    );

    if (singlePageCalc.totalRowsNeeded <= page1AvailableRows) {
      // Single page with total
      const spacing = getSpacingRules(itemCount);

      return {
        pages: [{
          pageNumber: 1,
          type: 'single',
          sections: {
            header: 'header-versionB-full',
            tableHeader: 'item-table-header',
            items: items,
            totalBox: true,
            footer: 'footer-full-payment',
          },
          spacing: {
            preItem: spacing.preItemSpacing,
            betweenItems: spacing.betweenItemSpacing,
            beforeTotal: spacing.beforeTotalSpacing,
          },
          rowsUsed: 22 + singlePageCalc.totalRowsNeeded + 10, // header + items + footer
          rowsAvailable: 51,
        }],
        totalPages: 1,
        itemDistribution: [itemCount],
        layoutMode: 'single-page',
      };
    }
  }

  // Multi-page scenario
  const pages: PageLayout[] = [];

  // Page 1: Pack as many items as possible (no total box)
  const page1ItemCount = Math.min(itemCount, page1Capacity);
  const page1Spacing = getSpacingRules(page1ItemCount);
  const page1Calc = calculateItemSectionRows(page1ItemCount, 3, true, false);

  pages.push({
    pageNumber: 1,
    type: 'first',
    sections: {
      header: 'header-versionB-full',
      tableHeader: 'item-table-header',
      items: items.slice(0, page1ItemCount),
      totalBox: false,
      footer: 'footer-continuation-simple',
    },
    spacing: {
      preItem: page1Spacing.preItemSpacing,
      betweenItems: page1Spacing.betweenItemSpacing,
      beforeTotal: page1Spacing.beforeTotalSpacing,
    },
    rowsUsed: 22 + page1Calc.totalRowsNeeded + 2,
    rowsAvailable: 51,
  });

  // Continuation pages
  let remainingItems = items.slice(page1ItemCount);
  let pageNumber = 2;

  while (remainingItems.length > 0) {
    const continuationCapacity = calculateItemCapacity(
      continuationAvailableRows,
      3,
      true, // table header
      true  // total box (will be on last page)
    );

    const itemsOnThisPage = Math.min(remainingItems.length, continuationCapacity);
    const isLastPage = remainingItems.length <= continuationCapacity;

    const spacing = getSpacingRules(itemsOnThisPage);
    const calc = calculateItemSectionRows(
      itemsOnThisPage,
      3,
      true,
      isLastPage // total box only on last page
    );

    pages.push({
      pageNumber,
      type: 'continuation',
      sections: {
        header: 'header-continuation-minimal',
        tableHeader: 'item-table-header',
        items: remainingItems.slice(0, itemsOnThisPage),
        totalBox: isLastPage,
        footer: isLastPage ? 'footer-full-payment' : 'footer-continuation-simple',
      },
      spacing: {
        preItem: spacing.preItemSpacing,
        betweenItems: spacing.betweenItemSpacing,
        beforeTotal: spacing.beforeTotalSpacing,
      },
      rowsUsed: 10 + calc.totalRowsNeeded + (isLastPage ? 10 : 2),
      rowsAvailable: 56,
    });

    remainingItems = remainingItems.slice(itemsOnThisPage);
    pageNumber++;
  }

  const itemDistribution = pages.map(p => p.sections.items.length);

  return {
    pages,
    totalPages: pages.length,
    itemDistribution,
    layoutMode: 'multi-page',
  };
}

/**
 * Generate a visual representation of the pagination result
 */
export function visualizePagination(result: InvoicePaginationResult): string {
  const lines: string[] = [];

  lines.push('=== Invoice Pagination Result ===\n');
  lines.push(`Layout Mode: ${result.layoutMode}`);
  lines.push(`Total Pages: ${result.totalPages}`);
  lines.push(`Item Distribution: [${result.itemDistribution.join(', ')}]\n`);

  result.pages.forEach(page => {
    lines.push(`┌─ Page ${page.pageNumber} (${page.type}) ─┐`);
    lines.push(`│ Rows Available: ${page.rowsAvailable}`);
    lines.push(`│ Rows Used: ${page.rowsUsed}`);
    lines.push(`│`);
    lines.push(`│ Sections:`);
    lines.push(`│   Header: ${page.sections.header}`);
    lines.push(`│   Table Header: ${page.sections.tableHeader}`);
    lines.push(`│   Items: ${page.sections.items.length}`);
    lines.push(`│   Total Box: ${page.sections.totalBox ? 'YES' : 'NO'}`);
    lines.push(`│   Footer: ${page.sections.footer}`);
    lines.push(`│`);
    lines.push(`│ Spacing:`);
    lines.push(`│   Pre-item: ${page.spacing.preItem} rows`);
    lines.push(`│   Between items: ${page.spacing.betweenItems} rows`);
    lines.push(`│   Before total: ${page.spacing.beforeTotal} rows`);
    lines.push(`└─────────────────────────┘\n`);
  });

  return lines.join('\n');
}

/**
 * Test the pagination engine with different item counts
 */
export function testPaginationEngine() {
  console.log('=== Pagination Engine Test Cases ===\n');

  // Helper to create mock items
  const createMockItems = (count: number): InvoiceItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      title: `Service ${i + 1}`,
      feeType: 'Professional Fee',
      unitPrice: 1000,
      quantity: 1,
      quantityUnit: 'hour',
      notes: i % 3 === 0 ? 'This is a longer note that might wrap to multiple lines' : 'Short note',
    }));
  };

  // Test 1: 1 item (single page)
  console.log('Test 1: 1 item');
  const result1 = paginateInvoice(createMockItems(1));
  console.log(visualizePagination(result1));

  // Test 2: 3 items (single page)
  console.log('Test 2: 3 items');
  const result3 = paginateInvoice(createMockItems(3));
  console.log(visualizePagination(result3));

  // Test 3: 5 items (single page, packed)
  console.log('Test 3: 5 items');
  const result5 = paginateInvoice(createMockItems(5));
  console.log(visualizePagination(result5));

  // Test 4: 7 items (multi-page)
  console.log('Test 4: 7 items (multi-page)');
  const result7 = paginateInvoice(createMockItems(7));
  console.log(visualizePagination(result7));

  // Test 5: 10 items (multi-page)
  console.log('Test 5: 10 items (multi-page)');
  const result10 = paginateInvoice(createMockItems(10));
  console.log(visualizePagination(result10));
}
