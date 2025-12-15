/**
 * Content-Aware Height Calculator for Invoice Pagination
 *
 * Calculates actual pixel heights for all invoice content to enable
 * proper pagination based on real content dimensions rather than
 * simple item counting.
 */

export interface InvoiceItem {
  title: string;
  feeType?: string;
  subQuantity?: string;
  notes?: string;
  unitPrice?: number;
  quantity?: number;
  quantityUnit?: string;
  discount?: number;
}

export interface SectionHeights {
  headerFull: number;
  headerContinuation: number;
  tableHeader: number;
  totalBox: number;
  footerFull: number;
  footerSimple: number;
}

export interface ItemHeightResult {
  titleRowHeight: number;
  feeTypeRowHeight: number;
  notesRowHeight: number;
  totalHeight: number;
  notesLineCount: number;
  notesOverflow: number; // How many px beyond the base 21px
  hasNotes: boolean;     // Whether item has any notes content
  equivalentItems: number; // How many "standard 2-row items" this is equivalent to
  actualRowCount: number;  // Actual number of rows this item uses
}

export interface ContentHeightResult {
  items: ItemHeightResult[];
  totalItemsHeight: number;
  headerHeight: number;
  tableHeaderHeight: number;
  totalBoxHeight: number;
  footerHeight: number;
  spacingHeight: number;
  totalContentHeight: number;
  pageCapacity: number;
  estimatedPages: number;
  breakdown: {
    perItem: { index: number; height: number; notes: { lines: number; height: number } }[];
    fixedSections: { header: number; tableHeader: number; totalBox: number; footer: number };
    spacing: { preItem: number; betweenItems: number; beforeTotal: number; afterTotal: number };
  };
}

// Fixed section heights from extracted templates (in pixels)
// These values match the actual extracted JSON section files
export const SECTION_HEIGHTS: SectionHeights = {
  // Header Version B Full: 22 rows = 476px
  headerFull: 476,

  // Header Continuation Minimal: 10 rows = 210px
  headerContinuation: 210,

  // Table Header: 1 row = 25px
  tableHeader: 25,

  // Total Box: 3 rows = 22+34+22 = 78px
  totalBox: 78,

  // Footer Full Payment: 10 rows = 195px
  footerFull: 195,

  // Footer Continuation Simple: 2 rows = 81px
  footerSimple: 81,
};

// Item row base heights from template (in pixels)
export const ITEM_ROW_HEIGHTS = {
  titleRow: 35,    // Row 1: title + subQuantity
  feeTypeRow: 24,  // Row 2: fee type + quantity unit
  notesRow: 21,    // Row 3: notes (base height, can expand)
};

// Typography settings for height calculations
export const TYPOGRAPHY = {
  notesFontSize: 10,       // px
  notesLineHeight: 1.4,    // multiplier
  notesCharsPerLine: 75,   // approximate chars that fit in notes column width
  notesColumnWidth: 424,   // px (columns 1-7 merged = 48+25+36+120+30+90+75)
};

// Page dimensions
export const PAGE_DIMENSIONS = {
  // A4 at print scaling (scaled to ~1100px width)
  // The content area needs to accommodate:
  // - Header (476px) + Table Header (25px) + Items + Total (78px) + Footer (195px)
  // - For 5 items with full spacing: ~400px items + ~315px spacing
  // Total single-page with 5 items: ~1489px
  contentHeight: 1500,     // Usable height for content (excluding margins)
  contentWidth: 816,       // Content width before scaling

  // Spacing row height (from spacingCalculator)
  spacerRowHeight: 21,
};

/**
 * Calculate the actual height needed for a notes field
 */
