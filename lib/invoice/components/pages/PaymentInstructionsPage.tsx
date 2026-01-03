/**
 * PaymentInstructionsPage Component
 *
 * Data-driven supplementary page using generated scheme data.
 * Renders cells exactly as defined in Google Sheets (gid=731885123, rows 147-200).
 */

import React from 'react';
import { InvoiceGrid, SchemePageRenderer } from '../../grid';
import { TOTAL_WIDTH } from '../../grid/gridConstants';
import { spacify } from '../shared';
import { FooterSimple } from '../footers';
import type { SubsidiaryDoc, BankInfo } from '../../types';
import type { ValueOverride } from '../../grid';
import { ROWS, MERGES, ROW_HEIGHTS } from './PaymentInstructionsData';

// Footer rows (199-200) are rendered separately via FooterSimple
// Exclude them from scheme rendering
const CONTENT_ROWS = ROWS.filter(r => r.row < 199);
const CONTENT_MERGES = MERGES.filter(m => m.startRow < 199);
const CONTENT_ROW_HEIGHTS = ROW_HEIGHTS.slice(0, -2); // Exclude last 2 rows

export interface PaymentInstructionsPageProps {
  subsidiary: SubsidiaryDoc;
  bankInfo: BankInfo;
  invoiceNumber?: string;
  invoiceDate?: Date | string;
  total?: number;
  totalEnglish?: string;
  totalChinese?: string;
  clientRepresentative?: string;
  /** QR code URL for FPS payment */
  qrCodeUrl?: string;
  /** Show debug grid (red dotted lines) */
  debug?: boolean;
  /** Show flexbox/cell debug borders (purple outlines) */
  flexDebug?: boolean;
}

// A4 dimensions - use full page height, not just content height
const A4_USABLE_WIDTH_PX = 736;
const A4_RAW_HEIGHT = 1240; // Extended to fit content + footer
const RAW_WIDTH = TOTAL_WIDTH;
const SCALE_UNIFORM = A4_USABLE_WIDTH_PX / RAW_WIDTH;
const RENDERED_WIDTH = RAW_WIDTH * SCALE_UNIFORM;
const RENDERED_HEIGHT = A4_RAW_HEIGHT * SCALE_UNIFORM;

export const PaymentInstructionsPage: React.FC<PaymentInstructionsPageProps> = ({
  subsidiary,
  bankInfo,
  invoiceNumber,
  invoiceDate,
  total,
  totalEnglish,
  totalChinese,
  clientRepresentative,
  qrCodeUrl,
  debug,
  flexDebug,
}) => {
  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return amount.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const accountParts = bankInfo.accountNumber?.split('-') || [];
  const branchCode = accountParts[0] || '';
  const accountNumber = accountParts.slice(1).join('-') || '';

  const parsedDate = invoiceDate ? new Date(invoiceDate) : new Date();
  const dateDD = String(parsedDate.getDate()).padStart(2, '0');
  const dateMM = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const dateYYYY = String(parsedDate.getFullYear());

  // Create value overrides for dynamic content
  // Keys are "sheetRow:col" format
  const valueOverrides: Record<string, ValueOverride | React.ReactNode> = {
    // Header: Subsidiary name (row 151, J-N merge)
    '151:J': {
      value: (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: '"Cormorant Infant", serif', fontSize: '10px', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'pre' }}>
            {spacify(subsidiary.englishName)}
          </div>
          <div style={{ fontFamily: '"Iansui", sans-serif', fontSize: '8px', fontWeight: 700, letterSpacing: '0.25em', lineHeight: 1.2 }}>
            {spacify(subsidiary.chineseName)}
          </div>
        </div>
      ),
    },

    // Cheque: Date values (row 159)
    '159:J': dateDD,
    '159:L': dateMM,
    '159:N': dateYYYY,

    // Cheque: PAY line - payee name (row 163, D-J merge)
    '163:D': subsidiary.englishName,

    // Cheque: Amount in words (row 165, D-J merge area)
    '165:D': totalEnglish || '-',

    // Cheque: Numeric amount (row 165, L-N)
    '165:L': formatCurrency(total),

    // Cheque: Chinese amount (row 167, D-I area)
    '167:D': totalChinese || '-',

    // Cheque: Signature (row 168, J-N merge)
    '168:J': clientRepresentative || '',

    // Transfer: Account Name (row 179, A-G merge)
    '179:A': subsidiary.englishName,

    // Transfer: Bank name + code (row 182, A-G merge)
    '182:A': `${bankInfo.bankName}  ${bankInfo.bankCode || ''}`,

    // Transfer: Branch code (row 184, A-C area)
    '184:A': spacify(branchCode),

    // Transfer: Account number (row 184, D-G merge) - left aligned
    '184:D': {
      value: spacify(accountNumber),
      style: { textAlign: 'left' },
    },

    // Transfer: FPS ID (row 184, I column - NOT J, the label is in row 183 col I)
    '184:I': spacify(bankInfo.fpsId || ''),

    // Transfer: Amount English (row 187)
    '187:A': totalEnglish || '-',

    // Transfer: Amount Chinese (row 189)
    '189:A': totalChinese || '-',

    // Transfer: FPS QR Code (row 183, M-N merge spanning 3 rows)
    '183:M': {
      value: qrCodeUrl ? (
        <img src={qrCodeUrl} alt="FPS QR Code" style={{ width: '56px', height: '56px' }} />
      ) : (
        <div style={{ width: '56px', height: '56px', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#999', textAlign: 'center' }}>
          QR Code<br/>Unavailable
        </div>
      ),
    },
    // Footer is rendered separately via FooterSimple component
  };

  return (
    <div
      className="invoice-page payment-instructions-page"
      style={{
        width: `${RENDERED_WIDTH}px`,
        height: `${RENDERED_HEIGHT}px`,
        position: 'relative',
        overflow: debug ? 'visible' : 'hidden',
        marginBottom: '40px',
        marginLeft: debug ? '30px' : undefined,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        background: '#fff',
      }}
    >
      <div
        style={{
          transformOrigin: 'top left',
          transform: `scale(${SCALE_UNIFORM})`,
          width: `${RAW_WIDTH}px`,
          height: `${A4_RAW_HEIGHT}px`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Main content (rows 147-198) */}
        <InvoiceGrid showGrid={debug} style={{ flex: '0 0 auto' }} rowHeights={CONTENT_ROW_HEIGHTS}>
          <SchemePageRenderer
            rows={CONTENT_ROWS}
            merges={CONTENT_MERGES}
            valueOverrides={valueOverrides}
            debug={flexDebug}
          />
        </InvoiceGrid>

        {/* Flexible spacer - pushes footer to bottom */}
        <div style={{ flex: '1 1 auto', minHeight: '0px' }} />

        {/* Footer - same as continuation pages */}
        <InvoiceGrid showGrid={debug} style={{ flex: '0 0 auto' }} rowHeights={[24, 57]}>
          <FooterSimple
            subsidiary={subsidiary}
            pageNumber={1}
            debug={flexDebug}
          />
        </InvoiceGrid>
      </div>
    </div>
  );
};

export default PaymentInstructionsPage;
