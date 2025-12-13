/**
 * Invoice Template Schema Definitions
 *
 * This file defines the complete schema for a modular, dynamic invoice generation system.
 * Templates are composed of reusable sections with flexible layout rules.
 */

// ============================================================================
// SECTION DEFINITIONS
// ============================================================================

/**
 * Defines the flexibility behavior of a single row within a section
 */
export interface RowFlexibility {
  /** Row number (1-based, relative to section start) */
  index: number;

  /** Default height in pixels */
  height: number;

  /** How this row behaves during layout compression/expansion */
  flexibility: 'fixed' | 'spacer' | 'compressible' | 'expandable';

  /** Minimum height when compressed (for 'compressible' rows) */
  minHeight?: number;

  /** Maximum height when expanded (for 'expandable' rows) */
  maxHeight?: number;

  /** Semantic purpose (helps with debugging and AI understanding) */
  purpose?: 'logo' | 'title' | 'metadata' | 'divider' | 'whitespace' | 'content' | 'signature';

  /** Can this row be completely removed in compact mode? */
  removable?: boolean;
}

/**
 * Cell formatting and content metadata from Google Sheets
 */
export interface InvoiceCellData {
  value: string | number | boolean | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  fgColor?: { red: number; green: number; blue: number } | null;
  bgColor?: { red: number; green: number; blue: number } | null;
  hAlign?: 'LEFT' | 'CENTER' | 'RIGHT' | null;
  vAlign?: 'TOP' | 'MIDDLE' | 'BOTTOM' | null;
  wrapStrategy?: string | null;
  border?: any;
}

/**
 * Merged cell range definition
 */
export interface MergeRange {
  r1: number; // Start row (1-based)
  c1: number; // Start column (1-based)
  r2: number; // End row (1-based, inclusive)
  c2: number; // End column (1-based, inclusive)
}

/**
 * A reusable section of an invoice (header, footer, item row, etc.)
 */
export interface InvoiceSection {
  /** Unique identifier (e.g., "header-classic-v1") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Version for tracking iterations */
  version: string;

  /** Section type */
  type: 'header' | 'footer' | 'item-row' | 'totals' | 'spacer' | 'continuation-header';

  /** Number of rows this section occupies */
  rowCount: number;

  /** Column widths in pixels (typically 14 columns for classic invoice) */
  columnWidthsPx: number[];

  /** Row flexibility metadata */
  rows: RowFlexibility[];

  /** Cell data (keyed by "row:col" where row is section-relative) */
  cells: Record<string, InvoiceCellData>;

  /** Merged cell ranges (coordinates are section-relative) */
  merges: MergeRange[];

  /** Additional metadata */
  metadata?: {
    /** Can this section repeat multiple times? (e.g., item rows) */
    repeatable?: boolean;

    /** Maximum instances allowed per page */
    maxInstancesPerPage?: number;

    /** Force page break before this section */
    pageBreakBefore?: boolean;

    /** Force page break after this section */
    pageBreakAfter?: boolean;

    /** Description for AI/developer understanding */
    description?: string;
  };
}

// ============================================================================
// PAGINATION RULES
// ============================================================================

/**
 * Defines how content density affects layout
 */
export interface LayoutMode {
  /** Mode identifier */
  name: 'comfortable' | 'compact' | 'dense' | 'custom';

  /** Maximum items that fit per page in this mode */
  itemsPerPage: number;

  /** Should spacer rows be included? */
  useSpacers: boolean;

  /** Should compressible rows be compressed? */
  compressRows: boolean;

  /** Additional spacing multiplier (1.0 = normal, 1.5 = 50% more space) */
  spacingMultiplier?: number;
}

/**
 * Conditions that trigger switching between layout modes
 */
export interface LayoutTriggers {
  /** Switch to compact mode when item count exceeds this */
  compactWhenItemCount?: number;

  /** Switch to compact mode when any note exceeds this length */
  compactWhenNoteLengthExceeds?: number;

  /** Switch to dense mode when item count exceeds this */
  denseWhenItemCount?: number;

  /** Use comfortable mode when item count is below this */
  comfortableWhenItemCountBelow?: number;

  /** Custom trigger function name (for complex logic) */
  customTrigger?: string;
}

/**
 * Rules for balancing items across pages aesthetically
 */
export interface BalancingRules {
  /** Minimum items allowed on any page (prevents orphans) */
  minItemsPerPage: number;

  /** If last page would have fewer items than this, redistribute */
  minItemsOnLastPage: number;

  /** Prefer even distribution across pages? (e.g., 3+3 instead of 4+2) */
  preferEvenDistribution: boolean;

  /** Redistribution threshold: if overflow < this %, redistribute */
  redistributeThreshold: number; // 0.0 to 1.0

  /** Maximum difference between page item counts when balancing */
  maxItemCountDifference?: number;
}

/**
 * Complete pagination configuration for a template
 */
