/**
 * SchemePageRenderer - Data-driven page rendering from generated scheme data
 *
 * Takes generated ROWS, MERGES data and renders the complete page with
 * proper merge handling and dynamic value overrides.
 *
 * ## Overflow Behavior (OVERFLOW_CELL wrapStrategy)
 *
 * For cells with wrapStrategy: 'OVERFLOW_CELL':
 * - overflow: 'visible' allows content to extend beyond cell bounds
 * - alignItems is set based on hAlign to prevent flexbox stretching:
 *   - right-aligned → alignItems: 'flex-end' → text overflows LEFT
 *   - left-aligned → alignItems: 'flex-start' → text overflows RIGHT
 *   - center-aligned → alignItems: 'center' → text overflows both sides
 * - The inner text div has no width constraint (width: undefined)
 *
 * Without these properties, flexbox stretches children to full width,
 * preventing proper overflow behavior even with overflow: visible.
 */

import React from 'react';
import { cellToStyle, cellToTextStyle, renderTextWithRuns } from './SchemeRenderer';
import { parseColumnRange } from './gridConstants';
import type { SchemeRowData, SchemeMerge, SchemeCellData } from './SchemeRenderer';

// All column letters A-N
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

// Map vAlign to CSS
function mapVAlign(vAlign?: string): string {
  if (vAlign === 'TOP') return 'flex-start';
  if (vAlign === 'BOTTOM') return 'flex-end';
  return 'center';
}

// Map hAlign to CSS
function mapHAlign(hAlign?: string): 'left' | 'center' | 'right' {
  if (hAlign === 'LEFT') return 'left';
  if (hAlign === 'RIGHT') return 'right';
  return 'center';
}

export interface ValueOverride {
  value: React.ReactNode;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}

export interface SchemePageRendererProps {
  rows: SchemeRowData[];
  merges: SchemeMerge[];
  /** Value overrides keyed by "sheetRow:col" e.g. "158:D" */
  valueOverrides?: Record<string, ValueOverride | React.ReactNode>;
  /** Show flex debug borders */
  debug?: boolean;
}

/**
 * Renders a complete page from scheme data
 *
 * Uses explicit CSS Grid row/column placement for proper merge handling.
 */
