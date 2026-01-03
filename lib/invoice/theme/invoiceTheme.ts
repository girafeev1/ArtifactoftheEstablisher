/**
 * Invoice Theme
 *
 * Centralized styling for all invoice components.
 * All font sizes, families, colors, and spacing are defined here.
 */

import type { ThemeStyle, SectionHeights, SpacingRules } from '../types';

/**
 * Invoice theme styles
 */
export const invoiceTheme = {
  // ===================
  // SUBSIDIARY INFO
  // ===================
  subsidiaryEnglish: {
    fontFamily: '"Cormorant Infant", serif',
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'right' as const,
    lineHeight: 1.0,
  },
  subsidiaryChinese: {
    fontFamily: '"Iansui", sans-serif',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.25em', // 2 spaces between characters
    textAlign: 'right' as const,
    lineHeight: 1.0,
  },
  subsidiaryAddress: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 8,
    lineHeight: 1.1,
    textAlign: 'right' as const,
  },

  // ===================
  // CLIENT INFO
  // ===================
  clientCompanyName: {
    fontFamily: '"Karla", sans-serif',
    fontSize: 11,
    fontWeight: 600,
  },
  clientAddress: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    lineHeight: 1.2,
  },
  clientRepresentative: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
  },

  // ===================
  // PROJECT INFO
  // ===================
  projectTitle: {
    fontFamily: '"Karla", sans-serif',
    fontSize: 10,
    fontWeight: 600,
  },
  projectTitleCJK: {
    fontFamily: '"Yuji Mai", serif',
    fontSize: 10,
    fontWeight: 600,
  },
  presenterWorkType: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    fontWeight: 700,
  },
  presenterWorkTypeCJK: {
    fontFamily: '"Iansui", sans-serif',
    fontSize: 9,
    fontWeight: 700,
  },
  projectNature: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
  },

  // ===================
  // INVOICE HEADER
  // ===================
  invoiceTitle: {
    fontFamily: '"Rampart One", cursive',
    fontSize: 24,
    fontWeight: 400,
  },
  invoiceNumber: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 10,
    fontWeight: 700,
  },
  invoiceDate: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
  },
  invoiceDateField: {
    fontFamily: '"Federo", sans-serif',
    fontSize: 12,
    fontWeight: 400,
  },

  // ===================
  // TABLE HEADER
  // ===================
  tableHeaderLabel: {
    fontFamily: '"EB Garamond", serif',
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'center' as const,
    borderBottom: '1px solid #000',
  },

  // ===================
  // ITEM ROWS
  // ===================
  itemTitle: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 10,
  },
  itemSubQuantity: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 7,
    fontWeight: 400,
  },
  itemFeeType: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    color: '#444',
  },
  itemQuantity: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    textAlign: 'right' as const,
  },
  itemQuantityUnit: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 8,
    color: '#666',
  },
  itemPrice: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    textAlign: 'right' as const,
  },
  itemTotal: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 10,
    fontWeight: 600,
    textAlign: 'right' as const,
  },
  itemNotes: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    lineHeight: 1.2,
    color: '#333',
  },
  itemNotesCJK: {
    fontFamily: '"Chocolate Classical Sans", sans-serif',
    fontSize: 9,
    lineHeight: 1.2,
  },

  // ===================
  // TOTAL BOX
  // ===================
  totalLabel: {
    fontFamily: '"EB Garamond", serif',
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'right' as const,
  },
  totalAmount: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right' as const,
  },
  totalEnglish: {
    fontFamily: '"Covered By Your Grace", cursive',
    fontSize: 11,
    textAlign: 'center' as const,
  },
  totalChinese: {
    fontFamily: '"Nanum Pen Script", cursive',
    fontSize: 12,
    textAlign: 'left' as const,
  },

  // ===================
  // FOOTER
  // ===================
  footerLabel: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 8,
    color: '#444',
  },
  footerValue: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
  },
  bankName: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
    fontWeight: 600,
  },
  bankCode: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 8,
  },
  bankAccount: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  fpsId: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 10,
    fontWeight: 600,
  },
  paymentTerms: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 8,
    color: '#666',
    fontStyle: 'italic' as const,
  },

  // ===================
  // CONTINUATION HEADER
  // ===================
  continuationTitle: {
    fontFamily: '"EB Garamond", serif',
    fontSize: 14,
    fontWeight: 700,
  },
  continuationInvoiceNumber: {
    fontFamily: '"Roboto Mono", monospace',
    fontSize: 9,
  },

  // ===================
  // LOGO
  // ===================
  logoText: {
    fontFamily: '"Rampart One", cursive',
    fontSize: 36,
    color: '#000',
  },
  logoSubtext: {
    fontFamily: '"Fascinate", cursive',
    fontSize: 10,
  },
} satisfies Record<string, ThemeStyle>;

/**
 * Section heights in pixels (for pagination calculations)
 */
export const sectionHeights: SectionHeights = {
  headerFull: 476,          // 22 rows
  headerContinuation: 210,  // 10 rows
  tableHeader: 25,          // 1 row
  itemRowBase: 59,          // title (35) + feeType (24)
  itemNotesLineHeight: 14,  // per line of notes
  totalBox: 78,             // 3 rows (22+34+22)
  footerFull: 195,          // 10 rows
  footerSimple: 81,         // 2 rows
  spacerRow: 21,            // standard spacer row
};

/**
 * Get spacing rules based on equivalent item count
 */
export function getSpacingRules(equivalentItemCount: number): SpacingRules {
  if (equivalentItemCount === 1) {
    return { preItem: 3, betweenItems: 0, beforeTotal: 3, afterTotal: 2 };
  } else if (equivalentItemCount === 2) {
    return { preItem: 2, betweenItems: 2, beforeTotal: 3, afterTotal: 2 };
  } else if (equivalentItemCount === 3) {
    return { preItem: 1, betweenItems: 2, beforeTotal: 2, afterTotal: 2 };
  } else if (equivalentItemCount === 4) {
    return { preItem: 1, betweenItems: 1, beforeTotal: 2, afterTotal: 1 };
  } else {
    // 5+ items (packed mode)
    return { preItem: 1, betweenItems: 1, beforeTotal: 1, afterTotal: 1 };
  }
}

/**
 * Typography settings for notes height calculation
 */
export const notesTypography = {
  fontSize: 9,
  lineHeight: 1.2,
  charsPerLine: 75,
  columnWidth: 424, // A-G column width
};

/**
 * Get theme style as CSS properties
 * Note: Font sizes are increased by 2px to match DynamicInvoice behavior
 */
export function getThemeStyle(styleName: keyof typeof invoiceTheme): React.CSSProperties {
  const style = invoiceTheme[styleName] as ThemeStyle;
  // DynamicInvoice adds +2 to all font sizes from the sheet
  const adjustedFontSize = style.fontSize ? style.fontSize + 2 : undefined;
  return {
    fontFamily: style.fontFamily,
    fontSize: adjustedFontSize ? `${adjustedFontSize}px` : undefined,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    backgroundColor: style.backgroundColor,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    padding: style.padding,
    border: style.border,
    borderTop: style.borderTop,
    borderBottom: style.borderBottom,
    borderLeft: style.borderLeft,
    borderRight: style.borderRight,
  };
}

export type InvoiceThemeKey = keyof typeof invoiceTheme;
