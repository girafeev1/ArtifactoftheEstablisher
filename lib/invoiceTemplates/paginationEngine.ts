/**
 * Pagination Engine for Dynamic Invoice Generation
 *
 * Handles multi-page invoice layout with:
 * - Version B single page (1-5 items)
 * - Version B multi-page (6+ items with continuation pages)
 * - Aesthetic item distribution
 * - Dynamic spacing based on item count
 * - Content-aware height calculations for proper pagination
 */

import {
  getSpacingRules,
  calculateItemSectionRows,
  calculateItemCapacity,
  distributeItemsAcrossPages,
  calculateNoteRows,
} from './spacingCalculator';

import {
  calculateContentHeight,
  calculatePaginationBreakpoints,
  calculateItemHeight,
  getTotalEquivalentItems,
  calculateSpacing,
  SECTION_HEIGHTS,
  PAGE_DIMENSIONS,
  type InvoiceItem as ContentInvoiceItem,
} from './contentHeightCalculator';

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

export interface PageLayoutItem {
  itemIndex: number;          // 0-based index in the full invoice items array
  item: InvoiceItem;
}

export interface PageLayout {
  pageNumber: number;
  type: 'single' | 'first' | 'continuation';
  sections: {
    header: string;           // Section ID
    tableHeader: string;      // Section ID
    items: PageLayoutItem[];  // Items on this page with their global indices
    totalBox: boolean;        // Include total box?
    footer: string;           // Section ID
  };
  spacing: {
    preItem: number;          // Rows before first item
    betweenItems: number;     // Rows between items
    beforeTotal: number;      // Rows before total/footer
    afterTotal: number;       // Rows after total box
  };
  spacingPx: {
    preItemPx: number;        // Pixels before first item
    betweenItemsPx: number;   // Pixels between items
    beforeTotalPx: number;    // Pixels before total/footer
    afterTotalPx: number;     // Pixels after total box
  };
  dynamicSpacing: boolean;    // Whether spacing was dynamically distributed
  rowsUsed: number;
  rowsAvailable: number;
  remainingSpacePx: number;   // Remaining space on this page in pixels
}

export interface InvoicePaginationResult {
  pages: PageLayout[];
  totalPages: number;
  itemDistribution: number[];
  layoutMode: 'single-page' | 'multi-page';
}

/**
 * Calculate dynamic spacing distribution for a page.
 * When there's remaining space, distribute it evenly among spacing slots.
 */
function calculateDynamicSpacing(
  pageItemCount: number,
  hasTotalBox: boolean,
  remainingSpacePx: number,
  baseSpacing: { preItem: number; betweenItems: number; beforeTotal: number; afterTotal: number }
): {
  preItemPx: number;
  betweenItemsPx: number;
  beforeTotalPx: number;
  afterTotalPx: number;
  dynamicSpacing: boolean;
} {
  const spacerRowHeight = PAGE_DIMENSIONS.spacerRowHeight; // 21px

  // Base spacing in pixels
  const basePreItemPx = baseSpacing.preItem * spacerRowHeight;
  const baseBetweenItemsPx = baseSpacing.betweenItems * spacerRowHeight;
  const baseBeforeTotalPx = baseSpacing.beforeTotal * spacerRowHeight;
  const baseAfterTotalPx = baseSpacing.afterTotal * spacerRowHeight;

  // If no remaining space or negative, use base spacing
  if (remainingSpacePx <= 0) {
    return {
      preItemPx: basePreItemPx,
      betweenItemsPx: baseBetweenItemsPx,
      beforeTotalPx: baseBeforeTotalPx,
      afterTotalPx: baseAfterTotalPx,
      dynamicSpacing: false,
    };
  }

  // Count spacing slots:
  // - 1 preItem slot
  // - (itemCount - 1) betweenItems slots
  // - 1 beforeTotal slot (always present - before total box or before footer on non-final pages)
  // - 1 afterTotal slot (only on pages with total box)
  const betweenItemsSlots = Math.max(0, pageItemCount - 1);
  const totalSlots = 1 + betweenItemsSlots + 1 + (hasTotalBox ? 1 : 0);

  // Distribute remaining space evenly among slots
  const extraPerSlot = Math.floor(remainingSpacePx / totalSlots);

  return {
    preItemPx: basePreItemPx + extraPerSlot,
    betweenItemsPx: baseBetweenItemsPx + extraPerSlot,
    beforeTotalPx: baseBeforeTotalPx + extraPerSlot,
    afterTotalPx: baseAfterTotalPx + (hasTotalBox ? extraPerSlot : 0),
    dynamicSpacing: extraPerSlot > 0,
  };
}

