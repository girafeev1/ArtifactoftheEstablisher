/**
 * InvoiceGrid Component
 *
 * Container component that establishes the 14-column grid layout.
 * All invoice content should be placed within this grid.
 */

import React, { useRef, useLayoutEffect, useState } from 'react';
import { COLUMN_WIDTHS, COLUMN_NAMES, TOTAL_WIDTH, A4_DIMENSIONS, getGridTemplateColumns } from './gridConstants';

export interface InvoiceGridProps {
  /** Grid content (should be Cell, Row, or Spacer components) */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Show debug grid lines */
  showGrid?: boolean;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Explicit row heights in pixels (for scheme-based pages) */
  rowHeights?: number[];
}

/**
 * InvoiceGrid - The main grid container for invoice layout
 *
 * Creates a CSS Grid with 14 columns matching the invoice template.
 * Handles scaling to fit A4 page dimensions.
 */
export const InvoiceGrid: React.FC<InvoiceGridProps> = ({
  children,
  className,
  showGrid = false,
  style,
  rowHeights,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowInfo, setRowInfo] = useState<Array<{ top: number; height: number }>>([]);

  // Calculate row info for debug overlay
  // When explicit rowHeights are provided, use them directly
  // Otherwise, detect rows dynamically from cell positions
  useLayoutEffect(() => {
    if (!showGrid) {
      setRowInfo([]);
      return;
    }

    // If explicit rowHeights are provided, use them directly
    if (rowHeights && rowHeights.length > 0) {
      let currentTop = 0;
      const rows: Array<{ top: number; height: number }> = [];
      rowHeights.forEach((height) => {
        rows.push({ top: currentTop, height });
        currentTop += height;
      });
      setRowInfo(rows);
      return;
    }

    // Otherwise, detect rows dynamically
    if (!gridRef.current) {
      setRowInfo([]);
      return;
    }

    const detectRows = () => {
      const grid = gridRef.current;
      if (!grid) return;

      const cells = Array.from(grid.children).filter(
        (child) => child instanceof HTMLElement && !child.hasAttribute('data-grid-overlay')
      ) as HTMLElement[];

      const gridRect = grid.getBoundingClientRect();
      const gridHeight = Math.round(gridRect.height);

      // Collect all unique top positions with tolerance for rounding
      const topPositions = new Set<number>();

      cells.forEach((cell) => {
        const rect = cell.getBoundingClientRect();
        const relTop = Math.round(rect.top - gridRect.top);
        const cellHeight = Math.round(rect.height);
        const rowSpanAttr = cell.getAttribute('data-row-span');
        const rowSpan = rowSpanAttr ? parseInt(rowSpanAttr, 10) : 1;

        // For rowSpan cells, calculate intermediate row positions
        if (rowSpan > 1) {
          const rowHeight = Math.round(cellHeight / rowSpan);
          for (let i = 0; i < rowSpan; i++) {
            topPositions.add(relTop + i * rowHeight);
          }
        } else {
          topPositions.add(relTop);
        }
      });

      // Merge nearby positions (within 3px tolerance)
      const mergedTops: number[] = [];
      const sortedTops = Array.from(topPositions).sort((a, b) => a - b);

      sortedTops.forEach((top) => {
        const lastTop = mergedTops[mergedTops.length - 1];
        if (lastTop === undefined || top - lastTop > 3) {
          mergedTops.push(top);
        }
      });

      // Calculate row heights from consecutive tops
      const rows: Array<{ top: number; height: number }> = [];
      for (let i = 0; i < mergedTops.length; i++) {
        const top = mergedTops[i];
        const nextTop = mergedTops[i + 1];
        const height = nextTop !== undefined ? nextTop - top : gridHeight - top;
        rows.push({ top, height: Math.max(height, 1) });
      }

      setRowInfo(rows);
    };

    detectRows();
    // Re-detect on resize
    const observer = new ResizeObserver(detectRows);
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [showGrid, children, rowHeights]);

  // Note: rowHeights are only used for the debug overlay visualization
  // They should NOT be applied to gridTemplateRows as that would break the content flow
  // The actual content layout is controlled by individual cell heights

  return (
    <div
      ref={gridRef}
      className={`invoice-grid ${className || ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplateColumns(),
        // gridTemplateRows intentionally NOT set - cells control their own heights
        width: `${TOTAL_WIDTH}px`,
        position: 'relative',
        boxSizing: 'border-box',
        fontFamily: '"Roboto Mono", monospace',
        fontSize: '10px',
        lineHeight: 1.0,
        color: '#000',
        backgroundColor: '#fff',
        ...style,
      }}
    >
      {children}

      {/* Debug grid overlay */}
      {showGrid && (
        <>
          {/* Column labels at top */}
          <div
            data-grid-overlay="column-labels"
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              right: 0,
              height: '20px',
              pointerEvents: 'none',
              display: 'grid',
              gridTemplateColumns: getGridTemplateColumns(),
            }}
          >
            {COLUMN_NAMES.map((name, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'rgba(255, 0, 0, 0.7)',
                  fontFamily: '"Roboto Mono", monospace',
                }}
              >
                {name}
              </div>
            ))}
          </div>
          {/* Column grid lines */}
          <div
            data-grid-overlay="columns"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              display: 'grid',
              gridTemplateColumns: getGridTemplateColumns(),
            }}
          >
            {COLUMN_WIDTHS.map((width, idx) => (
              <div
                key={idx}
                style={{
                  borderLeft: '1px dashed rgba(255, 0, 0, 0.3)',
                  borderRight: idx === COLUMN_WIDTHS.length - 1 ? '1px dashed rgba(255, 0, 0, 0.3)' : 'none',
                  height: '100%',
                }}
              />
            ))}
          </div>
          {/* Row grid lines (horizontal) */}
          <div
            data-grid-overlay="row-lines"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {rowInfo.map((row, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  top: row.top,
                  left: 0,
                  right: 0,
                  height: '1px',
                  borderTop: '1px dashed rgba(255, 0, 0, 0.3)',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
          {/* Row labels on the left */}
          <div
            data-grid-overlay="rows"
            style={{
              position: 'absolute',
              top: 0,
              left: -28,
              width: '26px',
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {rowInfo.map((row, idx) => (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  top: row.top,
                  height: row.height,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'rgba(255, 0, 0, 0.7)',
                  fontFamily: '"Roboto Mono", monospace',
                  boxSizing: 'border-box',
                }}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default InvoiceGrid;
