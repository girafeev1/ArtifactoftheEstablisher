/**
 * Invoice Layout Composer
 *
 * Assembles extracted sections into a complete invoice layout
 * ready for rendering by GeneratedInvoice component.
 */

import type { PageLayout, PageLayoutItem } from './paginationEngine';
import { calculateItemHeight, type InvoiceItem } from './contentHeightCalculator';

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

export type PageType = 'invoice' | 'invoice-continuation' | 'payment-details' | 'payment-instructions';

export interface ComposedPage {
  pageNumber: number;
  pageType: PageType;
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

  // 4. Add items with spacing - DYNAMIC HEIGHTS based on notes content
  const itemTemplate = sections['item-row-template'];
  if (!itemTemplate) {
    throw new Error('Item template section not found: item-row-template');
  }

  // Template structure: Row 1 = title, Row 2 = fee type, Row 3 = notes
  const TITLE_ROW = 1;
  const FEE_TYPE_ROW = 2;
  const NOTES_ROW = 3;

  pageLayout.sections.items.forEach((layoutItem, idx) => {
    // Add between-item spacing (except before first item)
    if (idx > 0 && pageLayout.spacing.betweenItems > 0) {
      const spacer = createSpacerRows(pageLayout.spacing.betweenItems);
      composedRowHeights.push(...spacer.rowHeightsPx);
      currentRow += pageLayout.spacing.betweenItems;
    }

    // Calculate item height to determine if notes row is needed
    const itemData: InvoiceItem = {
      title: layoutItem.item.title,
      feeType: layoutItem.item.feeType,
      notes: layoutItem.item.notes,
      unitPrice: layoutItem.item.unitPrice,
      quantity: layoutItem.item.quantity,
      quantityUnit: layoutItem.item.quantityUnit,
      subQuantity: layoutItem.item.subQuantity,
    };
    const itemHeightCalc = calculateItemHeight(itemData);
    const hasNotes = itemHeightCalc.hasNotes;

    // Add item rows - substitute generic tokens with numbered versions
    // e.g., <ItemTitle> becomes <Item1Title> for item index 0
    const itemNumber = layoutItem.itemIndex + 1; // item.itemIndex is 0-based, tokens are 1-based

    // Determine which rows to include: 2 rows if no notes, 3 rows if notes
    const rowsToInclude = hasNotes ? [TITLE_ROW, FEE_TYPE_ROW, NOTES_ROW] : [TITLE_ROW, FEE_TYPE_ROW];
    const rowCount = rowsToInclude.length;

    // Track the absolute row offset for each template row
    let rowOffset = 0;

    rowsToInclude.forEach((templateRow) => {
      const absoluteRow = currentRow + rowOffset;

      // Copy cells for this row
      Object.entries(itemTemplate.cells).forEach(([key, cell]) => {
        const [r, c] = key.split(':').map(Number);
        if (r !== templateRow) return; // Only process cells for this row

        // Clone the cell and substitute item tokens
        const clonedCell: InvoiceCellData = { ...cell };
        if (typeof clonedCell.value === 'string') {
          // Replace generic item tokens with numbered versions
          clonedCell.value = clonedCell.value
            .replace(/<ItemTitle>/g, `<Item${itemNumber}Title>`)
            .replace(/<ItemFeeType>/g, `<Item${itemNumber}FeeType>`)
            .replace(/<ItemUnitPrice>/g, `<Item${itemNumber}UnitPrice>`)
            .replace(/<ItemQuantity>/g, `<Item${itemNumber}Quantity>`)
            .replace(/<ItemQuantityUnit>/g, `<Item${itemNumber}QuantityUnit>`)
            .replace(/<ItemSubQuantity>/g, `<Item${itemNumber}SubQuantity>`)
            .replace(/<ItemNotes>/g, `<Item${itemNumber}Notes>`)
            .replace(/<ItemLineTotal>/g, `<Item${itemNumber}LineTotal>`);
        }

        composedCells[`${absoluteRow}:${c}`] = clonedCell;
      });

      // Get row height - use calculated height for notes row
      let rowHeight: number;
      if (templateRow === NOTES_ROW && hasNotes) {
        // Use calculated notes height (in pixels)
        rowHeight = itemHeightCalc.notesRowHeight;
      } else {
        // Use template height for title/fee type rows
        rowHeight = itemTemplate.rowHeightsPx[templateRow - 1] || 21;
      }
      composedRowHeights.push(rowHeight);

      rowOffset++;
    });

    // Handle merges - adjust for skipped notes row if no notes
    itemTemplate.merges.forEach(merge => {
      // Skip merges that involve the notes row if there are no notes
      if (!hasNotes && (merge.r1 === NOTES_ROW || merge.r2 === NOTES_ROW)) {
        return;
      }

      // Calculate new row positions
      let newR1 = merge.r1;
      let newR2 = merge.r2;

      // If no notes and merge is for rows 1-2 only, adjust positions
      if (!hasNotes) {
        // No adjustment needed for rows 1-2 when no notes row
        newR1 = merge.r1;
        newR2 = merge.r2;
      }

      composedMerges.push({
        r1: currentRow + newR1 - 1,
        c1: merge.c1,
        r2: currentRow + newR2 - 1,
        c2: merge.c2,
      });
    });

    currentRow += rowCount;
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

  const pageType: PageType = pageLayout.type === 'single' ? 'invoice' :
                              pageLayout.type === 'first' ? 'invoice' : 'invoice-continuation';

  return {
    pageNumber: pageLayout.pageNumber,
    pageType,
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

/**
 * Compose a standalone page from a single section
 * Used for Payment Details and Payment Instructions pages
 */
export function composeStandalonePage(
  sectionId: string,
  pageNumber: number,
  pageType: PageType
): ComposedPage {
  const section = loadSection(sectionId);

  // Copy cells with their original coordinates (already 1-based from extraction)
  const cells: Record<string, InvoiceCellData> = { ...section.cells };

  // Copy merges as-is
  const merges: MergeRange[] = [...section.merges];

  return {
    pageNumber,
    pageType,
    totalRows: section.rowCount,
    columnWidthsPx: section.columnWidthsPx,
    rowHeightsPx: section.rowHeightsPx,
    cells,
    merges,
    sections: [{
      sectionId,
      startRow: 1,
      endRow: section.rowCount,
    }],
  };
}

/**
 * Invoice variant types matching the classic system
 */
export type InvoiceVariant = 'B' | 'B2' | 'A' | 'A2' | 'bundle';

/**
 * Compose a complete invoice package with all applicable pages
 * based on the selected variant
 */
export function composeInvoicePackage(
  pageLayouts: PageLayout[],
  itemCount: number,
  layoutMode: string,
  variant: InvoiceVariant = 'bundle'
): ComposedInvoice {
  // Load invoice sections
  const sections: Record<string, InvoiceSection> = {
    'header-versionB-full': loadSection('header-versionB-full'),
    'header-continuation-minimal': loadSection('header-continuation-minimal'),
    'item-table-header': loadSection('item-table-header'),
    'item-row-template': loadSection('item-row-template'),
    'total-box': loadSection('total-box'),
    'footer-continuation-simple': loadSection('footer-continuation-simple'),
    'footer-full-payment': loadSection('footer-full-payment'),
  };

  // Compose invoice pages
  const invoicePages = pageLayouts.map(layout => composePage(layout, sections));
  let nextPageNumber = invoicePages.length + 1;

  const allPages: ComposedPage[] = [...invoicePages];

  // Add additional pages based on variant
  // Variant B: Items only (no additional pages)
  // Variant B2: Items + Payment Instructions
  // Variant A: Items + Payment Details
  // Variant A2: Items + Payment Details + Payment Instructions
  // Bundle: All pages (Payment Details + Payment Instructions)

  const includePaymentDetails = variant === 'A' || variant === 'A2' || variant === 'bundle';
  const includePaymentInstructions = variant === 'B2' || variant === 'A2' || variant === 'bundle';

  if (includePaymentDetails) {
    allPages.push(composeStandalonePage(
      'page-payment-details',
      nextPageNumber++,
      'payment-details'
    ));
  }

  if (includePaymentInstructions) {
    allPages.push(composeStandalonePage(
      'page-payment-instructions',
      nextPageNumber++,
      'payment-instructions'
    ));
  }

  return {
    pages: allPages,
    totalPages: allPages.length,
    metadata: {
      composedAt: new Date().toISOString(),
      itemCount,
      layoutMode: `${layoutMode}-${variant}`,
    },
  };
}
