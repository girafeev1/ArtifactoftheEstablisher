/**
 * Invoice Layout Composer
 *
 * Assembles extracted sections into a complete invoice layout
 * ready for rendering by GeneratedInvoice component.
 */

import type { PageLayout } from './paginationEngine';

export interface InvoiceSection {
  id: string;
  name: string;
  version: string;
  type: string;
  rowCount: number;
  columnWidthsPx: number[];
  rowHeightsPx: number[];
  cells: Record<string, InvoiceCellData>;
  merges: MergeRange[];
  metadata?: any;
}

export interface InvoiceCellData {
  value: string | number | boolean | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  fgColor?: { red: number; green: number; blue: number } | null;
  bgColor?: { red: number; green: number; blue: number } | null;
  hAlign?: string | null;
  vAlign?: string | null;
  wrapStrategy?: string | null;
  border?: any;
}

export interface MergeRange {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface ComposedPage {
  pageNumber: number;
  totalRows: number;
  columnWidthsPx: number[];
  rowHeightsPx: number[];
  cells: Record<string, InvoiceCellData>;
  merges: MergeRange[];
  sections: Array<{
    sectionId: string;
    startRow: number;
    endRow: number;
  }>;
}

export interface ComposedInvoice {
  pages: ComposedPage[];
  totalPages: number;
  metadata: {
    composedAt: string;
    itemCount: number;
    layoutMode: string;
  };
}

/**
 * Load a section from the extracted JSON files
 */
export function loadSection(sectionId: string): InvoiceSection {
  const fs = require('fs');
  const path = require('path');

  const sectionPath = path.join(
    process.cwd(),
    'tmp',
    'invoice-sections',
    `${sectionId}.json`
  );

  if (!fs.existsSync(sectionPath)) {
    throw new Error(`Section not found: ${sectionId}`);
  }

  return JSON.parse(fs.readFileSync(sectionPath, 'utf8'));
}

/**
 * Create spacer rows (empty rows for aesthetic spacing)
 */
function createSpacerRows(count: number, defaultHeight: number = 21): {
  rowHeightsPx: number[];
  cells: Record<string, InvoiceCellData>;
} {
  const rowHeightsPx: number[] = [];
  const cells: Record<string, InvoiceCellData> = {};

  for (let i = 0; i < count; i++) {
    rowHeightsPx.push(defaultHeight);
    // Spacer rows have no cells (empty rows)
  }

  return { rowHeightsPx, cells };
}

/**
 * Compose a single page by assembling sections
 */
export function composePage(
  pageLayout: PageLayout,
  sections: Record<string, InvoiceSection>
): ComposedPage {
  const composedCells: Record<string, InvoiceCellData> = {};
  const composedMerges: MergeRange[] = [];
  const composedRowHeights: number[] = [];
  let currentRow = 1;

  const sectionPlacements: Array<{
    sectionId: string;
    startRow: number;
    endRow: number;
  }> = [];

  // 1. Add header section
  const header = sections[pageLayout.sections.header];
  if (!header) {
    throw new Error(`Header section not found: ${pageLayout.sections.header}`);
  }

  // Copy header cells
  Object.entries(header.cells).forEach(([key, cell]) => {
    const [r, c] = key.split(':').map(Number);
    const absoluteRow = currentRow + r - 1;
    composedCells[`${absoluteRow}:${c}`] = cell;
  });

  // Copy header merges
  header.merges.forEach(merge => {
    composedMerges.push({
      r1: currentRow + merge.r1 - 1,
      c1: merge.c1,
      r2: currentRow + merge.r2 - 1,
      c2: merge.c2,
    });
  });

  // Copy header row heights
  composedRowHeights.push(...header.rowHeightsPx);

  sectionPlacements.push({
    sectionId: pageLayout.sections.header,
    startRow: currentRow,
    endRow: currentRow + header.rowCount - 1,
  });

  currentRow += header.rowCount;

  // 2. Add table header
  const tableHeader = sections[pageLayout.sections.tableHeader];
  if (!tableHeader) {
    throw new Error(`Table header section not found: ${pageLayout.sections.tableHeader}`);
  }

  Object.entries(tableHeader.cells).forEach(([key, cell]) => {
    const [r, c] = key.split(':').map(Number);
    const absoluteRow = currentRow + r - 1;
    composedCells[`${absoluteRow}:${c}`] = cell;
  });

  tableHeader.merges.forEach(merge => {
    composedMerges.push({
      r1: currentRow + merge.r1 - 1,
      c1: merge.c1,
      r2: currentRow + merge.r2 - 1,
      c2: merge.c2,
    });
  });

  composedRowHeights.push(...tableHeader.rowHeightsPx);

  sectionPlacements.push({
    sectionId: pageLayout.sections.tableHeader,
    startRow: currentRow,
    endRow: currentRow + tableHeader.rowCount - 1,
  });

  currentRow += tableHeader.rowCount;

  // 3. Add pre-item spacing
  if (pageLayout.spacing.preItem > 0) {
    const spacer = createSpacerRows(pageLayout.spacing.preItem);
    composedRowHeights.push(...spacer.rowHeightsPx);
    currentRow += pageLayout.spacing.preItem;
  }

  // 4. Add items with spacing
  const itemTemplate = sections['item-row-template'];
  if (!itemTemplate) {
    throw new Error('Item template section not found: item-row-template');
  }

  pageLayout.sections.items.forEach((item, idx) => {
    // Add between-item spacing (except before first item)
    if (idx > 0 && pageLayout.spacing.betweenItems > 0) {
      const spacer = createSpacerRows(pageLayout.spacing.betweenItems);
      composedRowHeights.push(...spacer.rowHeightsPx);
      currentRow += pageLayout.spacing.betweenItems;
    }

    // Add item rows
    Object.entries(itemTemplate.cells).forEach(([key, cell]) => {
      const [r, c] = key.split(':').map(Number);
      const absoluteRow = currentRow + r - 1;
      composedCells[`${absoluteRow}:${c}`] = cell;
    });

    itemTemplate.merges.forEach(merge => {
      composedMerges.push({
        r1: currentRow + merge.r1 - 1,
        c1: merge.c1,
        r2: currentRow + merge.r2 - 1,
        c2: merge.c2,
      });
    });

    composedRowHeights.push(...itemTemplate.rowHeightsPx);
    currentRow += itemTemplate.rowCount;
  });

  // 5. Add before-total spacing
  if (pageLayout.spacing.beforeTotal > 0) {
    const spacer = createSpacerRows(pageLayout.spacing.beforeTotal);
    composedRowHeights.push(...spacer.rowHeightsPx);
    currentRow += pageLayout.spacing.beforeTotal;
  }

  // 6. Add total box (if on this page)
  if (pageLayout.sections.totalBox) {
    const totalBox = sections['total-box'];
    if (!totalBox) {
      throw new Error('Total box section not found: total-box');
    }

    Object.entries(totalBox.cells).forEach(([key, cell]) => {
      const [r, c] = key.split(':').map(Number);
      const absoluteRow = currentRow + r - 1;
      composedCells[`${absoluteRow}:${c}`] = cell;
    });

    totalBox.merges.forEach(merge => {
      composedMerges.push({
        r1: currentRow + merge.r1 - 1,
        c1: merge.c1,
        r2: currentRow + merge.r2 - 1,
        c2: merge.c2,
      });
    });

    composedRowHeights.push(...totalBox.rowHeightsPx);

    sectionPlacements.push({
      sectionId: 'total-box',
      startRow: currentRow,
      endRow: currentRow + totalBox.rowCount - 1,
    });

    currentRow += totalBox.rowCount;
  }

  // 7. Add spacing before footer (if total box present, add 4 rows; otherwise handled by beforeTotal)
  if (pageLayout.sections.totalBox) {
    const spacer = createSpacerRows(4);
    composedRowHeights.push(...spacer.rowHeightsPx);
    currentRow += 4;
  }

  // 8. Add footer
  const footer = sections[pageLayout.sections.footer];
  if (!footer) {
    throw new Error(`Footer section not found: ${pageLayout.sections.footer}`);
  }

  Object.entries(footer.cells).forEach(([key, cell]) => {
    const [r, c] = key.split(':').map(Number);
    const absoluteRow = currentRow + r - 1;
    composedCells[`${absoluteRow}:${c}`] = cell;
  });

  footer.merges.forEach(merge => {
    composedMerges.push({
      r1: currentRow + merge.r1 - 1,
      c1: merge.c1,
      r2: currentRow + merge.r2 - 1,
      c2: merge.c2,
    });
  });

  composedRowHeights.push(...footer.rowHeightsPx);

  sectionPlacements.push({
    sectionId: pageLayout.sections.footer,
    startRow: currentRow,
    endRow: currentRow + footer.rowCount - 1,
  });

  currentRow += footer.rowCount;

  return {
    pageNumber: pageLayout.pageNumber,
    totalRows: currentRow - 1,
    columnWidthsPx: header.columnWidthsPx,
    rowHeightsPx: composedRowHeights,
    cells: composedCells,
    merges: composedMerges,
    sections: sectionPlacements,
  };
}

/**
 * Compose the entire invoice from pagination result
 */
export function composeInvoice(
  pageLayouts: PageLayout[],
  itemCount: number,
  layoutMode: string
): ComposedInvoice {
  // Load all sections
  const sections: Record<string, InvoiceSection> = {
    'header-versionB-full': loadSection('header-versionB-full'),
    'header-continuation-minimal': loadSection('header-continuation-minimal'),
    'item-table-header': loadSection('item-table-header'),
    'item-row-template': loadSection('item-row-template'),
    'total-box': loadSection('total-box'),
    'footer-continuation-simple': loadSection('footer-continuation-simple'),
    'footer-full-payment': loadSection('footer-full-payment'),
  };

  // Compose each page
  const pages = pageLayouts.map(layout => composePage(layout, sections));

  return {
    pages,
    totalPages: pages.length,
    metadata: {
      composedAt: new Date().toISOString(),
      itemCount,
      layoutMode,
    },
  };
}
