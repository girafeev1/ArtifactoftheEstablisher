/**
 * Invoice Grid Constants
 *
 * Defines the 14-column grid system used for invoice layout.
 * These values match the original Google Sheets template.
 */

// Column widths in pixels (14 columns, A-N)
export const COLUMN_WIDTHS = [48, 25, 36, 120, 30, 90, 75, 75, 74, 40, 35, 20, 20, 128] as const;

// Total width of all columns
export const TOTAL_WIDTH = COLUMN_WIDTHS.reduce((sum, w) => sum + w, 0); // 816px

// Column names for reference
export const COLUMN_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'] as const;

// Common column span presets
export const COLUMN_SPANS = {
  // Header layout
  logo: 'A-I',              // Columns 1-9 (494px)
  subsidiaryInfo: 'J-N',    // Columns 10-14 (322px)

  // Item layout
  itemDescription: 'A-G',   // Columns 1-7 (424px) - title, fee type, notes
  itemQuantity: 'H-I',      // Columns 8-9 (149px)
  itemPrice: 'J-K',         // Columns 10-11 (75px)
  itemTotal: 'L-N',         // Columns 12-14 (168px)

  // Full width
  fullWidth: 'A-N',         // All columns (816px)

  // Footer layout
  footerLabel: 'A-G',       // Left side labels
  footerValue: 'H-N',       // Right side values
} as const;

// A4 page dimensions at 96dpi
export const A4_DIMENSIONS = {
  // Full A4 size
  width: 794,
  height: 1123,

  // Usable area (with 0.3" left/right, 0.2" top/bottom margins)
  usableWidth: 736,
  usableHeight: 1085,

  // Content height limit for pagination
  contentHeight: 1180,

  // Scale factor to fit content width to A4
  scaleForWidth: 736 / 816, // ~0.902
} as const;

// Standard row heights
export const ROW_HEIGHTS = {
  spacer: 21,
  tableHeader: 25,
  itemTitle: 35,
  itemFeeType: 24,
  itemNotesBase: 21,
} as const;

/**
 * Parse a column range string into start and end column numbers
 * @param range - Column range like 'A-G' or single column like 'A'
 * @returns [startCol, endCol] as 1-based column numbers
 */
export function parseColumnRange(range: string): [number, number] {
  const parts = range.toUpperCase().split('-');
  const startCol = COLUMN_NAMES.indexOf(parts[0] as typeof COLUMN_NAMES[number]) + 1;
  const endCol = parts[1]
    ? COLUMN_NAMES.indexOf(parts[1] as typeof COLUMN_NAMES[number]) + 1
    : startCol;

  if (startCol < 1 || endCol < 1) {
    throw new Error(`Invalid column range: ${range}`);
  }

  return [startCol, endCol];
}

/**
 * Calculate the pixel width for a column range
 * @param range - Column range like 'A-G'
 * @returns Width in pixels
 */
export function getColumnRangeWidth(range: string): number {
  const [start, end] = parseColumnRange(range);
  return COLUMN_WIDTHS.slice(start - 1, end).reduce((sum, w) => sum + w, 0);
}

/**
 * Generate CSS grid-template-columns value
 */
export function getGridTemplateColumns(): string {
  return COLUMN_WIDTHS.map(w => `${w}px`).join(' ');
}