export function calculateNotesHeight(notes: string | undefined): {
  lineCount: number;
  height: number;
  overflow: number;
  hasNotes: boolean;
} {
  if (!notes || notes.trim().length === 0) {
    // No notes = 0 rows, 0 height (item will be 2 rows only: title + feeType)
    return { lineCount: 0, height: 0, overflow: 0, hasNotes: false };
  }

  const text = notes.trim();

  // Count explicit line breaks
  const explicitLines = text.split('\n');

  // For each line, estimate if it wraps
  let totalLines = 0;
  for (const line of explicitLines) {
    if (line.length === 0) {
      totalLines += 1; // Empty line still takes space
    } else {
      // Estimate wrapped lines based on character count
      const wrappedLines = Math.ceil(line.length / TYPOGRAPHY.notesCharsPerLine);
      totalLines += Math.max(1, wrappedLines);
    }
  }

  // Calculate actual height
  const lineHeight = TYPOGRAPHY.notesFontSize * TYPOGRAPHY.notesLineHeight;
  const actualHeight = Math.ceil(totalLines * lineHeight);

  // Height is the greater of base height or actual content height
  const finalHeight = Math.max(ITEM_ROW_HEIGHTS.notesRow, actualHeight);
  const overflow = Math.max(0, actualHeight - ITEM_ROW_HEIGHTS.notesRow);

  return {
    lineCount: totalLines,
    height: finalHeight,
    overflow,
    hasNotes: true,
  };
}

/**
 * Calculate the equivalent item count for an item.
 * A "standard item" = 2 rows (title + fee type, no notes).
 * Items with notes count as multiple equivalent items.
 *
 * This keeps spacing rules coherent regardless of actual row count.
 */
export function getEquivalentItemCount(item: InvoiceItem): number {
  const titleRows = 1;  // Always 1 row
  const feeTypeRows = 1;  // Always 1 row
  const notesCalc = calculateNotesHeight(item.notes);

  // Calculate actual notes rows (each ~21px row height)
  const notesRows = notesCalc.hasNotes
    ? Math.max(1, Math.ceil(notesCalc.lineCount))
    : 0;

  const totalRows = titleRows + feeTypeRows + notesRows;

  // Standard item = 2 rows, so equivalent count = ceil(totalRows / 2)
  return Math.ceil(totalRows / 2);
}

/**
 * Calculate height for a single invoice item
 */
export function calculateItemHeight(item: InvoiceItem): ItemHeightResult {
  const notesCalc = calculateNotesHeight(item.notes);

  const titleRowHeight = ITEM_ROW_HEIGHTS.titleRow;
  const feeTypeRowHeight = ITEM_ROW_HEIGHTS.feeTypeRow;
  // Notes row height is 0 when there are no notes (item = 2 rows only)
  const notesRowHeight = notesCalc.hasNotes ? notesCalc.height : 0;

  // Calculate actual row count (for layout purposes)
  const actualRowCount = notesCalc.hasNotes
    ? 2 + Math.max(1, Math.ceil(notesCalc.lineCount))  // title + feeType + notes rows
    : 2;  // title + feeType only

  return {
    titleRowHeight,
    feeTypeRowHeight,
    notesRowHeight,
    totalHeight: titleRowHeight + feeTypeRowHeight + notesRowHeight,
    notesLineCount: notesCalc.lineCount,
    notesOverflow: notesCalc.overflow,
    hasNotes: notesCalc.hasNotes,
    equivalentItems: getEquivalentItemCount(item),
    actualRowCount,
  };
}

/**
 * Calculate total equivalent item count for an array of items.
 * This is used to determine which spacing rules to apply.
 *
 * Example: 3 items where item 2 has 28 lines of notes
 * - Item 1: 2 rows = 1 equivalent
 * - Item 2: 30 rows = 15 equivalent
 * - Item 3: 2 rows = 1 equivalent
 * - Total: 17 equivalent items -> use "5+ items" spacing rules
 */
export function getTotalEquivalentItems(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + getEquivalentItemCount(item), 0);
}

/**
 * Calculate spacing based on equivalent item count (from spacingCalculator rules)
 *
 * IMPORTANT: Uses EQUIVALENT item count, not actual item count.
 * This ensures spacing rules remain coherent when items have varying heights.
 */