export interface PaginationRules {
  /** Available layout modes */
  modes: {
    comfortable: LayoutMode;
    compact: LayoutMode;
    dense?: LayoutMode;
  };

  /** Conditions that trigger mode switching */
  triggers: LayoutTriggers;

  /** Aesthetic balancing rules */
  balancing: BalancingRules;

  /** Special cases (optional) */
  specialCases?: {
    /** Use alternate layout for single-item invoices */
    singleItemLayout?: string; // Section ID

    /** Maximum pages before warning/error */
    maxPages?: number;
  };
}

// ============================================================================
// TEMPLATE COMPOSITION
// ============================================================================

/**
 * Defines how sections are assembled into a complete invoice template
 */
export interface InvoiceTemplate {
  /** Unique identifier (e.g., "classic-invoice") */
  id: string;

  /** Human-readable name */
  name: string;

  /** Version for tracking iterations */
  version: string;

  /** Description of this template's use case */
  description?: string;

  /** Section composition */
  sections: {
    /** Header for first page */
    header: string; // Section ID

    /** Header for continuation pages (optional, defaults to main header) */
    continuationHeader?: string; // Section ID

    /** Item row section (repeatable) */
    itemRow: string; // Section ID

    /** Footer section */
    footer: string; // Section ID

    /** Totals section (optional, may be part of footer) */
    totals?: string; // Section ID

    /** Additional sections (e.g., terms and conditions, signature block) */
    additional?: Record<string, string>;
  };

  /** Page layout configuration */
  layout: {
    /** Total rows per page */
    rowsPerPage: number;

    /** Row where item section starts (1-based) */
    itemSectionStartRow: number;

    /** Row where item section ends (1-based, inclusive) */
    itemSectionEndRow: number;

    /** Page size (for PDF generation) */
    pageSize?: 'A4' | 'Letter' | 'Legal';

    /** Orientation */
    orientation?: 'portrait' | 'landscape';
  };

  /** Pagination rules specific to this template */
  paginationRules: PaginationRules;
}

// ============================================================================
// RUNTIME LAYOUT CALCULATION
// ============================================================================

/**
 * Calculated layout for a single page
 */
export interface PageLayout {
  /** Page number (1-based) */
  pageNumber: number;

  /** Layout mode used for this page */
  mode: 'comfortable' | 'compact' | 'dense';

  /** Sections rendered on this page */
  sections: Array<{
    /** Section ID */
    sectionId: string;

    /** Starting row on this page (1-based) */
    startRow: number;

    /** Ending row on this page (1-based, inclusive) */
    endRow: number;

    /** Data context for this section instance */
    data?: any; // For item rows: { item: ProjectInvoiceItemRecord, index: number }

    /** Was this section compressed/expanded? */
    modified?: boolean;

    /** Actual row heights after compression/expansion */
    actualRowHeights?: number[];
  }>;

  /** Is this the last page? */
  isLastPage: boolean;
}

/**
 * Complete calculated layout for an invoice
 */
export interface InvoiceLayout {
  /** Template used */
  templateId: string;

  /** Invoice metadata */
  invoice: {
    invoiceNumber: string;
    itemCount: number;
  };

  /** Calculated pages */
  pages: PageLayout[];

  /** Layout mode selected */
  selectedMode: 'comfortable' | 'compact' | 'dense';

  /** Debugging info */
  debug?: {
    totalRows: number;
    itemsPerPage: number[];
    compressionApplied: boolean;
    balancingApplied: boolean;
  };
}

// ============================================================================
// COMMUNICATION SCHEMA (AI Agent Instructions)
// ============================================================================

/**
 * Structured instruction format for AI agents to create/modify templates
 */
export interface TemplateInstruction {
  action: 'create' | 'modify' | 'clone';
  target: string; // Template ID or Section ID

  changes?: {
    /** Section assignments */
    sections?: {
      header?: string;
      footer?: string;
      itemRow?: string;
      // ... other sections
    };

    /** Layout adjustments */
    layout?: {
      itemSectionStartRow?: number;
      itemSectionEndRow?: number;
    };

    /** Pagination rule changes */
    paginationRules?: Partial<PaginationRules>;
  };

  /** Natural language description (for AI processing) */
  description?: string;
}

/**
 * Structured instruction format for section creation/modification
 */
export interface SectionInstruction {
  action: 'create' | 'modify' | 'extract';
  target: string; // Section ID

  /** If extracting from existing scheme, specify range */
  extractFrom?: {
    schemeFile: string;
    startRow: number;
    endRow: number;
  };

  /** Row flexibility annotations */
  rowAnnotations?: Array<{
    rowIndex: number;
    flexibility: RowFlexibility['flexibility'];
    minHeight?: number;
    maxHeight?: number;
    purpose?: string;
    removable?: boolean;
  }>;

  /** Natural language description */
  description?: string;
}
