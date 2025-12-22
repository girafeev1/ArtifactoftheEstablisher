/**
 * TotalBox Component
 *
 * Displays the invoice total with amount in numbers, English words, and Chinese characters.
 * Layout matches total-box.json exactly.
 *
 * Row heights: [22, 34, 22] = 78px total
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

/**
 * TotalBox - Invoice total section
 *
 * Layout from JSON:
 * - Row 1 (22px): Chinese total (J-N) with top/right borders
 * - Row 2 (34px): "INVOICE TOTAL" (G), "(HK)" (K), Total amount (L-N) with left/right borders
 * - Row 3 (22px): English total (J-N) with bottom/right borders
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

  return (
    <>
      {/* === Row 1 (22px): Chinese Total === */}
      <Cell columns="A-F" height={22} debug={debug} />
      <Cell
        columns="G-I"
        height={22}
        debug={debug}
        style={{ borderTop: '2px solid #000', borderLeft: '2px solid #000' }}
      />
      <FlexCell
        columns="J-N"
        height={22}
        vAlign="bottom"
        hAlign="right"
        debug={debug}
        style={{
          borderTop: '2px solid #000',
          borderRight: '2px solid #000',
        }}
      >
        {totalChinese && (
          <span style={{
            fontFamily: '"Iansui", sans-serif',
            fontSize: '14px', // 12 + 2
            fontWeight: 700,
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
        columns="G-I"
        height={22}
        debug={debug}
        style={{ borderBottom: '2px solid #000', borderLeft: '2px solid #000' }}
      />
      <FlexCell
        columns="J-N"
        height={22}
        vAlign="middle"
        hAlign="right"
        debug={debug}
        style={{
          borderBottom: '2px solid #000',
          borderRight: '2px solid #000',
        }}
      >
        {totalEnglish && (
          <span style={{
            fontFamily: '"Federo", sans-serif',
            fontSize: '14px', // 12 + 2
            fontWeight: 700,
          }}>
            {totalEnglish}
          </span>
        )}
      </FlexCell>
    </>
  );
};

export default TotalBox;