export function calculateSpacing(equivalentItemCount: number): {
  preItem: number;
  betweenItems: number;
  beforeTotal: number;
  afterTotal: number;
  totalSpacingRows: number;
  totalSpacingHeight: number;
} {
  let preItem = 0;
  let betweenItems = 0;
  let beforeTotal = 0;
  const afterTotal = 4; // Fixed 4 rows between total and footer

  if (equivalentItemCount === 1) {
    preItem = 3;
    betweenItems = 0;
    beforeTotal = 4;
  } else if (equivalentItemCount === 2) {
    preItem = 3;
    betweenItems = 3;
    beforeTotal = 4;
  } else if (equivalentItemCount === 3) {
    preItem = 2;
    betweenItems = 2;
    beforeTotal = 3;
  } else if (equivalentItemCount === 4) {
    preItem = 1;
    betweenItems = 2;
    beforeTotal = 2;
  } else {
    // 5+ equivalent items (packed mode)
    preItem = 1;
    betweenItems = 2;
    beforeTotal = 2;
  }

  // Note: totalSpacingRows calculation uses actual item count for between-items
  // but the spacing VALUES are based on equivalent count
  const totalSpacingRows =
    preItem +
    beforeTotal +
    afterTotal;

  return {
    preItem,
    betweenItems,
    beforeTotal,
    afterTotal,
    totalSpacingRows,
    totalSpacingHeight: totalSpacingRows * PAGE_DIMENSIONS.spacerRowHeight,
  };
}

/**
 * Calculate spacing for a specific set of items, using equivalent item count
 */
export function calculateSpacingForItems(items: InvoiceItem[]): {
  preItem: number;
  betweenItems: number;
  beforeTotal: number;
  afterTotal: number;
  totalSpacingRows: number;
  totalSpacingHeight: number;
  equivalentItemCount: number;
  actualItemCount: number;
} {
  const equivalentCount = getTotalEquivalentItems(items);
  const spacing = calculateSpacing(equivalentCount);

  // Calculate total spacing rows including between-items spacing
  // (actual item count determines how many between-items gaps there are)
  const actualItemCount = items.length;
  const betweenGaps = actualItemCount > 1 ? actualItemCount - 1 : 0;
  const totalSpacingRows = spacing.preItem +
    (betweenGaps * spacing.betweenItems) +
    spacing.beforeTotal +
    spacing.afterTotal;

  return {
    ...spacing,
    totalSpacingRows,
    totalSpacingHeight: totalSpacingRows * PAGE_DIMENSIONS.spacerRowHeight,
    equivalentItemCount: equivalentCount,
    actualItemCount,
  };
}

/**
 * Calculate total content height for an invoice
 */
export function calculateContentHeight(
  items: InvoiceItem[],
  options: {
    isFirstPage?: boolean;
    includeHeader?: boolean;
    includeTotalBox?: boolean;
    includeFooter?: boolean;
  } = {}
): ContentHeightResult {
  const {
    isFirstPage = true,
    includeHeader = true,
    includeTotalBox = true,
    includeFooter = true,
  } = options;

  // Calculate item heights
  const itemHeights = items.map(item => calculateItemHeight(item));
  const totalItemsHeight = itemHeights.reduce((sum, ih) => sum + ih.totalHeight, 0);

  // Fixed section heights
  const headerHeight = includeHeader
    ? (isFirstPage ? SECTION_HEIGHTS.headerFull : SECTION_HEIGHTS.headerContinuation)
    : 0;
  const tableHeaderHeight = SECTION_HEIGHTS.tableHeader;
  const totalBoxHeight = includeTotalBox ? SECTION_HEIGHTS.totalBox : 0;
  const footerHeight = includeFooter
    ? (includeTotalBox ? SECTION_HEIGHTS.footerFull : SECTION_HEIGHTS.footerSimple)
    : 0;

  // Spacing - use equivalent item count for spacing rules
  const spacing = calculateSpacingForItems(items);
  const spacingHeight = spacing.totalSpacingHeight;

  // Total content height
  const totalContentHeight =
    headerHeight +
    tableHeaderHeight +
    spacingHeight +
    totalItemsHeight +
    totalBoxHeight +
    footerHeight;

  // Calculate page capacity and estimated pages
  const pageCapacity = PAGE_DIMENSIONS.contentHeight;
  const estimatedPages = Math.max(1, Math.ceil(totalContentHeight / pageCapacity));

  return {
    items: itemHeights,
    totalItemsHeight,
    headerHeight,
    tableHeaderHeight,
    totalBoxHeight,
    footerHeight,
    spacingHeight,
    totalContentHeight,
    pageCapacity,
    estimatedPages,
    breakdown: {
      perItem: itemHeights.map((ih, index) => ({
        index,
        height: ih.totalHeight,
        notes: { lines: ih.notesLineCount, height: ih.notesRowHeight },
      })),
      fixedSections: {
        header: headerHeight,
        tableHeader: tableHeaderHeight,
        totalBox: totalBoxHeight,
        footer: footerHeight,
      },
      spacing: {
        preItem: spacing.preItem * PAGE_DIMENSIONS.spacerRowHeight,
        betweenItems: spacing.betweenItems * PAGE_DIMENSIONS.spacerRowHeight,
        beforeTotal: spacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight,
        afterTotal: spacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight,
      },
    },
  };
}

