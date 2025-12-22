/**
 * Spacer Component
 *
 * Creates empty space in the grid for aesthetic spacing between sections.
 */

import React from 'react';
import { ROW_HEIGHTS } from './gridConstants';
import type { SpacerProps } from '../types';

/**
 * Spacer - Creates vertical space in the grid
 *
 * @example
 * <Spacer rows={2} /> // Creates 42px of space (2 × 21px)
 * <Spacer rows={1} rowHeight={35} /> // Creates 35px of space
 */
export const Spacer: React.FC<SpacerProps> = ({
  rows,
  rowHeight = ROW_HEIGHTS.spacer,
}) => {
  if (rows <= 0) return null;

  const totalHeight = rows * rowHeight;

  return (
    <div
      className="invoice-spacer"
      style={{
        gridColumn: '1 / span 14',
        height: `${totalHeight}px`,
        minHeight: `${totalHeight}px`,
      }}
    />
  );
};

/**
 * FlexSpacer - Expands to fill remaining space
 *
 * Used to push footer to the bottom of the page.
 * Calculates remaining space based on target height and current content.
 */
export interface FlexSpacerProps {
  /** Minimum height in pixels */
  minHeight?: number;
}

export const FlexSpacer: React.FC<FlexSpacerProps> = ({
  minHeight = 0,
}) => {
  return (
    <div
      className="invoice-flex-spacer"
      style={{
        gridColumn: '1 / span 14',
        flex: '1 1 auto',
        minHeight: minHeight > 0 ? `${minHeight}px` : undefined,
      }}
    />
  );
};

/**
 * Divider - A horizontal line spanning all columns
 */
export interface DividerProps {
  /** Line color */
  color?: string;
  /** Line thickness */
  thickness?: number;
  /** Margin above and below */
  margin?: number;
}

export const Divider: React.FC<DividerProps> = ({
  color = '#000',
  thickness = 1,
  margin = 8,
}) => {
  return (
    <div
      className="invoice-divider"
      style={{
        gridColumn: '1 / span 14',
        height: `${thickness + margin * 2}px`,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          height: `${thickness}px`,
          backgroundColor: color,
        }}
      />
    </div>
  );
};

export default Spacer;
