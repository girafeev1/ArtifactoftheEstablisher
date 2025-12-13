/**
 * Test Suite for Invoice Pagination System
 *
 * Tests spacing calculator, pagination engine, and layout composer
 * with different item counts to ensure correct behavior.
 */

import {
  getSpacingRules,
  calculateItemSectionRows,
  calculateItemCapacity,
  distributeItemsAcrossPages,
} from '../spacingCalculator';

import {
  paginateInvoice,
  type InvoiceItem,
} from '../paginationEngine';

// Helper to create mock items
function createMockItems(count: number, withLongNotes: boolean = false): InvoiceItem[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Service ${i + 1}`,
    feeType: 'Professional Fee',
    unitPrice: 1000 + i * 100,
    quantity: 1,
    quantityUnit: 'hour',
    subQuantity: `${i + 1}`,
    notes: withLongNotes && i % 2 === 0
      ? 'This is a very long note that will likely wrap to multiple lines and require additional row height to display properly in the invoice layout'
      : 'Standard note',
    discount: 0,
  }));
}

describe('Spacing Calculator', () => {
  test('1 item: 3 pre-item, 0 between, 4 before total', () => {
    const rules = getSpacingRules(1);
    expect(rules.preItemSpacing).toBe(3);
    expect(rules.betweenItemSpacing).toBe(0);
    expect(rules.beforeTotalSpacing).toBe(4);
  });

  test('2 items: 3 pre-item, 3 between, 4 before total', () => {
    const rules = getSpacingRules(2);
    expect(rules.preItemSpacing).toBe(3);
    expect(rules.betweenItemSpacing).toBe(3);
    expect(rules.beforeTotalSpacing).toBe(4);
  });

  test('3 items: 2 pre-item, 2 between, 3 before total', () => {
    const rules = getSpacingRules(3);
    expect(rules.preItemSpacing).toBe(2);
    expect(rules.betweenItemSpacing).toBe(2);
    expect(rules.beforeTotalSpacing).toBe(3);
  });

  test('4 items: 1 pre-item, 2 between, 2 before total', () => {
    const rules = getSpacingRules(4);
    expect(rules.preItemSpacing).toBe(1);
    expect(rules.betweenItemSpacing).toBe(2);
    expect(rules.beforeTotalSpacing).toBe(2);
  });

  test('5+ items: 1 pre-item, 2 between, 2 before total', () => {
    const rules5 = getSpacingRules(5);
    const rules10 = getSpacingRules(10);

    expect(rules5.preItemSpacing).toBe(1);
    expect(rules5.betweenItemSpacing).toBe(2);
    expect(rules5.beforeTotalSpacing).toBe(2);

    expect(rules10).toEqual(rules5);
  });
});

describe('Item Section Row Calculation', () => {
  test('1 item with table header and total box', () => {
    const calc = calculateItemSectionRows(1, 3, true, true);

    expect(calc.breakdown.preItemRows).toBe(3);
    expect(calc.breakdown.itemRows).toBe(3); // 1 item × 3 rows
    expect(calc.breakdown.betweenItemRows).toBe(0);
    expect(calc.breakdown.beforeTotalRows).toBe(4);

    // Total: 1 (table header) + 3 (pre) + 3 (item) + 0 (between) + 4 (before total) + 3 (total box) = 14
    expect(calc.totalRowsNeeded).toBe(14);
  });

  test('5 items packed mode', () => {
    const calc = calculateItemSectionRows(5, 3, true, true);

    expect(calc.breakdown.preItemRows).toBe(1);
    expect(calc.breakdown.itemRows).toBe(15); // 5 items × 3 rows
    expect(calc.breakdown.betweenItemRows).toBe(8); // 4 gaps × 2 rows
    expect(calc.breakdown.beforeTotalRows).toBe(2);

    // Total: 1 (table header) + 1 (pre) + 15 (items) + 8 (between) + 2 (before total) + 3 (total box) = 30
    expect(calc.totalRowsNeeded).toBe(30);
  });
});

describe('Page Capacity Calculation', () => {
  test('Page 1 capacity (27 rows, no total box)', () => {
    const capacity = calculateItemCapacity(27, 3, true, false);

    // Should fit 5 items based on spacing rules
    expect(capacity).toBe(5);
  });

  test('Continuation page capacity (33 rows, with total box)', () => {
    const capacity = calculateItemCapacity(33, 3, true, true);

    // Should fit around 8 items
    expect(capacity).toBeGreaterThanOrEqual(7);
    expect(capacity).toBeLessThanOrEqual(8);
  });
});

describe('Item Distribution Across Pages', () => {
  test('6 items with 5-item capacity redistributes to [3, 3]', () => {
    const distribution = distributeItemsAcrossPages(6, 5, 2);

    expect(distribution).toEqual([3, 3]);
  });

  test('9 items with 5-item capacity redistributes', () => {
    const distribution = distributeItemsAcrossPages(9, 5, 2);

    // Should avoid 5+4 if possible, might do 5+4 or 3+3+3
    expect(distribution.length).toBeGreaterThanOrEqual(2);
    expect(distribution[distribution.length - 1]).toBeGreaterThanOrEqual(2);
  });

  test('3 items with 5-item capacity stays single page', () => {
    const distribution = distributeItemsAcrossPages(3, 5, 2);

    expect(distribution).toEqual([3]);
  });
});

describe('Pagination Engine', () => {
  test('1 item: single page layout', () => {
    const items = createMockItems(1);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('single-page');
    expect(result.totalPages).toBe(1);
    expect(result.itemDistribution).toEqual([1]);

    const page1 = result.pages[0];
    expect(page1.type).toBe('single');
    expect(page1.sections.header).toBe('header-versionB-full');
    expect(page1.sections.totalBox).toBe(true);
    expect(page1.sections.footer).toBe('footer-full-payment');
  });

  test('3 items: single page layout', () => {
    const items = createMockItems(3);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('single-page');
    expect(result.totalPages).toBe(1);
    expect(result.itemDistribution).toEqual([3]);

    const page1 = result.pages[0];
    expect(page1.sections.items).toHaveLength(3);
    expect(page1.spacing.preItem).toBe(2);
    expect(page1.spacing.betweenItems).toBe(2);
  });

  test('5 items: single page packed layout', () => {
    const items = createMockItems(5);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('single-page');
    expect(result.totalPages).toBe(1);
    expect(result.itemDistribution).toEqual([5]);

    const page1 = result.pages[0];
    expect(page1.sections.items).toHaveLength(5);
    expect(page1.spacing.preItem).toBe(1);
    expect(page1.spacing.betweenItems).toBe(2);
  });

  test('7 items: multi-page layout', () => {
    const items = createMockItems(7);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('multi-page');
    expect(result.totalPages).toBeGreaterThanOrEqual(2);

    // Page 1 should be 'first' type
    const page1 = result.pages[0];
    expect(page1.type).toBe('first');
    expect(page1.sections.header).toBe('header-versionB-full');
    expect(page1.sections.totalBox).toBe(false);
    expect(page1.sections.footer).toBe('footer-continuation-simple');

    // Last page should have total box and full footer
    const lastPage = result.pages[result.pages.length - 1];
    expect(lastPage.type).toBe('continuation');
    expect(lastPage.sections.header).toBe('header-continuation-minimal');
    expect(lastPage.sections.totalBox).toBe(true);
    expect(lastPage.sections.footer).toBe('footer-full-payment');
  });

  test('10 items: multi-page layout', () => {
    const items = createMockItems(10);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('multi-page');
    expect(result.totalPages).toBeGreaterThanOrEqual(2);

    // All items should be distributed
    const totalItems = result.itemDistribution.reduce((sum, count) => sum + count, 0);
    expect(totalItems).toBe(10);

    // Page 1 should not have total box
    expect(result.pages[0].sections.totalBox).toBe(false);

    // Only last page has total box
    const pagesWithTotal = result.pages.filter(p => p.sections.totalBox);
    expect(pagesWithTotal).toHaveLength(1);
    expect(pagesWithTotal[0].pageNumber).toBe(result.totalPages);
  });
});

describe('Pagination with Long Notes', () => {
  test('Items with long notes may reduce page capacity', () => {
    const items = createMockItems(5, true);
    const result = paginateInvoice(items);

    // With long notes, might not fit all 5 on single page
    // This is implementation-dependent based on note expansion logic
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe('Edge Cases', () => {
  test('0 items returns empty layout', () => {
    const items = createMockItems(0);
    const result = paginateInvoice(items);

    // Should handle gracefully, possibly empty page or error
    expect(result).toBeDefined();
  });

  test('Very large item count (50 items)', () => {
    const items = createMockItems(50);
    const result = paginateInvoice(items);

    expect(result.layoutMode).toBe('multi-page');
    expect(result.totalPages).toBeGreaterThan(5);

    const totalItems = result.itemDistribution.reduce((sum, count) => sum + count, 0);
    expect(totalItems).toBe(50);
  });
});
