/**
 * InvoiceHeaderContinuation Component
 *
 * Minimal header for continuation pages (page 2+).
 * Layout matches header-continuation-minimal.json exactly.
 *
 * Row heights: [21, 21, 21, 21, 21, 21, 21, 21, 21, 21] = 210px total
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

/**
 * Spacify text - add a space between each character
 */
function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text).split('').join(' ');
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

const monoStyle = { fontFamily: '"Roboto Mono", monospace' };
const cormorantStyle = { fontFamily: '"Cormorant Infant", serif' };

/**
 * InvoiceHeaderContinuation - Minimal header for continuation pages
 *
 * Layout from JSON (10 rows of 21px each):
 * - Row 1: "I n v o i c e" (spacified) | "E." logo
 * - Rows 2-4: Empty left | Empty right
 * - Row 5: Empty left | SubsidiaryEnglishName + ChineseName (spacified)
 * - Row 6: "Invoice #:" label (C) | Empty right
 * - Row 7: Invoice number (B) | Empty right
 * - Row 8: "Issued Date:" label (C) | Empty right
 * - Row 9: Invoice date (A) | Empty right
 * - Row 10: Empty (spacer before table)
 */
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
      {/* === Row 1 (21px): "I n v o i c e" + Logo === */}
      <FlexCell columns="A-K" height={21} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{
          ...cormorantStyle,
          fontSize: '37px', // 35 + 2
          fontWeight: 700,
          letterSpacing: '0.15em',
        }}>
          Invoice
        </span>
      </FlexCell>
      <FlexCell columns="L-N" height={21} vAlign="middle" hAlign="right" debug={debug}>
        <span style={{
          fontFamily: '"Rampart One", cursive',
          fontSize: '62px', // 60 + 2
          lineHeight: 1,
        }}>
          E.
        </span>
      </FlexCell>

      {/* === Rows 2-4 (63px): Empty rows === */}
      <Cell columns="A-N" height={63} debug={debug} />

      {/* === Row 5 (21px): Subsidiary Names === */}
      <Cell columns="A-I" height={21} debug={debug} />
      <FlexCell columns="J-N" height={21} vAlign="top" hAlign="right" debug={debug}>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            ...cormorantStyle,
            fontSize: '12px', // 10 + 2
            fontWeight: 700,
          }}>
            {spacify(subsidiary?.englishName)}
          </span>
          {subsidiary?.chineseName && (
            <>
              {' '}
              <span style={{
                fontFamily: '"Iansui", sans-serif',
                fontSize: '10px', // 8 + 2
                fontWeight: 700,
                letterSpacing: '0.25em',
              }}>
                {spacify(subsidiary.chineseName)}
              </span>
            </>
          )}
        </div>
      </FlexCell>

      {/* === Row 6 (21px): "Invoice #:" label === */}
      <Cell columns="A-B" height={21} debug={debug} />
      <FlexCell columns="C-D" height={21} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '10px', // 8 + 2
          fontStyle: 'italic',
        }}>
          Invoice #:
        </span>
      </FlexCell>
      <Cell columns="E-N" height={21} debug={debug} />

      {/* === Row 7 (21px): Invoice number === */}
      <Cell columns="A" height={21} debug={debug} />
      <FlexCell columns="B-D" height={21} vAlign="top" hAlign="right" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '11px', // 9 + 2
          fontWeight: 700,
        }}>
          #{invoice.invoiceNumber || ''}
        </span>
      </FlexCell>
      <Cell columns="E-N" height={21} debug={debug} />

      {/* === Row 8 (21px): "Issued Date:" label === */}
      <Cell columns="A-B" height={21} debug={debug} />
      <FlexCell columns="C-D" height={21} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '10px', // 8 + 2
          fontStyle: 'italic',
        }}>
          Issued Date:
        </span>
      </FlexCell>
      <Cell columns="E-N" height={21} debug={debug} />

      {/* === Row 9 (21px): Invoice date === */}
      <FlexCell columns="A-D" height={21} vAlign="top" hAlign="right" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '11px', // 9 + 2
          fontWeight: 700,
        }}>
          {invoiceDate}
        </span>
      </FlexCell>
      <Cell columns="E-N" height={21} debug={debug} />

      {/* === Row 10 (21px): Spacer before table === */}
      <Cell columns="A-N" height={21} debug={debug} />
    </>
  );
};

export default InvoiceHeaderContinuation;
