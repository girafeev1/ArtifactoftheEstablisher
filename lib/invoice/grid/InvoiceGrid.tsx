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
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [rowInfo, setRowInfo] = useState<Array<{ top: number; height: number }>>([]);

  // Detect row boundaries when showGrid is enabled
  // Using useLayoutEffect to ensure DOM is measured after layout
  useLayoutEffect(() => {
    if (!showGrid || !gridRef.current) {
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

      // Group cells by their top position to find row boundaries
      // Track both single-row cells and rowSpan cells separately
      const rowTops = new Map<number, number>(); // top -> height
      const rowSpanCells: Array<{ top: number; height: number; rowSpan: number }> = [];

      cells.forEach((cell) => {
        const rect = cell.getBoundingClientRect();
        const relTop = Math.round(rect.top - gridRect.top);
        const cellHeight = Math.round(rect.height);
        const rowSpanAttr = cell.getAttribute('data-row-span');
        const rowSpan = rowSpanAttr ? parseInt(rowSpanAttr, 10) : 1;

        if (rowSpan > 1) {
          // Track rowSpan cells to fill in gaps later
          rowSpanCells.push({ top: relTop, height: cellHeight, rowSpan });
        } else {
          // Single-row cell - use as row boundary
          const existingHeight = rowTops.get(relTop);
          if (!existingHeight || cellHeight > existingHeight) {
            rowTops.set(relTop, cellHeight);
          }
        }
      });

      // Now process rowSpan cells to fill in missing row boundaries
      // For each rowSpan cell, calculate the implied row positions
      rowSpanCells.forEach(({ top, height, rowSpan }) => {
        const avgRowHeight = Math.round(height / rowSpan);
        for (let i = 0; i < rowSpan; i++) {
          const rowTop = top + (i * avgRowHeight);
          // Only add if we don't already have a row at this position
          if (!rowTops.has(rowTop)) {
            // Check if there's a row very close (within 5px tolerance)
            const hasNearbyRow = Array.from(rowTops.keys()).some(
              existing => Math.abs(existing - rowTop) < 5
            );
            if (!hasNearbyRow) {
              rowTops.set(rowTop, avgRowHeight);
            }
          }
        }
      });

      // Sort by top position and create row info
      const sortedRows = Array.from(rowTops.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([top, height]) => ({ top, height }));

      setRowInfo(sortedRows);
    };

    detectRows();
    // Re-detect on resize
    const observer = new ResizeObserver(detectRows);
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [showGrid, children]);

  return (
    <div
      ref={gridRef}
      className={`invoice-grid ${className || ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: getGridTemplateColumns(),
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
                  borderTop: '1px dashed rgba(255, 0, 0, 0.3)',
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
