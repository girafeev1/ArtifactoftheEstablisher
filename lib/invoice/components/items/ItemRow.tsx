/**
 * ItemRow Component
 *
 * Renders a single invoice item with title, fee type, quantity, price, and notes.
 * Layout matches item-row-template.json exactly.
 *
 * Row heights: [35, 24, 21] (base) + variable for notes
 */

import React from 'react';
import { FlexCell, Cell } from '../../grid';
import type { InvoiceItem } from '../../types';

export interface ItemRowProps {
  item: InvoiceItem;
  index: number;
  /** Show debug borders */
  debug?: boolean;
}

// Threshold height for switching to 2-column layout (in pixels)
// If notes would exceed this height in single column, use 2 columns
const TWO_COLUMN_THRESHOLD = 120;

/**
 * Calculate the height needed for notes based on line count
 * Returns { height, useTwoColumns } to indicate if 2-column layout should be used
 */
function calculateNotesLayout(notes: string | undefined): { height: number; useTwoColumns: boolean } {
  if (!notes || notes.trim().length === 0) return { height: 0, useTwoColumns: false };

  const lines = notes.split('\n');
  let totalLines = 0;

  for (const line of lines) {
    if (line.length === 0) {
      totalLines += 1;
    } else {
      // Approximate chars per line for notes column width (A-G = ~480px, ~70 chars)
      const charsPerLine = 70;
      const wrappedLines = Math.ceil(line.length / charsPerLine);
      totalLines += Math.max(1, wrappedLines);
    }
  }

  // Notes use 12px font (10 + 2) with lineHeight 1.3
  const lineHeight = 12 * 1.3;
  const singleColumnHeight = Math.max(21, Math.ceil(totalLines * lineHeight));

  // If single column would be too tall, use 2 columns (halves the height approximately)
  if (singleColumnHeight > TWO_COLUMN_THRESHOLD) {
    // With 2 columns in A-H (~550px total), each column is ~275px (~40 chars)
    // Recalculate for 2-column layout
    let twoColLines = 0;
    for (const line of lines) {
      if (line.length === 0) {
        twoColLines += 1;
      } else {
        const charsPerLine = 40; // Narrower columns
        const wrappedLines = Math.ceil(line.length / charsPerLine);
        twoColLines += Math.max(1, wrappedLines);
      }
    }
    // Divide by 2 for two columns, add some padding
    const twoColumnHeight = Math.max(21, Math.ceil((twoColLines * lineHeight) / 2) + 8);
    return { height: twoColumnHeight, useTwoColumns: true };
  }

  return { height: singleColumnHeight, useTwoColumns: false };
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get font size and layout for item title
 * - Short/medium titles: 19pt, no wrap
 * - Long titles: 19pt with wrap, expanded row height
 */
function getTitleLayout(title: string): { fontSize: string; needsWrap: boolean; rowHeight: number } {
  const len = title.length;

  // Short/medium titles - 19pt, single line
  if (len <= 45) return { fontSize: '19pt', needsWrap: false, rowHeight: 35 };

  // Long titles - 19pt with wrapping, calculate height needed
  // At 19pt (~25px), approx 28 chars fit in A-H columns width
  const charsPerLine = 28;
  const lines = Math.ceil(len / charsPerLine);
  const lineHeight = 25 * 1.3; // ~25px font with 1.3 line-height
  const calculatedHeight = Math.ceil(lines * lineHeight) + 4; // +4 for padding
  const rowHeight = Math.max(35, calculatedHeight);

  return { fontSize: '19pt', needsWrap: true, rowHeight };
}

/**
 * ItemRow - Renders a single invoice item
 *
 * Layout from JSON with merges:
 * - Row 1 (35px): Title+SubQty (A-I), UnitPrice (J-K)
 * - Row 1-2 merged: xQuantity (L-M spans rows 1-2), LineTotal (N spans rows 1-2)
 * - Row 2 (24px): FeeType (A-I), QuantityUnit (J-K)
 * - Row 3 (21px+): Notes (A-I) - variable height
 *
 * Merges from JSON:
 * - r1=1, c1=10, r2=1, c2=11 → Row 1, Cols J-K (unitPrice)
 * - r1=1, c1=12, r2=2, c2=13 → Rows 1-2, Cols L-M (quantity rowSpan=2)
 * - r1=1, c1=14, r2=2, c2=14 → Rows 1-2, Col N (lineTotal rowSpan=2)
 */
export const ItemRow: React.FC<ItemRowProps> = ({ item, index, debug }) => {
  const lineTotal = (item.unitPrice || 0) * (item.quantity || 0) - (item.discount || 0);
  const hasNotes = item.notes && item.notes.trim().length > 0;
  const { height: notesHeight, useTwoColumns } = hasNotes
    ? calculateNotesLayout(item.notes)
    : { height: 0, useTwoColumns: false };

  const monoStyle = { fontFamily: '"Roboto Mono", monospace' };

  // Get title layout (font size, wrap, row height)
  const titleLayout = getTitleLayout(item.title || '');
  const titleRowHeight = titleLayout.rowHeight;

  // Combined height for row-spanning cells (row 1 + row 2)
  const combinedRowHeight = titleRowHeight + 24;

  return (
    <>
      {/* === Row 1 (variable height): Title + Price Info === */}
      {/* Title + SubQuantity in columns A-H (merge: r1=1, c1=1, r2=1, c2=8) */}
      <FlexCell columns="A-H" height={titleRowHeight} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: titleLayout.fontSize,
          fontWeight: 700,
          fontStyle: 'italic',
          whiteSpace: titleLayout.needsWrap ? 'normal' : 'nowrap',
          lineHeight: titleLayout.needsWrap ? 1.3 : undefined,
        }}>
          {item.title}
          {item.subQuantity && (
            <span style={{ fontSize: '12px', fontWeight: 400, marginLeft: '4px' }}>
              x{item.subQuantity}
            </span>
          )}
        </span>
      </FlexCell>
      {/* Column I is empty (between title and unit price) */}
      <Cell columns="I" height={titleRowHeight} debug={debug} />

      {/* Unit Price in columns J-K (row 1 only) */}
      <FlexCell columns="J-K" height={titleRowHeight} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px' }}>
          {formatCurrency(item.unitPrice || 0)}
        </span>
      </FlexCell>

      {/* Quantity in columns L-M - SPANS ROWS 1-2 (merged) */}
      <FlexCell
        columns="L-M"
        height={combinedRowHeight}
        rowSpan={2}
        vAlign="middle"
        hAlign="center"
        debug={debug}
      >
        <span style={{ ...monoStyle, fontSize: '10px' }}>
          x{item.quantity || 0}
        </span>
      </FlexCell>

      {/* Line Total in column N - SPANS ROWS 1-2 (merged) */}
      <FlexCell
        columns="N"
        height={combinedRowHeight}
        rowSpan={2}
        vAlign="middle"
        hAlign="center"
        debug={debug}
      >
        <span style={{ ...monoStyle, fontSize: '16pt' }}>
          {formatCurrency(lineTotal)}
        </span>
      </FlexCell>

      {/* === Row 2 (24px): Fee Type + Quantity Unit === */}
      {/* Note: L-M and N are covered by rowSpan from row 1 */}
      {/* Fee type in columns A-G (merge: r1=2, c1=1, r2=2, c2=7) */}
      <FlexCell columns="A-G" height={24} vAlign="top" hAlign="left" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '14px', // 12 + 2
          fontStyle: 'italic',
        }}>
          {item.feeType}
        </span>
      </FlexCell>
      {/* Columns H-I are empty */}
      <Cell columns="H-I" height={24} debug={debug} />
      {/* Quantity unit in columns J-K (merge: r1=2, c1=10, r2=2, c2=11) */}
      <FlexCell columns="J-K" height={24} vAlign="top" hAlign="right" debug={debug}>
        <span style={{ ...monoStyle, fontSize: '10px' }}>
          {item.quantityUnit ? `/${item.quantityUnit}` : ''}
        </span>
      </FlexCell>
      {/* L-N cells not rendered here - covered by rowSpan above */}

      {/* === Row 3+ (variable height): Notes === */}
      {/* Notes in columns A-G (or A-H for 2-column layout), remaining columns empty */}
      {hasNotes && (
        <>
          <FlexCell
            columns={useTwoColumns ? 'A-H' : 'A-G'}
            height={notesHeight}
            vAlign="top"
            hAlign="left"
            debug={debug}
          >
            <NotesContent notes={item.notes!} useTwoColumns={useTwoColumns} />
          </FlexCell>
          {useTwoColumns ? (
            <>
              <Cell columns="I-K" height={notesHeight} debug={debug} />
              <Cell columns="L-N" height={notesHeight} debug={debug} />
            </>
          ) : (
            <>
              <Cell columns="H-I" height={notesHeight} debug={debug} />
              <Cell columns="J-K" height={notesHeight} debug={debug} />
              <Cell columns="L-N" height={notesHeight} debug={debug} />
            </>
          )}
        </>
      )}
    </>
  );
};