/**
 * Calculate pagination for an invoice using CONTENT-AWARE height calculations.
 * This properly accounts for:
 * - Actual notes content height (line count × line height)
 * - Fixed section heights (header, footer, total box)
 * - Dynamic spacing based on item count
 * - Dynamic spacing distribution when pages have remaining space
 */
export function paginateInvoice(items: InvoiceItem[]): InvoicePaginationResult {
  const itemCount = items.length;

  // Convert to ContentInvoiceItem for height calculations
  const contentItems: ContentInvoiceItem[] = items.map(item => ({
    title: item.title,
    feeType: item.feeType,
    subQuantity: item.subQuantity,
    notes: item.notes,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    quantityUnit: item.quantityUnit,
    discount: item.discount,
  }));

  // Calculate actual content heights
  const contentHeight = calculateContentHeight(contentItems);
  const breakpoints = calculatePaginationBreakpoints(contentItems);

  // Calculate spacing based on EQUIVALENT item count (not actual item count)
  // This ensures spacing rules are coherent with variable-height items
  const totalEquivalent = getTotalEquivalentItems(contentItems);
  const equivalentSpacing = calculateSpacing(totalEquivalent);
  const spacerRowHeight = PAGE_DIMENSIONS.spacerRowHeight;

  // If single page, use simplified logic (no dynamic spacing needed)
  if (breakpoints.length === 1 && breakpoints[0].includesTotalBox) {
    const baseSpacingPx = {
      preItemPx: equivalentSpacing.preItem * spacerRowHeight,
      betweenItemsPx: equivalentSpacing.betweenItems * spacerRowHeight,
      beforeTotalPx: equivalentSpacing.beforeTotal * spacerRowHeight,
      afterTotalPx: equivalentSpacing.afterTotal * spacerRowHeight,
    };

    return {
      pages: [{
        pageNumber: 1,
        type: 'single',
        sections: {
          header: 'header-versionB-full',
          tableHeader: 'item-table-header',
          items: items.map((item, idx) => ({ itemIndex: idx, item })),
          totalBox: true,
          footer: 'footer-full-payment',
        },
        spacing: {
          preItem: equivalentSpacing.preItem,
          betweenItems: equivalentSpacing.betweenItems,
          beforeTotal: equivalentSpacing.beforeTotal,
          afterTotal: equivalentSpacing.afterTotal,
        },
        spacingPx: baseSpacingPx,
        dynamicSpacing: false,
        rowsUsed: Math.ceil(contentHeight.totalContentHeight / spacerRowHeight),
        rowsAvailable: Math.ceil(PAGE_DIMENSIONS.contentHeight / spacerRowHeight),
        remainingSpacePx: Math.max(0, PAGE_DIMENSIONS.contentHeight - contentHeight.totalContentHeight),
      }],
      totalPages: 1,
      itemDistribution: [itemCount],
      layoutMode: 'single-page',
    };
  }

  // Multi-page scenario using content-aware breakpoints
  // Calculate dynamic spacing to fill remaining space on each page
  const pages: PageLayout[] = [];

  breakpoints.forEach((bp, bpIndex) => {
    const isFirstPage = bpIndex === 0;
    const pageItems = items.slice(bp.startItemIndex, bp.endItemIndex + 1);
    const pageItemCount = pageItems.length;

    // Calculate dynamic spacing for this page
    const dynamicSpacingResult = calculateDynamicSpacing(
      pageItemCount,
      bp.includesTotalBox,
      bp.remainingSpace,
      {
        preItem: equivalentSpacing.preItem,
        betweenItems: equivalentSpacing.betweenItems,
        beforeTotal: equivalentSpacing.beforeTotal,
        afterTotal: equivalentSpacing.afterTotal,
      }
    );

    pages.push({
      pageNumber: bp.pageNumber,
      type: isFirstPage ? 'first' : 'continuation',
      sections: {
        header: isFirstPage ? 'header-versionB-full' : 'header-continuation-minimal',
        tableHeader: 'item-table-header',
        items: pageItems.map((item, idx) => ({
          itemIndex: bp.startItemIndex + idx,
          item,
        })),
        totalBox: bp.includesTotalBox,
        footer: bp.includesTotalBox ? 'footer-full-payment' : 'footer-continuation-simple',
      },
      spacing: {
        // Keep row-based spacing for backward compatibility
        preItem: equivalentSpacing.preItem,
        betweenItems: equivalentSpacing.betweenItems,
        beforeTotal: equivalentSpacing.beforeTotal,
        afterTotal: equivalentSpacing.afterTotal,
      },
      spacingPx: dynamicSpacingResult,
      dynamicSpacing: dynamicSpacingResult.dynamicSpacing,
      rowsUsed: Math.ceil(bp.contentHeight / spacerRowHeight),
      rowsAvailable: Math.ceil(PAGE_DIMENSIONS.contentHeight / spacerRowHeight),
      remainingSpacePx: bp.remainingSpace,
    });
  });

  const itemDistribution = pages.map(p => p.sections.items.length);

  return {
    pages,
    totalPages: pages.length,
    itemDistribution,
    layoutMode: 'multi-page',
  };
}

