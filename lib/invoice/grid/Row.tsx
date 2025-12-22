/**
 * Row Component
 *
 * A logical row wrapper for grid cells.
 * Note: In CSS Grid, rows are implicit. This component helps organize cells logically
 * and can set a consistent height for all cells in the row.
 */

import React from 'react';
import type { RowProps } from '../types';

/**
 * Row - A logical grouping of cells in a row
 *
 * This is a semantic wrapper that doesn't affect grid layout directly,
 * but helps organize code and can apply consistent row styling.
 *
 * @example
 * <Row height={35}>
 *   <Cell columns="A-G">Left content</Cell>
 *   <Cell columns="H-N">Right content</Cell>
 * </Row>
 */
export const Row: React.FC<RowProps> = ({
  height,
  style,
  className,
  children,
}) => {
  // If height is specified, we need to wrap children and apply height
  // Since CSS Grid rows are implicit, we clone children to add height
  if (height) {
    return (
      <>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              style: {
                ...(child.props as any).style,
                height: `${height}px`,
                ...style,
              },
              className: `${(child.props as any).className || ''} ${className || ''}`.trim(),
            });
          }
          return child;
        })}
      </>
    );
  }

  // Without height, just render children as-is (Fragment for no extra DOM)
  return <>{children}</>;
};

/**
 * FullWidthRow - A row that spans all 14 columns
 *
 * Convenience component for content that spans the full width.
 */
export interface FullWidthRowProps {
  height?: number;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}

export const FullWidthRow: React.FC<FullWidthRowProps> = ({
  height,
  style,
  className,
  children,
}) => {
  return (
    <div
      className={`invoice-cell invoice-cell-full-width ${className || ''}`}
      style={{
        gridColumn: '1 / span 14',
        height: height ? `${height}px` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Row;
