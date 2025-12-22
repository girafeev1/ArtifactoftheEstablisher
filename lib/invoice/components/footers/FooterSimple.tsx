/**
 * FooterSimple Component
 *
 * Simple footer for continuation pages (not the last page).
 * Layout matches footer-continuation-simple.json exactly.
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
 * Spacify text - add a space between each character
 */
function spacify(text: string | undefined | null): string {
  if (!text) return '';
  return String(text).split('').join(' ');
}

/**
 * FooterSimple - Minimal footer for continuation pages
 *
 * Layout from JSON (2 rows) with merges:
 * - Row 1 (24px): SubsidiaryEnglishName in A-D (merged), rest empty
 * - Row 2 (57px): Address in A-D (merged), Phone/Email in K-N (merged)
 *
 * Merges from JSON:
 * - r1=1, c1=1, r2=1, c2=4 → Row 1, A-D
 * - r1=2, c1=1, r2=2, c2=4 → Row 2, A-D
 * - r1=2, c1=11, r2=2, c2=14 → Row 2, K-N
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
        style={{ borderTop: '1px solid rgb(239, 239, 239)' }}
      >
        <span style={{
          ...cormorantStyle,
          fontSize: '14px', // 12 + 2
          fontWeight: 700,
        }}>
          {subsidiary?.englishName || ''}
        </span>
      </FlexCell>
      <Cell columns="E-N" height={24} debug={debug} style={{ borderTop: '1px solid rgb(239, 239, 239)' }} />

      {/* === Row 2 (57px): Address (A-D) + Contact Info (K-N) === */}
      <FlexCell columns="A-D" height={57} vAlign="top" hAlign="left" debug={debug}>
        <div style={{
          ...cormorantStyle,
          fontSize: '10px', // 8 + 2
          color: grayColor,
          lineHeight: 1.4,
        }}>
          {subsidiary?.addressLine1 && <div>{subsidiary.addressLine1}</div>}
          {subsidiary?.addressLine2 && <div>{subsidiary.addressLine2}</div>}
          {subsidiary?.addressLine3 && <div>{subsidiary.addressLine3}</div>}
          {subsidiary?.region && <div>{subsidiary.region}, Hong Kong</div>}
        </div>
      </FlexCell>
      <Cell columns="E-J" height={57} debug={debug} />
      <FlexCell columns="K-N" height={57} vAlign="top" hAlign="right" debug={debug}>
        <div style={{
          ...cormorantStyle,
          fontSize: '12px', // 10 + 2
          color: grayColor,
          textAlign: 'right',
          lineHeight: 1.4,
        }}>
          {subsidiary?.phone && <div>{spacify(subsidiary.phone)}</div>}
          {subsidiary?.email && <div>{spacify(subsidiary.email)}</div>}
        </div>
      </FlexCell>
    </>
  );
};

export default FooterSimple;
