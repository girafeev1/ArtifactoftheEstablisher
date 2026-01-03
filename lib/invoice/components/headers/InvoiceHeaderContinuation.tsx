/**
 * InvoiceHeaderContinuation Component
 *
 * Minimal header for continuation pages (page 2+).
 * Layout matches Google Sheets gid=403093960, rows 52-57.
 *
 * Row heights: [21, 21, 21, 21, 21, 21] = 126px total
 *
 * Merges from spreadsheet:
 * - Row 52-54: A-D "Invoice" (3 rows = 63px)
 * - Row 52-55: L-N "E." logo (4 rows = 84px)
 * - Row 56: A-C "Invoice #:", E-G "Issued Date:"
 * - Row 56-57: J-N Subsidiary names (2 rows = 42px)
 * - Row 57: A-C invoice number, E-G date
 */

import React from 'react';
import { Cell, FlexCell } from '../../grid';
import type { ProjectInvoiceRecord, ProjectRecord, SubsidiaryDoc } from '../../types';

export interface InvoiceHeaderContinuationProps {
  invoice: ProjectInvoiceRecord;
  project?: ProjectRecord | null;
  subsidiary?: SubsidiaryDoc | null;
  pageNumber: number;
  debug?: boolean;
}

// Row heights for continuation header (rows 52-57)
const ROW_HEIGHTS = [21, 21, 21, 21, 21, 21];

/**
 * Spacify text - add a space between each character, double space between words
 */
function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .split('')
    .map((char) => {
      if (char === ' ') return '  ';
      return char;
    })
    .join(' ');
}

/**
 * Format invoice date
 */
function formatInvoiceDate(project?: ProjectRecord | null): string {
  const raw = project?.projectDateIso || project?.projectDateDisplay;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Helper to sum row heights
const sumHeights = (start: number, count: number) =>
  ROW_HEIGHTS.slice(start, start + count).reduce((a, b) => a + b, 0);

const googleSansMonoStyle = { fontFamily: '"Google Sans Mono", monospace' };
const cormorantStyle = { fontFamily: '"Cormorant Infant", serif' };

export const InvoiceHeaderContinuation: React.FC<InvoiceHeaderContinuationProps> = ({
  invoice,
  project,
  subsidiary,
  pageNumber,
  debug,
}) => {
  const invoiceDate = formatInvoiceDate(project);

  return (
    <>
      {/* === ROWS 1-4 (84px): Invoice A-D (3r), E-K empty (4r), L-N logo (4r) === */}
      {/* "Invoice" spans rows 1-3 (63px) */}
      <FlexCell
        columns="A-D"
        height={sumHeights(0, 3)}
        rowSpan={3}
        vAlign="bottom"
        hAlign="left"
        debug={debug}
        style={{ paddingLeft: '3px' }}
      >
        <span style={{
          ...cormorantStyle,
          fontSize: '47px', // 35pt converted to px
          fontWeight: 700,
        }}>
          {spacify('Invoice')}
        </span>
      </FlexCell>
      {/* E-K empty for rows 1-3 */}
      <Cell columns="E-K" height={sumHeights(0, 3)} rowSpan={3} debug={debug} />
      {/* "E." logo spans rows 1-4 (84px) */}
      <FlexCell
        columns="L-N"
        height={sumHeights(0, 4)}
        rowSpan={4}
        vAlign="middle"
        hAlign="right"
        debug={debug}
        style={{ paddingRight: '3px' }}
      >
        <span style={{
          fontFamily: '"Rampart One", cursive',
          fontSize: '80px', // 60pt converted to px
          lineHeight: 1,
        }}>
          E.
        </span>
      </FlexCell>

      {/* === ROW 4 (21px): A-K empty (logo L-N continues) === */}
      {/* Border on bottom of row 55 (dotted, light gray #ccc) - columns A-I */}
      <Cell columns="A-I" height={ROW_HEIGHTS[3]} debug={debug} style={{ borderBottom: '1px dotted rgb(204, 204, 204)' }} />
      <Cell columns="J-K" height={ROW_HEIGHTS[3]} debug={debug} />
      {/* L-N covered by logo rowSpan */}

      {/* === ROW 5 (21px): Labels + Subsidiary names start === */}
      <FlexCell
        columns="A-C"
        height={ROW_HEIGHTS[4]}
        vAlign="bottom"
        hAlign="left"
        debug={debug}
        style={{ paddingLeft: '3px' }}
      >
        <span style={{
          ...googleSansMonoStyle,
          fontSize: '11px', // 8pt converted to px
          fontStyle: 'italic',
        }}>
          Invoice #:
        </span>
      </FlexCell>
      <Cell columns="D" height={ROW_HEIGHTS[4]} debug={debug} />
      <FlexCell columns="E-G" height={ROW_HEIGHTS[4]} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{
          ...googleSansMonoStyle,
          fontSize: '11px', // 8pt converted to px
          fontStyle: 'italic',
        }}>
          Issued Date:
        </span>
      </FlexCell>
      <Cell columns="H-I" height={ROW_HEIGHTS[4]} debug={debug} />
      {/* Subsidiary names (J-N) spanning 2 rows (42px) */}
      <FlexCell
        columns="J-N"
        height={sumHeights(4, 2)}
        rowSpan={2}
        vAlign="top"
        hAlign="right"
        debug={debug}
        style={{ paddingRight: '3px' }}
      >
        <div style={{ textAlign: 'right' }}>
          <div style={{
            ...cormorantStyle,
            fontSize: '13px', // 10pt converted to px
            fontWeight: 700,
            whiteSpace: 'pre',
          }}>
            {spacify(subsidiary?.englishName)}
          </div>
          {subsidiary?.chineseName && (
            <div style={{
              fontFamily: '"Iansui", sans-serif',
              fontSize: '11px', // 8pt converted to px
              fontWeight: 700,
              letterSpacing: '0.25em',
            }}>
              {spacify(subsidiary.chineseName)}
            </div>
          )}
        </div>
      </FlexCell>

      {/* === ROW 6 (21px): Values === */}
      <FlexCell
        columns="A-C"
        height={ROW_HEIGHTS[5]}
        vAlign="top"
        hAlign="left"
        debug={debug}
        style={{ paddingLeft: '3px' }}
      >
        <span style={{
          ...googleSansMonoStyle,
          fontSize: '12px', // 9pt converted to px
          fontWeight: 700,
        }}>
          #{invoice.invoiceNumber || ''}
        </span>
      </FlexCell>
      <Cell columns="D" height={ROW_HEIGHTS[5]} debug={debug} />
      <FlexCell columns="E-G" height={ROW_HEIGHTS[5]} vAlign="top" hAlign="left" debug={debug}>
        <span style={{
          ...googleSansMonoStyle,
          fontSize: '12px', // 9pt converted to px
          fontWeight: 700,
        }}>
          {invoiceDate}
        </span>
      </FlexCell>
      <Cell columns="H-I" height={ROW_HEIGHTS[5]} debug={debug} />
      {/* J-N covered by subsidiary rowSpan */}
    </>
  );
};

export default InvoiceHeaderContinuation;
