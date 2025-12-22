/**
 * Invoice Types
 *
 * Shared TypeScript interfaces for the invoice system.
 */

import type { CSSProperties, ReactNode } from 'react';

// Re-export existing types for convenience
export type { ProjectInvoiceRecord } from '../projectInvoices';
export type { ProjectRecord } from '../projectsDatabase';
export type { SubsidiaryDoc } from '../subsidiaries';

/**
 * Invoice item data
 */
export interface InvoiceItem {
  title: string;
  feeType: string;
  unitPrice: number;
  quantity: number;
  quantityUnit?: string;
  subQuantity?: string;
  notes?: string;
  discount?: number;
}

/**
 * Bank account information
 */
export interface BankInfo {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
}

/**
 * Invoice variant types
 */
export type InvoiceVariant = 'B' | 'B2' | 'A' | 'A2' | 'bundle';

/**
 * Representative information
 */
export interface Representative {
  title?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Props for grid Cell component
 */
export interface CellProps {
  /** Column range like 'A-G' or single column like 'A' */
  columns: string;
  /** Number of rows to span (default: 1) */
  rowSpan?: number;
  /** Row height in pixels (for explicit height control) */
  height?: number;
  /** Additional CSS styles */
  style?: CSSProperties;
  /** CSS class name */
  className?: string;
  /** Cell content */
  children?: ReactNode;
  /** Show debug border */
  debug?: boolean;
}

/**
 * Props for grid Row component
 */
export interface RowProps {
  /** Row height in pixels */
  height?: number;
  /** Additional CSS styles */
  style?: CSSProperties;
  /** CSS class name */
  className?: string;
  /** Row content (should be Cell components) */
  children?: ReactNode;
}

/**
 * Props for Spacer component
 */
export interface SpacerProps {
  /** Number of spacer rows */
  rows: number;
  /** Height per row (default: 21px) */
  rowHeight?: number;
}

/**
 * Theme style definition
 */
export interface ThemeStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fontStyle?: string;
  color?: string;
  backgroundColor?: string;
  letterSpacing?: string;
  lineHeight?: number | string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  padding?: string | number;
  border?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
}

/**
 * Section heights for pagination calculations
 */
export interface SectionHeights {
  headerFull: number;
  headerContinuation: number;
  tableHeader: number;
  itemRowBase: number;
  itemNotesLineHeight: number;
  totalBox: number;
  footerFull: number;
  footerSimple: number;
  spacerRow: number;
}

/**
 * Spacing rules for items
 */
export interface SpacingRules {
  preItem: number;
  betweenItems: number;
  beforeTotal: number;
  afterTotal: number;
}