/**
 * Determine pagination breakpoints based on content heights
 */
export interface PaginationBreakpoint {
  pageNumber: number;
  startItemIndex: number;
  endItemIndex: number;
  itemCount: number;
  contentHeight: number;
  remainingSpace: number;
  includesTotalBox: boolean;
  includesFooter: boolean;
}

export function calculatePaginationBreakpoints(
  items: InvoiceItem[]
): PaginationBreakpoint[] {
  if (items.length === 0) {
    return [{
      pageNumber: 1,
      startItemIndex: 0,
      endItemIndex: -1,
      itemCount: 0,
      contentHeight: SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader +
                     SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull,
      remainingSpace: PAGE_DIMENSIONS.contentHeight -
                      (SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader +
                       SECTION_HEIGHTS.totalBox + SECTION_HEIGHTS.footerFull),
      includesTotalBox: true,
      includesFooter: true,
    }];
  }

  const breakpoints: PaginationBreakpoint[] = [];
  const itemHeights = items.map(item => calculateItemHeight(item));

  // Calculate spacing based on TOTAL equivalent item count across ALL items
  // This ensures consistent spacing rules throughout the invoice
  const totalEquivalent = getTotalEquivalentItems(items);
  const globalSpacing = calculateSpacing(totalEquivalent);

  let currentPage = 1;
  let currentPageHeight = 0;
  let startItemIndex = 0;
  let currentItemIndex = 0;

  // First page starts with full header + table header
  currentPageHeight = SECTION_HEIGHTS.headerFull + SECTION_HEIGHTS.tableHeader;

  // Add pre-item spacing based on equivalent item count
  currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;

  while (currentItemIndex < items.length) {
    const itemHeight = itemHeights[currentItemIndex].totalHeight;
    const betweenSpacing = currentItemIndex > startItemIndex
      ? globalSpacing.betweenItems * PAGE_DIMENSIONS.spacerRowHeight
      : 0;

    // Check if this item fits on current page
    // Need to reserve space for total box and footer on last page
    const isLastItem = currentItemIndex === items.length - 1;
    const reservedSpace = isLastItem
      ? (globalSpacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight +
         SECTION_HEIGHTS.totalBox +
         globalSpacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight +
         SECTION_HEIGHTS.footerFull)
      : 0;

    const projectedHeight = currentPageHeight + betweenSpacing + itemHeight + reservedSpace;

    // Check if we need to create a breakpoint before this item
    if (projectedHeight > PAGE_DIMENSIONS.contentHeight && currentItemIndex > startItemIndex) {
      // This item doesn't fit, create a breakpoint for previous items
      // Add footer for non-final pages
      const pageHeightWithFooter = currentPageHeight + SECTION_HEIGHTS.footerSimple;

      breakpoints.push({
        pageNumber: currentPage,
        startItemIndex,
        endItemIndex: currentItemIndex - 1,
        itemCount: currentItemIndex - startItemIndex,
        contentHeight: pageHeightWithFooter,
        remainingSpace: PAGE_DIMENSIONS.contentHeight - pageHeightWithFooter,
        includesTotalBox: false,
        includesFooter: true, // All pages include footer
      });

      // Start new page with continuation header
      currentPage++;
      startItemIndex = currentItemIndex;
      currentPageHeight = SECTION_HEIGHTS.headerContinuation + SECTION_HEIGHTS.tableHeader;
      // Add pre-item spacing for continuation page
      currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;
      // Continue with same item
      continue;
    }

    // Check if a single oversized item needs its own handling
    if (currentItemIndex === startItemIndex && projectedHeight > PAGE_DIMENSIONS.contentHeight) {
      // This single item overflows. In PDF rendering, it will naturally
      // flow to subsequent pages. We create a breakpoint after this item.
      currentPageHeight += itemHeight;
      currentItemIndex++;

      // If there are more items, create a breakpoint here
      if (currentItemIndex < items.length) {
        const isThisLastItem = currentItemIndex === items.length;
        const footerForThisPage = isThisLastItem ? SECTION_HEIGHTS.footerFull : SECTION_HEIGHTS.footerSimple;

        breakpoints.push({
          pageNumber: currentPage,
          startItemIndex,
          endItemIndex: currentItemIndex - 1,
          itemCount: 1,
          contentHeight: currentPageHeight + footerForThisPage,
          remainingSpace: 0, // Overflowed
          includesTotalBox: false,
          includesFooter: true,
        });

        currentPage++;
        startItemIndex = currentItemIndex;
        currentPageHeight = SECTION_HEIGHTS.headerContinuation + SECTION_HEIGHTS.tableHeader;
        currentPageHeight += globalSpacing.preItem * PAGE_DIMENSIONS.spacerRowHeight;
      }
      continue;
    }

    // Add item to current page
    currentPageHeight += betweenSpacing + itemHeight;
    currentItemIndex++;
  }

  // Add final page with remaining items
  if (currentItemIndex > startItemIndex || breakpoints.length === 0) {
    // Add total box and footer
    currentPageHeight +=
      globalSpacing.beforeTotal * PAGE_DIMENSIONS.spacerRowHeight +
      SECTION_HEIGHTS.totalBox +
      globalSpacing.afterTotal * PAGE_DIMENSIONS.spacerRowHeight +
      SECTION_HEIGHTS.footerFull;

    breakpoints.push({
      pageNumber: currentPage,
      startItemIndex,
      endItemIndex: items.length - 1,
      itemCount: items.length - startItemIndex,
      contentHeight: currentPageHeight,
      remainingSpace: PAGE_DIMENSIONS.contentHeight - currentPageHeight,
      includesTotalBox: true,
      includesFooter: true,
    });
  }

  return breakpoints;
}

