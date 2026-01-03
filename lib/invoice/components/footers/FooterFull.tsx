/**
 * FooterFull Component
 *
 * Full footer for the last page with payment information.
 * Layout matches footer-full-payment.json exactly.
 *
 * Row heights: [16, 22, 16, 24, 16, 21, 16, 21, 20, 23] = 195px total
 */

import React from 'react';
import { FlexCell, Cell } from '../../grid';
import type { SubsidiaryDoc, BankInfo } from '../../types';

export interface FooterFullProps {
  /** Subsidiary information */
  subsidiary: SubsidiaryDoc;
  /** Bank information */
  bankInfo: BankInfo;
  /** Total in English words */
  totalEnglish?: string;
  /** Total in Chinese characters */
  totalChinese?: string;
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

const labelStyle: React.CSSProperties = {
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '10px', // 8 + 2
  fontStyle: 'italic',
  color: 'rgb(67, 67, 67)', // 0.2627451 * 255
};

const valueStyle: React.CSSProperties = {
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '13px', // 11 + 2
  fontWeight: 700,
};

/**
 * FooterFull - Full footer for last page
 *
 * Layout from JSON (10 rows) with merges:
 * - Row 1: A-D (1-4), G-N (7-14)
 * - Row 2: A-D (1-4), G-N (7-14)
 * - Row 3: A-D (1-4), G-I (7-9)
 * - Row 4: A-G (1-7)
 * - Row 5: A-D (1-4)
 * - Row 6: A-D (1-4)
 * - Row 7: A-D (1-4)
 * - Row 8: A-D (1-4)
 * - Row 10: A-N (1-14)
 */
export const FooterFull: React.FC<FooterFullProps> = ({
  subsidiary,
  bankInfo,
  totalEnglish,
  totalChinese,
  debug,
}) => {
  // Split account number into two parts if needed
  // Format: "XXX-XXXXXX-XXX" where XXX is branch code
  const accountNumber = bankInfo.accountNumber || '';
  const parts = accountNumber.split('-');
  const accountPart1 = parts[0] || ''; // Branch code (first segment)
  const accountPart2 = parts.slice(1).join('-'); // Rest of account number

  return (
    <>
      {/* === Row 1 (16px): Labels - A-D + gap + G-N === */}
      <FlexCell columns="A-D" height={16} vAlign="top" hAlign="left" debug={debug}>
        <span style={labelStyle}>Cheque Payable To :</span>
      </FlexCell>
      <Cell columns="E-F" height={16} debug={debug} />
      <FlexCell columns="G-N" height={16} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={labelStyle}>For the amount of:</span>
      </FlexCell>

      {/* === Row 2 (22px): Subsidiary Name + English Total - A-D + gap + G-N === */}
      <FlexCell columns="A-D" height={22} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={valueStyle}>{subsidiary.englishName}</span>
      </FlexCell>
      <Cell columns="E-F" height={22} debug={debug} />
      <FlexCell columns="G-N" height={22} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={valueStyle}>{totalEnglish}</span>
      </FlexCell>

      {/* === Row 3 (16px): Bank Label + Chinese Label - A-D + gap + N === */}
      <FlexCell columns="A-D" height={16} vAlign="top" hAlign="left" debug={debug}>
        <span style={labelStyle}>Bank:</span>
      </FlexCell>
      <Cell columns="E-M" height={16} debug={debug} />
      <FlexCell columns="N" height={16} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{
          fontFamily: '"Yuji Mai", serif',
          fontSize: '9px', // 7 + 2
          fontWeight: 700,
          fontStyle: 'italic',
          color: 'rgb(67, 67, 67)',
        }}>
          茲付金額:
        </span>
      </FlexCell>

      {/* === Row 4 (24px): Bank Name + Chinese Total - A-G + gap === */}
      <FlexCell columns="A-G" height={24} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={valueStyle}>
          {bankInfo.bankName}
          {bankInfo.bankCode && ` (${bankInfo.bankCode})`}
        </span>
      </FlexCell>
      <Cell columns="H-J" height={24} debug={debug} />
      <FlexCell columns="K-N" height={24} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{
          fontFamily: '"Iansui", sans-serif',
          fontSize: '14px', // 12 + 2
          fontWeight: 700,
        }}>
          {totalChinese}
        </span>
      </FlexCell>

      {/* === Row 5 (16px): Branch Code Label - A-D only === */}
      <FlexCell columns="A-D" height={16} vAlign="top" hAlign="left" debug={debug}>
        <span style={labelStyle}>Branch Code</span>
      </FlexCell>
      <Cell columns="E-N" height={16} debug={debug} />

      {/* === Row 6 (21px): Branch Code Value - A-D only === */}
      <FlexCell columns="A-D" height={21} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '12px', // 10 + 2
          fontWeight: 700,
        }}>
          {spacify(accountPart1)}
        </span>
      </FlexCell>
      <Cell columns="E-N" height={21} debug={debug} />

      {/* === Row 7 (16px): Account Number + FPS ID Labels - A-D + gap === */}
      <FlexCell columns="A-D" height={16} vAlign="top" hAlign="left" debug={debug}>
        <span style={labelStyle}>Account Number:</span>
      </FlexCell>
      <Cell columns="E-F" height={16} debug={debug} />
      <FlexCell columns="G-N" height={16} vAlign="top" hAlign="right" debug={debug}>
        <span style={labelStyle}>FPS ID:</span>
      </FlexCell>

      {/* === Row 8 (21px): Account Number + FPS ID Values - A-D + gap === */}
      <FlexCell columns="A-D" height={21} vAlign="bottom" hAlign="left" debug={debug}>
        <span style={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '12px', // 10 + 2
          fontWeight: 700,
        }}>
          {spacify(accountPart2)}
        </span>
      </FlexCell>
      <Cell columns="E-F" height={21} debug={debug} />
      <FlexCell columns="G-N" height={21} vAlign="bottom" hAlign="right" debug={debug}>
        <span style={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '12px', // 10 + 2
          fontWeight: 700,
        }}>
          {spacify(bankInfo.fpsId)}
        </span>
      </FlexCell>

      {/* === Row 9 (20px): Empty === */}
      <Cell columns="A-N" height={20} debug={debug} />

      {/* === Row 10 (23px): Payment Terms - A-N === */}
      <FlexCell columns="A-N" height={23} vAlign="bottom" hAlign="center" debug={debug}>
        <span style={{
          fontFamily: '"Roboto Mono", monospace',
          fontSize: '13px', // 11 + 2
          fontWeight: 700,
        }}>
          PAYMENT TERMS: FULL PAYMENT WITHIN 7 DAYS
        </span>
      </FlexCell>
    </>
  );
};

export default FooterFull;
