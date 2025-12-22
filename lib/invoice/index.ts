/**
 * Invoice Module - Public exports
 *
 * This module provides React component-based invoice rendering.
 * Replaces the JSON-based DynamicInvoice approach.
 */

// Main components
export { Invoice } from './Invoice';
export type { InvoiceProps } from './Invoice';

export { InvoicePage } from './InvoicePage';
export type { InvoicePageProps } from './InvoicePage';

// Sub-components
export {
  InvoiceHeaderFull,
  InvoiceHeaderContinuation,
  ItemTableHeader,
  ItemRow,
  TotalBox,
  FooterFull,
  FooterSimple,
} from './components';

export type {
  InvoiceHeaderFullProps,
  InvoiceHeaderContinuationProps,
  ItemTableHeaderProps,
  ItemRowProps,
  TotalBoxProps,
  FooterFullProps,
  FooterSimpleProps,
} from './components';

// Grid primitives
export {
  InvoiceGrid,
  Cell,
  FlexCell,
  Row,
  FullWidthRow,
  Spacer,
  FlexSpacer,
  Divider,
  COLUMN_WIDTHS,
  TOTAL_WIDTH,
  COLUMN_NAMES,
  COLUMN_SPANS,
  A4_DIMENSIONS,
  ROW_HEIGHTS,
  parseColumnRange,
  getColumnRangeWidth,
  getGridTemplateColumns,
} from './grid';

export type {
  InvoiceGridProps,
  FlexCellProps,
  FullWidthRowProps,
  FlexSpacerProps,
  DividerProps,
} from './grid';

// Theme
export {
  invoiceTheme,
  sectionHeights,
  notesTypography,
  getThemeStyle,
  getSpacingRules,
} from './theme/invoiceTheme';

export type { InvoiceThemeKey } from './theme/invoiceTheme';

// Types
export type {
  InvoiceItem,
  BankInfo,
  InvoiceVariant,
  Representative,
  CellProps,
  RowProps,
  SpacerProps,
  ThemeStyle,
  SectionHeights,
  SpacingRules,
  ProjectInvoiceRecord,
  ProjectRecord,
  SubsidiaryDoc,
} from './types';
