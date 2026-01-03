/**
 * FooterSimple Component
 *
 * Simple footer for continuation pages and supplementary pages.
 * Used on all pages except the last page of Version B/B2 invoices.
 *
 * Row heights: [24, 57] = 81px total
 */

import React from 'react';
import { FlexCell, Cell } from '../../grid';
import type { SubsidiaryDoc } from '../../types';

export interface FooterSimpleProps {
  /** Subsidiary info for contact details */
  subsidiary?: SubsidiaryDoc;
  /** Current page number */
  pageNumber: number;
  /** Total number of pages (optional) */
  totalPages?: number;
  /** Show debug borders */
  debug?: boolean;
}

/**
 * Spacify text - add a space between each character, double space between words
 * Matches the "P a y m e n t   D e t a i l s" format
 */
function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text)
    .split('')
    .map((char, i, arr) => {
      // Add extra space before space characters to create double-space word separation
      if (char === ' ') return '  ';
      return char;
    })
    .join(' ');
}

/**
 * Format phone number with mixed font sizes
 * "+(852)" country code in 7px, rest of phone number in 11px
 * The country code is intentionally smaller than the phone number
 */
function formatPhone(phone: string | undefined | null): React.ReactNode {
  if (!phone) return null;

  // Spacify the phone number first
  const spacified = spacify(phone);

  // Match pattern: optional + followed by (852) or 852
  // Example: "+ ( 8 5 2 )   1 2 3 4   5 6 7 8"
  const match = spacified.match(/^(\+\s*)?(\(\s*8\s*5\s*2\s*\))(.*)/);

  if (match) {
    const plus = match[1] || ''; // "+" part - smaller
    const countryCode = match[2]; // "(852)" part - smaller (7px)
    const rest = match[3]; // rest of number (11px)

    return (
      <>
        {plus && <span style={{ fontSize: '7px' }}>{plus}</span>}
        <span style={{ fontSize: '7px' }}>{countryCode}</span>
        <span style={{ fontSize: '11px' }}>{rest}</span>
      </>
    );
  }

  // No country code detected, just return spacified
  return <span style={{ fontSize: '11px' }}>{spacified}</span>;
}

/**
 * FooterSimple - Minimal footer for continuation and supplementary pages
 *
 * Layout (2 rows) with merges:
 * - Row 1 (24px): SubsidiaryEnglishName in A-D (merged), rest empty
 * - Row 2 (57px): Address in A-D (merged), Phone/Email in J-N (merged)
 *
 * Merges:
 * - Row 1, A-D: Company name
 * - Row 2, A-D: Address
 * - Row 2, J-N: Phone/Email
 */
export const FooterSimple: React.FC<FooterSimpleProps> = ({
  subsidiary,
  pageNumber,
  totalPages,
  debug,
}) => {
  const cormorantStyle = { fontFamily: '"Cormorant Infant", serif' };
  const grayColor = 'rgb(67, 67, 67)';

  return (
    <>
      {/* === Row 1 (24px): Subsidiary Name in A-D === */}
      <FlexCell
        columns="A-D"
        height={24}
        vAlign="bottom"
        hAlign="left"
        debug={debug}
        style={{ borderTop: '1px solid rgb(239, 239, 239)', paddingLeft: '3px' }}
      >
        <span style={{
          ...cormorantStyle,
          fontSize: '16px', // 12pt converted to px
          fontWeight: 700,
        }}>
          {subsidiary?.englishName || ''}
        </span>
      </FlexCell>
      <Cell columns="E-N" height={24} debug={debug} style={{ borderTop: '1px solid rgb(239, 239, 239)' }} />

      {/* === Row 2 (57px): Address (A-D) + Contact Info (K-N) === */}
      <FlexCell columns="A-D" height={57} vAlign="top" hAlign="left" debug={debug} style={{ paddingLeft: '3px', overflow: 'visible' }}>
        <div style={{
          ...cormorantStyle,
          fontSize: '11px', // 8pt converted to px
          color: grayColor,
          lineHeight: 1.2,
        }}>
          {subsidiary?.addressLine1 && <div>{subsidiary.addressLine1}</div>}
          {subsidiary?.addressLine2 && <div>{subsidiary.addressLine2}</div>}
          {subsidiary?.addressLine3 && <div>{subsidiary.addressLine3}</div>}
          {subsidiary?.region && <div>{subsidiary.region}, Hong Kong</div>}
        </div>
      </FlexCell>
      <Cell columns="E-I" height={57} debug={debug} />
      <FlexCell columns="J-N" height={57} vAlign="top" hAlign="right" debug={debug} style={{ overflow: 'visible', paddingRight: '3px' }}>
        <div style={{
          ...cormorantStyle,
          color: grayColor,
          textAlign: 'right',
          lineHeight: 1.2,
        }}>
          {subsidiary?.phone && <div>{formatPhone(subsidiary.phone)}</div>}
          {subsidiary?.email && <div style={{ fontSize: '11px' }}>{spacify(subsidiary.email)}</div>}
        </div>
      </FlexCell>
    </>
  );
};

export default FooterSimple;
