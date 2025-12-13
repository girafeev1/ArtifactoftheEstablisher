/**
 * Spacing Calculator for Dynamic Invoice Layout
 *
 * Implements the user's spacing rules based on item count:
 * - 1 item: 3 rows pre-item, 4 rows before total
 * - 2 items: 3 rows pre-item, 3 rows between items, 4 rows before total
 * - 3 items: 2 rows pre-item, 2 rows between items, 3 rows before total
 * - 4 items: 1 row pre-item, 2 rows between items, 2 rows before total
 * - 5+ items: 1 row pre-item, 2 rows between items, 2 rows before total
 */

export interface SpacingRules {
  preItemSpacing: number;      // Rows before first item
  betweenItemSpacing: number;  // Rows between each item
  beforeTotalSpacing: number;  // Rows before total box (or footer if no total)
}

export interface ItemSpacingCalculation {
  rules: SpacingRules;
  totalRowsNeeded: number;
  breakdown: {
    preItemRows: number;
    itemRows: number;
    betweenItemRows: number;
    beforeTotalRows: number;
  };
}

/**
 * Calculate spacing rules based on item count
 */
export function getSpacingRules(itemCount: number): SpacingRules {
  if (itemCount <= 0) {
    return { preItemSpacing: 0, betweenItemSpacing: 0, beforeTotalSpacing: 0 };
  }

  if (itemCount === 1) {
    return {
      preItemSpacing: 3,
      betweenItemSpacing: 0,
      beforeTotalSpacing: 4,
    };
  }

  if (itemCount === 2) {
    return {
      preItemSpacing: 3,
      betweenItemSpacing: 3,
      beforeTotalSpacing: 4,
    };
  }

  if (itemCount === 3) {
    return {
      preItemSpacing: 2,
      betweenItemSpacing: 2,
      beforeTotalSpacing: 3,
    };
  }

  if (itemCount === 4) {
    return {
      preItemSpacing: 1,
      betweenItemSpacing: 2,
      beforeTotalSpacing: 2,
    };
  }

  // 5+ items (packed mode)
  return {
    preItemSpacing: 1,
    betweenItemSpacing: 2,
    beforeTotalSpacing: 2,
  };
}

/**
 * Calculate total rows needed for a given number of items
 *
 * @param itemCount - Number of items to display
 * @param rowsPerItem - Rows each item occupies (default: 3)
 * @param includeTableHeader - Include 1 row for table header (default: true)
 * @param includeTotalBox - Include 3 rows for total box (default: true)
 */
export function calculateItemSectionRows(
  itemCount: number,
  rowsPerItem: number = 3,
  includeTableHeader: boolean = true,
  includeTotalBox: boolean = true
): ItemSpacingCalculation {
  const rules = getSpacingRules(itemCount);

  const tableHeaderRows = includeTableHeader ? 1 : 0;
  const preItemRows = rules.preItemSpacing;
  const itemRows = itemCount * rowsPerItem;
  const betweenItemRows = itemCount > 1 ? (itemCount - 1) * rules.betweenItemSpacing : 0;
  const beforeTotalRows = rules.beforeTotalSpacing;
  const totalBoxRows = includeTotalBox ? 3 : 0;

  const totalRowsNeeded =
    tableHeaderRows +
    preItemRows +
    itemRows +
    betweenItemRows +
    beforeTotalRows +
    totalBoxRows;

  return {
    rules,
    totalRowsNeeded,
    breakdown: {
      preItemRows,
      itemRows,
      betweenItemRows,
      beforeTotalRows,
    },
  };
}

/**
 * Calculate how many items fit in available space
 *
 * @param availableRows - Total rows available for items + spacing
 * @param rowsPerItem - Rows each item occupies (default: 3)
 * @param includeTableHeader - Reserve space for table header (default: true)
 * @param includeTotalBox - Reserve space for total box (default: true)
 */
export function calculateItemCapacity(
  availableRows: number,
  rowsPerItem: number = 3,
  includeTableHeader: boolean = true,
  includeTotalBox: boolean = true
): number {
  // Try different item counts and find the maximum that fits
  for (let itemCount = 10; itemCount >= 1; itemCount--) {
    const calc = calculateItemSectionRows(
      itemCount,
      rowsPerItem,
      includeTableHeader,
      includeTotalBox
    );

    if (calc.totalRowsNeeded <= availableRows) {
      return itemCount;
    }
  }

  return 0; // No items fit
}

