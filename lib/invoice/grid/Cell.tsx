/**
 * Cell Component
 *
 * A grid cell that spans one or more columns.
 * Used for positioning content within the InvoiceGrid.
 */

import React from 'react';
import { parseColumnRange } from './gridConstants';
import type { CellProps } from '../types';

/**
 * Cell - A single grid cell that can span multiple columns
 *
 * @example
 * <Cell columns="A-G">Content spanning columns A through G</Cell>
 * <Cell columns="H-N" style={theme.subsidiaryEnglish}>Right-aligned content</Cell>
 */
export const Cell: React.FC<CellProps> = ({
  columns,
  rowSpan = 1,
  height,
  style,
  className,
  children,
  debug = false,
}) => {
  const [startCol, endCol] = parseColumnRange(columns);
  const colSpan = endCol - startCol + 1;

  return (
    <div
      className={`invoice-cell ${className || ''}`}
      data-columns={columns}
      data-col-span={colSpan > 1 ? colSpan : undefined}
      data-row-span={rowSpan > 1 ? rowSpan : undefined}
      style={{
        gridColumn: `${startCol} / span ${colSpan}`,
        gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
        height: height ? `${height}px` : undefined,
        minHeight: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
        // Debug border
        ...(debug && {
          outline: '1px solid rgba(0, 0, 255, 0.3)',
          outlineOffset: '-1px',
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * FlexCell - A cell with flexbox layout for vertical alignment
 */
export interface FlexCellProps extends CellProps {
  /** Vertical alignment */
  vAlign?: 'top' | 'middle' | 'bottom';
  /** Horizontal alignment */
  hAlign?: 'left' | 'center' | 'right';
  /**
   * Allow content to overflow cell bounds (default: false)
   * When true:
   * - Sets overflow: visible
   * - Sets alignItems based on hAlign to prevent stretching
   * - Content overflows in the opposite direction of alignment
   *   (right-aligned text overflows left, left-aligned overflows right)
   */
  allowOverflow?: boolean;
}

export const FlexCell: React.FC<FlexCellProps> = ({
  columns,
  rowSpan = 1,
  height,
  vAlign = 'top',
  hAlign = 'left',
  allowOverflow = false,
  style,
  className,
  children,
  debug = false,
}) => {
  const [startCol, endCol] = parseColumnRange(columns);
  const colSpan = endCol - startCol + 1;

  const justifyContent = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  }[vAlign];

  const textAlign = hAlign;

  // For overflow cells, align items based on hAlign to prevent stretching
  // This allows content to overflow in the correct direction
  const alignItems = allowOverflow
    ? (hAlign === 'right' ? 'flex-end' : hAlign === 'left' ? 'flex-start' : 'center')
    : undefined;

  // Add padding for top/bottom aligned cells to give breathing room
  const verticalPadding = vAlign === 'top' ? { paddingTop: '2px' }
    : vAlign === 'bottom' ? { paddingBottom: '2px' }
    : {};

  return (
    <div
      className={`invoice-cell invoice-cell-flex ${className || ''}`}
      data-columns={columns}
      data-col-span={colSpan > 1 ? colSpan : undefined}
      data-row-span={rowSpan > 1 ? rowSpan : undefined}
      style={{
        gridColumn: `${startCol} / span ${colSpan}`,
        gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
        height: height ? `${height}px` : undefined,
        minHeight: 0,
        overflow: allowOverflow ? 'visible' : 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent,
        alignItems,
        textAlign,
        ...verticalPadding,
        // Debug border
        ...(debug && {
          outline: '1px solid rgba(0, 0, 255, 0.3)',
          outlineOffset: '-1px',
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Cell;