/**
 * NotesContent - Renders notes with CJK/Latin font handling
 * CJK uses Chocolate Classical Sans, Latin uses Roboto Mono
 * Supports 2-column layout for long notes
 */
const NotesContent: React.FC<{ notes: string; useTwoColumns?: boolean }> = ({ notes, useTwoColumns = false }) => {
  const lines = notes.split('\n');

  const containerStyle: React.CSSProperties = {
    lineHeight: 1.3,
    ...(useTwoColumns && {
      columnCount: 2,
      columnGap: '16px',
      columnFill: 'balance',
    }),
  };

  return (
    <div style={containerStyle}>
      {lines.map((line, lineIdx) => {
        // Split line into CJK and Latin segments
        const segments = line.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/);

        return (
          <React.Fragment key={lineIdx}>
            {segments.filter(Boolean).map((seg, idx) => {
              const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
              const fontFamily = hasCJK
                ? '"Chocolate Classical Sans", sans-serif'
                : '"Roboto Mono", monospace';
              return (
                <span key={idx} style={{
                  fontFamily,
                  fontSize: '12px', // 10 + 2
                  fontWeight: 700, // Notes are bold in JSON
                }}>
                  {seg}
                </span>
              );
            })}
            {lineIdx < lines.length - 1 && <br />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default ItemRow;