/**
 * Get a human-readable summary of pagination
 */
export function getPaginationSummary(items: InvoiceItem[]): {
  totalPages: number;
  breakdown: string;
  warnings: string[];
  details: {
    totalContentHeight: number;
    pageCapacity: number;
    overflowAmount: number;
  };
} {
  const contentHeight = calculateContentHeight(items);
  const breakpoints = calculatePaginationBreakpoints(items);
  const warnings: string[] = [];

  // Check for oversized notes
  contentHeight.items.forEach((item, index) => {
    if (item.notesOverflow > 100) {
      warnings.push(
        `Item ${index + 1} has notes that overflow by ${item.notesOverflow}px ` +
        `(${item.notesLineCount} lines)`
      );
    }
  });

  // Check for content overflow
  const overflowAmount = Math.max(0, contentHeight.totalContentHeight -
    (breakpoints.length * PAGE_DIMENSIONS.contentHeight));
  if (overflowAmount > 0) {
    warnings.push(`Content overflows by approximately ${overflowAmount}px`);
  }

  // Build breakdown string
  const breakdownParts = breakpoints.map(bp =>
    `Page ${bp.pageNumber}: Items ${bp.startItemIndex + 1}–${bp.endItemIndex + 1} ` +
    `(${bp.contentHeight}px${bp.includesTotalBox ? ', includes total' : ''})`
  );

  return {
    totalPages: breakpoints.length,
    breakdown: breakdownParts.join('\n'),
    warnings,
    details: {
      totalContentHeight: contentHeight.totalContentHeight,
      pageCapacity: PAGE_DIMENSIONS.contentHeight,
      overflowAmount,
    },
  };
}