export const SchemePageRenderer: React.FC<SchemePageRendererProps> = ({
  rows,
  merges,
  valueOverrides = {},
  debug,
}) => {
  // Get the base sheet row number (first row)
  const baseSheetRow = rows.length > 0 ? rows[0].row : 0;

  // Convert sheet row to CSS grid row (1-indexed)
  const toGridRow = (sheetRow: number) => sheetRow - baseSheetRow + 1;

  // Build a map of cells by row:col for quick lookup
  const cellMap = new Map<string, SchemeCellData>();
  rows.forEach(row => {
    row.cells.forEach(cell => {
      cellMap.set(`${row.row}:${cell.col}`, cell);
    });
  });

  // Build a map of row heights by sheet row number
  const rowHeightMap = new Map<number, number>();
  rows.forEach(row => {
    rowHeightMap.set(row.row, row.height);
  });

  // Build a map of merges by startRow:startCol
  const mergeMap = new Map<string, SchemeMerge>();
  merges.forEach(m => {
    mergeMap.set(`${m.startRow}:${m.startCol}`, m);
  });

  // Track cells covered by merges (both row and column spans)
  const coveredCells = new Set<string>();
  merges.forEach(m => {
    for (let r = m.startRow; r <= m.endRow; r++) {
      const startIdx = COLUMNS.indexOf(m.startCol);
      const endIdx = COLUMNS.indexOf(m.endCol);
      for (let c = startIdx; c <= endIdx; c++) {
        // Don't mark the merge origin as covered
        if (r === m.startRow && COLUMNS[c] === m.startCol) continue;
        coveredCells.add(`${r}:${COLUMNS[c]}`);
      }
    }
  });

  // Calculate total height for a merge by summing row heights
  const getMergeHeight = (merge: SchemeMerge): number => {
    let totalHeight = 0;
    for (let r = merge.startRow; r <= merge.endRow; r++) {
      totalHeight += rowHeightMap.get(r) || 0;
    }
    return totalHeight;
  };

  // Get value override for a cell
  const getOverride = (sheetRow: number, col: string): ValueOverride | undefined => {
    const key = `${sheetRow}:${col}`;
    const override = valueOverrides[key];
    if (override === undefined) return undefined;
    if (typeof override === 'object' && override !== null && 'value' in override) {
      return override as ValueOverride;
    }
    return { value: override };
  };

  // Collect all cells to render
  const allCells: React.ReactNode[] = [];

  rows.forEach((row) => {
    const gridRow = toGridRow(row.row);

    // Process each column A-N
    for (let colIdx = 0; colIdx < COLUMNS.length; colIdx++) {
      const col = COLUMNS[colIdx];
      const cellKey = `${row.row}:${col}`;

      // Skip if covered by a merge
      if (coveredCells.has(cellKey)) continue;

      // Check if this cell starts a merge
      const merge = mergeMap.get(cellKey);
      const cellData = cellMap.get(cellKey);

      // Calculate column span using parseColumnRange
      const columns = merge ? `${merge.startCol}-${merge.endCol}` : col;
      const [startCol, endCol] = parseColumnRange(columns);
      const colSpan = endCol - startCol + 1;

      // Calculate height - for merges, sum all spanned row heights
      const height = merge ? getMergeHeight(merge) : row.height;
      const rowSpan = merge?.rowSpan || 1;

      // Get value override
      const override = getOverride(row.row, col);

      // Get cell styling
      const cellStyle = cellData ? cellToStyle(cellData) : {};
      const textStyle = cellData ? cellToTextStyle(cellData) : {
        // Default text style for cells without data (overflow by default)
        whiteSpace: 'pre' as const,
        lineHeight: 1.2,
      };

      // Determine overflow mode based on wrapStrategy
      // OVERFLOW_CELL should allow text to visually overflow the cell bounds
      const shouldOverflow = cellData?.wrapStrategy === 'OVERFLOW_CELL' || !cellData?.wrapStrategy;

      // Apply override styles
      if (override?.style) Object.assign(cellStyle, override.style);
      if (override?.textStyle) Object.assign(textStyle, override.textStyle);

      // Determine value to display
      let displayValue: React.ReactNode = null;
      if (override !== undefined) {
        displayValue = override.value;
      } else if (cellData?.value) {
        displayValue = cellData.value;
      }

      // Skip columns within the merge (after the start)
      if (merge) {
        const endIdx = COLUMNS.indexOf(merge.endCol);
        colIdx = endIdx; // Skip to end of merge
      }

      // Determine alignment
      const vAlign = cellData ? mapVAlign(cellData.vAlign) : 'center';
      const hAlign = cellData ? mapHAlign(cellData.hAlign) : 'center';

      // Add padding for aligned cells
      const verticalPadding = vAlign === 'flex-start' ? { paddingTop: '2px' }
        : vAlign === 'flex-end' ? { paddingBottom: '2px' }
        : {};
      const horizontalPadding = hAlign === 'left' ? { paddingLeft: '3px' }
        : hAlign === 'right' ? { paddingRight: '3px' }
        : {};

      allCells.push(
        <div
          key={`${row.row}-${col}`}
          className="invoice-cell invoice-cell-flex"
          data-row-span={rowSpan > 1 ? rowSpan : undefined}
          style={{
            // Explicit grid placement
            gridColumn: `${startCol} / span ${colSpan}`,
            gridRow: rowSpan > 1 ? `${gridRow} / span ${rowSpan}` : `${gridRow}`,
            height: `${height}px`,
            minHeight: 0,
            overflow: shouldOverflow ? 'visible' : 'hidden',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: vAlign,
            textAlign: hAlign,
            // For OVERFLOW_CELL, don't stretch children - align based on hAlign
            // This allows text to overflow in the correct direction
            alignItems: shouldOverflow
              ? (hAlign === 'right' ? 'flex-end' : hAlign === 'left' ? 'flex-start' : 'center')
              : undefined,
            ...verticalPadding,
            ...horizontalPadding,
            ...cellStyle,
            // Debug border
            ...(debug && {
              outline: '1px solid rgba(128, 0, 128, 0.5)',
              outlineOffset: '-1px',
            }),
          }}
        >
          {displayValue != null && (
            <div style={{
              // Apply width: 100% first so textStyle can override it for OVERFLOW_CELL
              width: shouldOverflow ? undefined : '100%',
              ...textStyle,
              // For OVERFLOW_CELL, give text z-index based on column position
              // Left columns get higher z-index so their overflow appears on top of right columns
              ...(shouldOverflow && {
                position: 'relative' as const,
                zIndex: COLUMNS.length - colIdx, // Column A gets z-index 14, N gets z-index 1
              }),
            }}>
              {/* Handle textRuns for mixed formatting, or simple line breaks */}
              {typeof displayValue === 'string'
                ? (cellData?.textRuns
                    ? renderTextWithRuns(displayValue, cellData.textRuns, textStyle)
                    : displayValue.split('\n').map((line, i, arr) => (
                        <React.Fragment key={i}>
                          {line}
                          {i < arr.length - 1 && <br />}
                        </React.Fragment>
                      ))
                  )
                : displayValue}
            </div>
          )}
        </div>
      );
    }
  });

  return <>{allCells}</>;
};

export default SchemePageRenderer;