/**
 * Distribute items across pages with aesthetic balancing
 *
 * Example: 6 items with 5-item page capacity
 * - Naive: [5, 1] - looks unbalanced
 * - Balanced: [3, 3] - more aesthetic
 */
export function distributeItemsAcrossPages(
  totalItems: number,
  itemsPerPage: number,
  minItemsOnLastPage: number = 2
): number[] {
  if (totalItems <= itemsPerPage) {
    return [totalItems];
  }

  const naiveDistribution: number[] = [];
  let remaining = totalItems;

  while (remaining > 0) {
    const itemsOnThisPage = Math.min(remaining, itemsPerPage);
    naiveDistribution.push(itemsOnThisPage);
    remaining -= itemsOnThisPage;
  }

  // Check if last page has too few items
  const lastPageItems = naiveDistribution[naiveDistribution.length - 1];

  if (lastPageItems < minItemsOnLastPage && naiveDistribution.length > 1) {
    // Redistribute to balance
    const totalPages = naiveDistribution.length;
    const itemsPerPageBalanced = Math.ceil(totalItems / totalPages);

    const balanced: number[] = [];
    remaining = totalItems;

    for (let i = 0; i < totalPages; i++) {
      const itemsOnThisPage = Math.min(remaining, itemsPerPageBalanced);
      balanced.push(itemsOnThisPage);
      remaining -= itemsOnThisPage;
    }

    return balanced;
  }

  return naiveDistribution;
}

/**
 * Calculate expanded row count for item notes
 *
 * @param noteText - The note text content
 * @param baseRowHeight - Base height of a row in pixels (default: 21)
 * @param charsPerLine - Approximate characters that fit per line (default: 80)
 */
export function calculateNoteRows(
  noteText: string,
  baseRowHeight: number = 21,
  charsPerLine: number = 80
): number {
  if (!noteText || noteText.trim().length === 0) {
    return 1; // Minimum 1 row even if empty
  }

  // Count explicit line breaks
  const explicitLines = (noteText.match(/\n/g) || []).length + 1;

  // Estimate wrapped lines
  const estimatedLines = Math.ceil(noteText.length / charsPerLine);

  // Use the maximum of explicit and estimated
  return Math.max(explicitLines, estimatedLines);
}

/**
 * Example usage and test cases
 */
export function testSpacingCalculator() {
  console.log('=== Spacing Calculator Test Cases ===\n');

  // Test 1: Single item
  const test1 = calculateItemSectionRows(1);
  console.log('1 item:');
  console.log('  Pre-item spacing: 3 rows');
  console.log('  Item rows: 3 rows');
  console.log('  Before total: 4 rows');
  console.log(`  Total needed: ${test1.totalRowsNeeded} rows\n`);

  // Test 2: Two items
  const test2 = calculateItemSectionRows(2);
  console.log('2 items:');
  console.log('  Pre-item spacing: 3 rows');
  console.log('  Item rows: 6 rows (2 × 3)');
  console.log('  Between items: 3 rows');
  console.log('  Before total: 4 rows');
  console.log(`  Total needed: ${test2.totalRowsNeeded} rows\n`);

  // Test 3: Five items (packed)
  const test3 = calculateItemSectionRows(5);
  console.log('5 items (packed):');
  console.log('  Pre-item spacing: 1 row');
  console.log('  Item rows: 15 rows (5 × 3)');
  console.log('  Between items: 8 rows (4 × 2)');
  console.log('  Before total: 2 rows');
  console.log(`  Total needed: ${test3.totalRowsNeeded} rows\n`);

  // Test 4: Page 1 capacity (26 rows available)
  const page1Capacity = calculateItemCapacity(26, 3, true, false);
  console.log(`Page 1 capacity (26 rows available): ${page1Capacity} items\n`);

  // Test 5: Continuation page capacity (28 rows available)
  const contCapacity = calculateItemCapacity(28, 3, true, true);
  console.log(`Continuation page capacity (28 rows): ${contCapacity} items\n`);

  // Test 6: Distribution of 6 items with 5-item capacity
  const dist6 = distributeItemsAcrossPages(6, 5, 2);
  console.log(`6 items with 5-item pages: [${dist6.join(', ')}]`);
  console.log('  (Redistributed to avoid 1-item last page)\n');

  // Test 7: Distribution of 9 items
  const dist9 = distributeItemsAcrossPages(9, 5, 2);
  console.log(`9 items with 5-item pages: [${dist9.join(', ')}]\n`);
}
