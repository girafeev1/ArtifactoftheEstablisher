/**
 * Row Heights Calculator for Invoice Page
 *
 * Calculates explicit row heights for accurate grid debug overlay.
 * Exports row height constants from all invoice components.
 */

import type { InvoiceItem, InvoiceVariant } from '../types';

// === Header Row Heights ===

/** Full header (Version B) - 22 rows */
export const HEADER_FULL_ROW_HEIGHTS = [42, 18, 18, 18, 16, 16, 16, 32, 19, 19, 19, 19, 21, 21, 22, 21, 17, 42, 17, 21, 21, 21];

/** Full header (Version A) - 23 rows */
export const HEADER_FULL_VERSION_A_ROW_HEIGHTS = [21, 21, 21, 21, 21, 21, 21, 23, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 42, 21, 21, 21, 21];

/** Continuation header - 6 rows */
export const HEADER_CONTINUATION_ROW_HEIGHTS = [21, 21, 21, 21, 21, 21];

// === Item Table Header ===

/** Item table header - 1 row of 25px */
export const ITEM_TABLE_HEADER_ROW_HEIGHTS = [25];

// === Footer Row Heights ===

/** Simple footer (continuation pages) - 2 rows */
export const FOOTER_SIMPLE_ROW_HEIGHTS = [24, 57];

/** Full footer (last page, Version B) - 10 rows */
export const FOOTER_FULL_ROW_HEIGHTS = [16, 22, 16, 24, 16, 21, 16, 21, 20, 23];

// === Total Box ===

/** Total box - 3 rows */
export const TOTAL_BOX_ROW_HEIGHTS = [22, 34, 22];

// === Spacer ===

/** Single spacer row height */
export const SPACER_ROW_HEIGHT = 21;

// === Item Row Calculations ===

/**
 * Calculate row heights for a single item
 * Returns array of row heights: [titleRow, feeTypeRow, ...notesRows]
 */
export function calculateItemRowHeights(item: InvoiceItem): number[] {
  const rows: number[] = [];

  // Title row height (variable based on title length)
  // Title is 19pt (~25px)
  const titleLen = (item.title || '').length;
  let titleRowHeight = 35; // default
  if (titleLen > 45) {
    // Long titles wrap - calculate expanded height
    // At 19pt (~25px), approx 28 chars fit in A-H columns width
    const charsPerLine = 28;
    const lines = Math.ceil(titleLen / charsPerLine);
    const lineHeight = 25 * 1.3; // ~25px font with 1.3 line-height
    titleRowHeight = Math.max(35, Math.ceil(lines * lineHeight) + 4);
  }
  rows.push(titleRowHeight);

  // Fee type row - always 24px
  rows.push(24);

  // Notes row (if present)
  if (item.notes && item.notes.trim().length > 0) {
    const notesHeight = calculateNotesHeight(item.notes);
    if (notesHeight > 0) {
      rows.push(notesHeight);
    }
  }

  return rows;
}

/**
 * Calculate notes section height
 */
function calculateNotesHeight(notes: string): number {
  if (!notes || notes.trim().length === 0) return 0;

  const lines = notes.split('\n');
  let totalLines = 0;

  for (const line of lines) {
    if (line.length === 0) {
      totalLines += 1;
    } else {
      const charsPerLine = 70;
      const wrappedLines = Math.ceil(line.length / charsPerLine);
      totalLines += Math.max(1, wrappedLines);
    }
  }

  const lineHeight = 12 * 1.3;
  const singleColumnHeight = Math.max(21, Math.ceil(totalLines * lineHeight));

  // Check if 2-column layout would be used
  if (singleColumnHeight > 120) {
    let twoColLines = 0;
    for (const line of lines) {
      if (line.length === 0) {
        twoColLines += 1;
      } else {
        const charsPerLine = 40;
        const wrappedLines = Math.ceil(line.length / charsPerLine);
        twoColLines += Math.max(1, wrappedLines);
      }
    }
    return Math.max(21, Math.ceil((twoColLines * lineHeight) / 2) + 8);
  }

  return singleColumnHeight;
}

/**
 * Calculate complete row heights for the main content grid of InvoicePage
 */
export function calculateInvoiceContentRowHeights(
  isFirstPage: boolean,
  isLastPage: boolean,
  items: InvoiceItem[],
  spacing: {
    preItem: number;
    betweenItems: number;
    beforeTotal: number;
    afterTotal?: number;
  },
  variant: InvoiceVariant = 'B'
): number[] {
  const rows: number[] = [];

  // Header rows
  if (isFirstPage) {
    if (variant === 'A' || variant === 'A2') {
      rows.push(...HEADER_FULL_VERSION_A_ROW_HEIGHTS);
    } else {
      rows.push(...HEADER_FULL_ROW_HEIGHTS);
    }
  } else {
    rows.push(...HEADER_CONTINUATION_ROW_HEIGHTS);
  }

  // Item table header
  rows.push(...ITEM_TABLE_HEADER_ROW_HEIGHTS);

  // Pre-item spacing
  for (let i = 0; i < spacing.preItem; i++) {
    rows.push(SPACER_ROW_HEIGHT);
  }

  // Items with between-item spacing
  items.forEach((item, idx) => {
    // Between-item spacing (except before first item)
    if (idx > 0 && spacing.betweenItems > 0) {
      for (let i = 0; i < spacing.betweenItems; i++) {
        rows.push(SPACER_ROW_HEIGHT);
      }
    }
    // Item rows
    rows.push(...calculateItemRowHeights(item));
  });

  // Note: Total box and after-total spacing are now rendered in a separate grid
  // after the flex spacer, so they're not included here

  return rows;
}

/**
 * Get footer row heights based on page type and variant
 */
export function getFooterRowHeights(isLastPage: boolean, variant: InvoiceVariant = 'B'): number[] {
  if (isLastPage && (variant === 'B' || variant === 'B2')) {
    return FOOTER_FULL_ROW_HEIGHTS;
  }
  return FOOTER_SIMPLE_ROW_HEIGHTS;
}