/**
 * Legacy pagination function for backward compatibility.
 * Uses row-based calculations (less accurate for long notes).
 */
export function paginateInvoiceLegacy(items: InvoiceItem[]): InvoicePaginationResult {
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
  const page1AvailableRows = 27;
  const continuationAvailableRows = 33;

  const page1Capacity = calculateItemCapacity(
    page1AvailableRows,
    3,
    true,
    false
  );

  // Single page scenario
  if (itemCount <= page1Capacity) {
    const singlePageCalc = calculateItemSectionRows(itemCount, 3, true, true);

    if (singlePageCalc.totalRowsNeeded <= page1AvailableRows) {
      const spacing = getSpacingRules(itemCount);
      const spacerRowHeight = 21;

      return {
        pages: [{
          pageNumber: 1,
          type: 'single',
          sections: {
            header: 'header-versionB-full',
            tableHeader: 'item-table-header',
            items: items.map((item, idx) => ({ itemIndex: idx, item })),
            totalBox: true,
            footer: 'footer-full-payment',
          },
          spacing: {
            preItem: spacing.preItemSpacing,
            betweenItems: spacing.betweenItemSpacing,
            beforeTotal: spacing.beforeTotalSpacing,
            afterTotal: 0,
          },
          spacingPx: {
            preItemPx: spacing.preItemSpacing * spacerRowHeight,
            betweenItemsPx: spacing.betweenItemSpacing * spacerRowHeight,
            beforeTotalPx: spacing.beforeTotalSpacing * spacerRowHeight,
            afterTotalPx: 0,
          },
          dynamicSpacing: false,
          rowsUsed: 22 + singlePageCalc.totalRowsNeeded + 10,
          rowsAvailable: 51,
          remainingSpacePx: 0,
        }],
        totalPages: 1,
        itemDistribution: [itemCount],
        layoutMode: 'single-page',
      };
    }
  }

  // Multi-page scenario
  const pages: PageLayout[] = [];
  let currentItemIndex = 0;
  const spacerRowHeight = 21;

  const page1ItemCount = Math.min(itemCount, page1Capacity);
  const page1Spacing = getSpacingRules(page1ItemCount);
  const page1Calc = calculateItemSectionRows(page1ItemCount, 3, true, false);

  pages.push({
    pageNumber: 1,
    type: 'first',
    sections: {
      header: 'header-versionB-full',
      tableHeader: 'item-table-header',
      items: items.slice(0, page1ItemCount).map((item, idx) => ({
        itemIndex: currentItemIndex + idx,
        item,
      })),
      totalBox: false,
      footer: 'footer-continuation-simple',
    },
    spacing: {
      preItem: page1Spacing.preItemSpacing,
      betweenItems: page1Spacing.betweenItemSpacing,
      beforeTotal: page1Spacing.beforeTotalSpacing,
      afterTotal: 0,
    },
    spacingPx: {
      preItemPx: page1Spacing.preItemSpacing * spacerRowHeight,
      betweenItemsPx: page1Spacing.betweenItemSpacing * spacerRowHeight,
      beforeTotalPx: page1Spacing.beforeTotalSpacing * spacerRowHeight,
      afterTotalPx: 0,
    },
    dynamicSpacing: false,
    rowsUsed: 22 + page1Calc.totalRowsNeeded + 2,
    rowsAvailable: 51,
    remainingSpacePx: 0,
  });
  currentItemIndex += page1ItemCount;

  let remainingItems = items.slice(page1ItemCount);
  let pageNumber = 2;

  while (remainingItems.length > 0) {
    const continuationCapacity = calculateItemCapacity(
      continuationAvailableRows,
      3,
      true,
      true
    );

    const itemsOnThisPage = Math.min(remainingItems.length, continuationCapacity);
    const isLastPage = remainingItems.length <= continuationCapacity;

    const spacing = getSpacingRules(itemsOnThisPage);
    const calc = calculateItemSectionRows(itemsOnThisPage, 3, true, isLastPage);

    pages.push({
      pageNumber,
      type: 'continuation',
      sections: {
        header: 'header-continuation-minimal',
        tableHeader: 'item-table-header',
        items: remainingItems.slice(0, itemsOnThisPage).map((item, idx) => ({
          itemIndex: currentItemIndex + idx,
          item,
        })),
        totalBox: isLastPage,
        footer: isLastPage ? 'footer-full-payment' : 'footer-continuation-simple',
      },
      spacing: {
        preItem: spacing.preItemSpacing,
        betweenItems: spacing.betweenItemSpacing,
        beforeTotal: spacing.beforeTotalSpacing,
        afterTotal: 0,
      },
      spacingPx: {
        preItemPx: spacing.preItemSpacing * spacerRowHeight,
        betweenItemsPx: spacing.betweenItemSpacing * spacerRowHeight,
        beforeTotalPx: spacing.beforeTotalSpacing * spacerRowHeight,
        afterTotalPx: 0,
      },
      dynamicSpacing: false,
      rowsUsed: 10 + calc.totalRowsNeeded + (isLastPage ? 10 : 2),
      rowsAvailable: 56,
      remainingSpacePx: 0,
    });

    currentItemIndex += itemsOnThisPage;
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
    lines.push(`│ Remaining Space: ${page.remainingSpacePx}px`);
    lines.push(`│ Dynamic Spacing: ${page.dynamicSpacing ? 'YES' : 'NO'}`);
    lines.push(`│`);
    lines.push(`│ Sections:`);
    lines.push(`│   Header: ${page.sections.header}`);
    lines.push(`│   Table Header: ${page.sections.tableHeader}`);
    lines.push(`│   Items: ${page.sections.items.length}`);
    lines.push(`│   Total Box: ${page.sections.totalBox ? 'YES' : 'NO'}`);
    lines.push(`│   Footer: ${page.sections.footer}`);
    lines.push(`│`);
    lines.push(`│ Spacing (rows / pixels):`);
    lines.push(`│   Pre-item: ${page.spacing.preItem} rows / ${page.spacingPx.preItemPx}px`);
    lines.push(`│   Between items: ${page.spacing.betweenItems} rows / ${page.spacingPx.betweenItemsPx}px`);
    lines.push(`│   Before total: ${page.spacing.beforeTotal} rows / ${page.spacingPx.beforeTotalPx}px`);
    lines.push(`│   After total: ${page.spacing.afterTotal} rows / ${page.spacingPx.afterTotalPx}px`);
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
