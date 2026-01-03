/**
 * SchemeRenderer - Data-driven cell rendering from Google Sheets scheme
 *
 * Converts scheme cell data (colors, borders, fonts, alignment) to React styles
 * and renders cells exactly as defined in the scheme JSON.
 */

import React from 'react';
import { FlexCell, Row } from './index';

// Types matching the scheme JSON structure
export interface SchemeBorder {
  style: 'SOLID' | 'DOTTED' | 'DOUBLE' | 'DASHED';
  width?: number;
  color: string;
}

export interface TextRunFormat {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  foregroundColor?: string;
}

export interface TextRun {
  startIndex: number;
  format: TextRunFormat;
}

export interface SchemeCellData {
  col: string;
  colNum: number;
  value?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  hAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  vAlign?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  wrapStrategy?: 'OVERFLOW_CELL' | 'WRAP' | 'CLIP';
  borders?: {
    top?: SchemeBorder;
    bottom?: SchemeBorder;
    left?: SchemeBorder;
    right?: SchemeBorder;
  };
  textRuns?: TextRun[];
}

export interface SchemeRowData {
  row: number;
  height: number;
  cells: SchemeCellData[];
}

export interface SchemeMerge {
  startRow: number;
  endRow: number;
  startCol: string;
  endCol: string;
  rowSpan: number;
  colSpan: number;
  content?: string;
}

// Convert border style to CSS
function borderToCss(border: SchemeBorder | undefined): string | undefined {
  if (!border) return undefined;
  const style = border.style === 'DOUBLE' ? 'double' :
                border.style === 'DOTTED' ? 'dotted' :
                border.style === 'DASHED' ? 'dashed' : 'solid';
  const width = border.style === 'DOUBLE' ? '3px' : '1px';
  return `${width} ${style} ${border.color}`;
}

// Convert vAlign to CSS
function vAlignToCss(vAlign?: string): 'flex-start' | 'center' | 'flex-end' {
  if (vAlign === 'TOP') return 'flex-start';
  if (vAlign === 'BOTTOM') return 'flex-end';
  return 'center';
}

// Convert hAlign to CSS
function hAlignToCss(hAlign?: string): 'flex-start' | 'center' | 'flex-end' {
  if (hAlign === 'LEFT') return 'flex-start';
  if (hAlign === 'RIGHT') return 'flex-end';
  return 'center';
}

// Map Google Sheets alignment to FlexCell props
function mapVAlign(vAlign?: string): 'top' | 'middle' | 'bottom' {
  if (vAlign === 'TOP') return 'top';
  if (vAlign === 'BOTTOM') return 'bottom';
  return 'middle';
}

function mapHAlign(hAlign?: string): 'left' | 'center' | 'right' {
  if (hAlign === 'LEFT') return 'left';
  if (hAlign === 'RIGHT') return 'right';
  return 'center';
}

// Build CSS style from cell data
export function cellToStyle(cell: SchemeCellData): React.CSSProperties {
  const style: React.CSSProperties = {};

  if (cell.backgroundColor) {
    style.backgroundColor = cell.backgroundColor;
  }

  if (cell.borders) {
    if (cell.borders.top) style.borderTop = borderToCss(cell.borders.top);
    if (cell.borders.bottom) style.borderBottom = borderToCss(cell.borders.bottom);
    if (cell.borders.left) style.borderLeft = borderToCss(cell.borders.left);
    if (cell.borders.right) style.borderRight = borderToCss(cell.borders.right);
  }

  return style;
}

// Build text style from cell data
export function cellToTextStyle(cell: SchemeCellData): React.CSSProperties {
  const style: React.CSSProperties = {};

  if (cell.fontFamily) {
    // Handle quoted font names
    const font = cell.fontFamily.replace(/^"(.*)"$/, '$1');
    style.fontFamily = `"${font}", sans-serif`;
  }
  // Google Sheets API returns font sizes in points (pt), not pixels
  if (cell.fontSize) style.fontSize = `${cell.fontSize}pt`;
  if (cell.bold) style.fontWeight = 700;
  if (cell.italic) style.fontStyle = 'italic';
  if (cell.textColor) style.color = cell.textColor;

  // Line height for proper text spacing
  style.lineHeight = 1.2;

  // Handle text wrapping based on wrapStrategy
  switch (cell.wrapStrategy) {
    case 'WRAP':
      // Wrap text within cell bounds
      style.whiteSpace = 'pre-wrap';
      style.wordBreak = 'break-word';
      break;
    case 'CLIP':
      // Don't wrap, clip overflow
      style.whiteSpace = 'nowrap';
      style.overflow = 'hidden';
      break;
    case 'OVERFLOW_CELL':
    default:
      // Don't wrap, allow overflow (use 'pre' to preserve newlines but not auto-wrap)
      style.whiteSpace = 'pre';
      break;
  }

  return style;
}

/**
 * Render text with textRuns for mixed formatting
 * textRuns specify different formatting for different portions of the text
 */
