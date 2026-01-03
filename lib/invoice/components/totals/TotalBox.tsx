/**
 * TotalBox Component
 *
 * Displays the invoice total with amount in numbers, English words, and Chinese characters.
 * Layout matches total-box.json exactly.
 *
 * Row heights: [22, 34, 22] = 78px total
 *
 * Text overflow handling:
 * - English/Chinese text spans H-N (extended from J-N)
 * - If text is too long (>45 chars English, >18 chars Chinese), font reduces to half
 *   and text wraps to fit within the same row height
 */

import React from 'react';
import { FlexCell, Cell } from '../../grid';

export interface TotalBoxProps {
  /** Total amount in numbers */
  total: number;
  /** Total amount in English words */
  totalEnglish?: string;
  /** Total amount in Chinese characters */
  totalChinese?: string;
  /** Show debug borders */
  debug?: boolean;
}

// Progressive font size reduction based on text length
// Returns { fontSize, needsWrap } based on character count
function getEnglishFontStyle(length: number): { fontSize: string; needsWrap: boolean } {
  if (length <= 50) return { fontSize: '14px', needsWrap: false };
  if (length <= 65) return { fontSize: '12px', needsWrap: false };
  if (length <= 80) return { fontSize: '10px', needsWrap: false };
  if (length <= 100) return { fontSize: '9px', needsWrap: false };
  return { fontSize: '7px', needsWrap: true }; // Allow wrap only at smallest size
}

function getChineseFontStyle(length: number): { fontSize: string; needsWrap: boolean } {
  if (length <= 20) return { fontSize: '14px', needsWrap: false };
  if (length <= 26) return { fontSize: '12px', needsWrap: false };
  if (length <= 32) return { fontSize: '10px', needsWrap: false };
  if (length <= 40) return { fontSize: '9px', needsWrap: false };
  return { fontSize: '7px', needsWrap: true }; // Allow wrap only at smallest size
}

/**
 * TotalBox - Invoice total section
 *
 * Layout from JSON:
 * - Row 1 (22px): Chinese total (H-N) with top/right borders
 * - Row 2 (34px): "INVOICE TOTAL" (G), "(HK)" (K), Total amount (L-N) with left/right borders
 * - Row 3 (22px): English total (H-N) with bottom/right borders
 */
export const TotalBox: React.FC<TotalBoxProps> = ({
  total,
  totalEnglish,
  totalChinese,
  debug,
}) => {
  const formattedTotal = `$${total.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const monoStyle = { fontFamily: '"Roboto Mono", monospace' };

  // Get progressive font sizing based on text length
  const englishStyle = getEnglishFontStyle(totalEnglish?.length || 0);
  const chineseStyle = getChineseFontStyle(totalChinese?.length || 0);

  return (
    <>
      {/* === Row 1 (22px): Chinese Total === */}
      <Cell columns="A-F" height={22} debug={debug} />
      <Cell
        columns="G"
        height={22}
        debug={debug}
        style={{ borderTop: '2px solid #000', borderLeft: '2px solid #000' }}
      />
      <FlexCell
        columns="H-N"
        height={22}
        vAlign={chineseStyle.needsWrap ? 'middle' : 'bottom'}
        hAlign="right"
        debug={debug}
        style={{
          borderTop: '2px solid #000',
          borderRight: '2px solid #000',
          overflow: 'hidden',
        }}
      >
        {totalChinese && (
          <span style={{
            fontFamily: '"Iansui", sans-serif',
            fontSize: chineseStyle.fontSize,
            fontWeight: 700,
            whiteSpace: chineseStyle.needsWrap ? 'normal' : 'nowrap',
            lineHeight: chineseStyle.needsWrap ? 1.4 : 1.2,
            textAlign: 'right',
            display: chineseStyle.needsWrap ? 'block' : 'inline',
            maxHeight: '20px',
            overflow: 'hidden',
          }}>
            {totalChinese}
          </span>
        )}
      </FlexCell>

      {/* === Row 2 (34px): Label + Amount === */}
      {/* Merges: G-I for "INVOICE TOTAL", L-N for total amount */}
      <Cell columns="A-F" height={34} debug={debug} />
      <FlexCell
        columns="G-I"
        height={34}
        vAlign="middle"
        hAlign="center"
        debug={debug}
        style={{ borderLeft: '2px solid #000' }}
      >
        <span style={{
          ...monoStyle,
          fontSize: '22px', // 20 + 2
          fontWeight: 700,
        }}>
          INVOICE TOTAL
        </span>
      </FlexCell>
      <Cell columns="J" height={34} debug={debug} />
      <FlexCell columns="K" height={34} vAlign="middle" hAlign="right" debug={debug}>
        <span style={{
          ...monoStyle,
          fontSize: '14px', // 12 + 2
          fontWeight: 700,
        }}>
          (HK)
        </span>
      </FlexCell>
      <FlexCell
        columns="L-N"
        height={34}
        vAlign="middle"
        hAlign="right"
        debug={debug}
        style={{ borderRight: '2px solid #000' }}
      >
        <span style={{
          ...monoStyle,
          fontSize: '19px', // 17 + 2
          fontWeight: 700,
        }}>
          {formattedTotal}
        </span>
      </FlexCell>

      {/* === Row 3 (22px): English Total === */}
      <Cell columns="A-F" height={22} debug={debug} />
      <Cell
        columns="G"
        height={22}
        debug={debug}
        style={{ borderBottom: '2px solid #000', borderLeft: '2px solid #000' }}
      />
      <FlexCell
        columns="H-N"
        height={22}
        vAlign="middle"
        hAlign="right"
        debug={debug}
        style={{
          borderBottom: '2px solid #000',
          borderRight: '2px solid #000',
          overflow: 'hidden',
        }}
      >
        {totalEnglish && (
          <span style={{
            fontFamily: '"Federo", sans-serif',
            fontSize: englishStyle.fontSize,
            fontWeight: 700,
            whiteSpace: englishStyle.needsWrap ? 'normal' : 'nowrap',
            lineHeight: englishStyle.needsWrap ? 1.4 : 1.2,
            textAlign: 'right',
            display: englishStyle.needsWrap ? 'block' : 'inline',
            maxHeight: '20px',
            overflow: 'hidden',
          }}>
            {totalEnglish}
          </span>
        )}
      </FlexCell>
    </>
  );
};

export default TotalBox;