export function renderTextWithRuns(
  value: string,
  textRuns: TextRun[] | undefined,
  baseStyle: React.CSSProperties
): React.ReactNode {
  if (!textRuns || textRuns.length === 0) {
    // No textRuns, render as simple text with line breaks
    return value.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  }

  // Sort textRuns by startIndex
  const sortedRuns = [...textRuns].sort((a, b) => a.startIndex - b.startIndex);
  const segments: React.ReactNode[] = [];

  for (let i = 0; i < sortedRuns.length; i++) {
    const run = sortedRuns[i];
    const nextRun = sortedRuns[i + 1];
    const start = run.startIndex;
    const end = nextRun ? nextRun.startIndex : value.length;
    const text = value.slice(start, end);

    if (!text) continue;

    // Build style for this run
    const runStyle: React.CSSProperties = { ...baseStyle };

    if (run.format.fontFamily) {
      const font = run.format.fontFamily.replace(/^"(.*)"$/, '$1');
      runStyle.fontFamily = `"${font}", sans-serif`;
    }
    if (run.format.fontSize) runStyle.fontSize = `${run.format.fontSize}pt`;
    if (run.format.bold) runStyle.fontWeight = 700;
    if (run.format.italic) runStyle.fontStyle = 'italic';
    if (run.format.foregroundColor) runStyle.color = run.format.foregroundColor;

    // Handle line breaks within the segment
    const lines = text.split('\n');
    segments.push(
      <span key={i} style={runStyle}>
        {lines.map((line, j, arr) => (
          <React.Fragment key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  }

  return <>{segments}</>;
}

interface SchemeCellProps {
  cell: SchemeCellData;
  columns: string;
  height?: number;
  rowSpan?: number;
  debug?: boolean;
  /** Override value (for dynamic content) */
  value?: React.ReactNode;
}

/**
 * SchemeCell - Renders a cell exactly as defined in scheme data
 */
export const SchemeCell: React.FC<SchemeCellProps> = ({
  cell,
  columns,
  height,
  rowSpan,
  debug,
  value,
}) => {
  const cellStyle = cellToStyle(cell);
  const textStyle = cellToTextStyle(cell);
  const displayValue = value !== undefined ? value : cell.value;

  return (
    <FlexCell
      columns={columns}
      height={height}
      rowSpan={rowSpan}
      vAlign={mapVAlign(cell.vAlign)}
      hAlign={mapHAlign(cell.hAlign)}
      style={cellStyle}
      debug={debug}
    >
      {displayValue && (
        <span style={textStyle}>
          {typeof displayValue === 'string' ? displayValue.split('\n').map((line, i, arr) => (
            <React.Fragment key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </React.Fragment>
          )) : displayValue}
        </span>
      )}
    </FlexCell>
  );
};

interface SchemeRowProps {
  row: SchemeRowData;
  merges?: SchemeMerge[];
  debug?: boolean;
  /** Value overrides by column letter */
  values?: Record<string, React.ReactNode>;
  /** Custom cell renderer */
  renderCell?: (cell: SchemeCellData, defaultRender: React.ReactNode) => React.ReactNode;
}

/**
 * SchemeRow - Renders a complete row with all cells
 */
export const SchemeRow: React.FC<SchemeRowProps> = ({
  row,
  merges = [],
  debug,
  values = {},
  renderCell,
}) => {
  // Track which columns are covered by merges starting in previous rows
  const coveredCols = new Set<string>();

  return (
    <Row height={row.height}>
      {row.cells.map((cell, idx) => {
        // Check if this cell starts a merge
        const merge = merges.find(
          m => m.startRow === row.row && m.startCol === cell.col
        );

        // Skip if covered by a previous merge
        if (coveredCols.has(cell.col)) return null;

        const columns = merge
          ? `${merge.startCol}-${merge.endCol}`
          : cell.col;

        const height = merge ? row.height * merge.rowSpan : undefined;
        const rowSpan = merge?.rowSpan;

        const value = values[cell.col];

        const defaultRender = (
          <SchemeCell
            key={`${row.row}-${cell.col}`}
            cell={cell}
            columns={columns}
            height={height}
            rowSpan={rowSpan}
            debug={debug}
            value={value}
          />
        );

        return renderCell ? renderCell(cell, defaultRender) : defaultRender;
      })}
    </Row>
  );
};

// Pre-defined color constants from scheme
export const SchemeColors = {
  // Text colors
  darkGray: 'rgb(67, 67, 67)',
  lightGray: 'rgb(102, 102, 102)',
  green: 'rgb(106, 168, 79)',
  blue: 'rgb(60, 120, 216)',
  red: 'rgb(255, 0, 0)',

  // Background colors
  chequeBackground: 'rgb(251, 250, 241)',
  transferBackground: 'rgb(246, 255, 244)',
  white: 'rgb(255, 255, 255)',

  // Border colors
  chequeBorder: 'rgb(255, 229, 153)',
  transferBorder: 'rgb(183, 225, 205)',
  dottedBorder: 'rgb(204, 204, 204)',
  lightBorder: 'rgb(239, 239, 239)',
};

// Helper to create cell data for empty cells with background
export function emptyCell(
  col: string,
  colNum: number,
  options?: {
    backgroundColor?: string;
    borders?: SchemeCellData['borders'];
  }
): SchemeCellData {
  return {
    col,
    colNum,
    ...options,
  };
}

// Helper to create a range of empty cells
export function emptyCells(
  startCol: string,
  endCol: string,
  options?: {
    backgroundColor?: string;
    borders?: SchemeCellData['borders'];
  }
): SchemeCellData[] {
  const cols = 'ABCDEFGHIJKLMN';
  const start = cols.indexOf(startCol);
  const end = cols.indexOf(endCol);
  const cells: SchemeCellData[] = [];

  for (let i = start; i <= end; i++) {
    cells.push(emptyCell(cols[i], i + 1, options));
  }

  return cells;
}

export default {
  SchemeCell,
  SchemeRow,
  SchemeColors,
  cellToStyle,
  cellToTextStyle,
  emptyCell,
  emptyCells,
};
