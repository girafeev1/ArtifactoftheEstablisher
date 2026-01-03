/**
 * PaymentDetailsPage Component
 *
 * Data-driven supplementary page using generated scheme data.
 * Renders cells exactly as defined in Google Sheets (gid=403093960, rows 161-201).
 */

import React from 'react';
import { InvoiceGrid, SchemePageRenderer } from '../../grid';
import { TOTAL_WIDTH } from '../../grid/gridConstants';
import { spacify } from '../shared';
import { FooterSimple } from '../footers';
import type { SubsidiaryDoc, BankInfo } from '../../types';
import type { ValueOverride } from '../../grid';
import { ROWS, MERGES, ROW_HEIGHTS } from './PaymentDetailsData';

// Footer rows (200-201) are rendered separately via FooterSimple
// Exclude them from scheme rendering
const CONTENT_ROWS = ROWS.filter(r => r.row < 200);
const CONTENT_MERGES = MERGES.filter(m => m.startRow < 200);
const CONTENT_ROW_HEIGHTS = ROW_HEIGHTS.slice(0, -2); // Exclude last 2 rows

export interface PaymentDetailsPageProps {
  subsidiary: SubsidiaryDoc;
  bankInfo: BankInfo;
  qrCodeUrl?: string;
  total?: number;
  totalEnglish?: string;
  totalChinese?: string;
  /** Show debug grid (red dotted lines) */
  debug?: boolean;
  /** Show flexbox/cell debug borders (purple outlines) */
  flexDebug?: boolean;
}

// A4 dimensions - use full page height, not just content height
const A4_USABLE_WIDTH_PX = 736;
const A4_RAW_HEIGHT = 1240; // Extended to fit content + footer (1146px content + 81px footer + margin)
const RAW_WIDTH = TOTAL_WIDTH;
const SCALE_UNIFORM = A4_USABLE_WIDTH_PX / RAW_WIDTH;
const RENDERED_WIDTH = RAW_WIDTH * SCALE_UNIFORM;
const RENDERED_HEIGHT = A4_RAW_HEIGHT * SCALE_UNIFORM;

export const PaymentDetailsPage: React.FC<PaymentDetailsPageProps> = ({
  subsidiary,
  bankInfo,
  qrCodeUrl,
  totalEnglish,
  totalChinese,
  debug,
  flexDebug,
}) => {
  const accountParts = bankInfo.accountNumber?.split('-') || [];
  const branchCode = accountParts[0] || '';
  const accountRest = accountParts.slice(1).join('-') || '';

  // Create value overrides for dynamic content
  // Keys are "sheetRow:col" format (sheet row number, 1-indexed column A=1, B=2, etc.)
  // Based on gid=403093960, rows 161-201
  const valueOverrides: Record<string, ValueOverride | React.ReactNode> = {
    // Payment due notice with red+bold "seven (7) calendar days" (row 169, merge A-N)
    // Font: Cormorant Infant 12pt regular, only "seven (7) calendar days" is bold+red
    // Note: scheme data has bold:true, so we explicitly set fontWeight:400 to override
    '169:A': {
      value: (
        <span style={{ fontFamily: '"Cormorant Infant", serif', fontSize: '16px', fontWeight: 400 }}>
          Payment is due within <span style={{ color: 'rgb(255, 0, 0)', fontWeight: 700 }}>seven (7) calendar days</span> after the earlier of (i) the invoice date; or (ii) the client's written request to release final deliverables. Final deliverables are released only after receipt of cleared funds.
        </span>
      ),
    },

    // Header: Subsidiary name (row 165 col J, merge J-N)
    '165:J': {
      value: (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: '"Cormorant Infant", serif', fontSize: '13px', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'pre' }}>
            {spacify(subsidiary.englishName)}
          </div>
          <div style={{ fontFamily: '"Iansui", sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.25em', lineHeight: 1.2 }}>
            {spacify(subsidiary.chineseName)}
          </div>
        </div>
      ),
    },

    // Bank Info: Beneficiary (row 173 col D, merge D-F)
    '173:D': subsidiary.englishName,

    // Bank Info: BR No. (row 173 col H, merge H-I)
    // Handle both brNumber and br field names for compatibility
    '173:H': subsidiary.brNumber || (subsidiary as unknown as { br?: string })?.br || '',

    // Bank Info: Bank name + code (row 174 col D, merge D-H)
    // Bank code is intentionally smaller (10pt) than bank name, but still bold
    '174:D': {
      value: (
        <span>
          {bankInfo.bankName}
          {bankInfo.bankCode && (
            <span style={{ fontSize: '10pt', fontWeight: 700 }}> ({bankInfo.bankCode})</span>
          )}
        </span>
      ),
    },

    // Bank Info: Branch Code (row 175 col D)
    '175:D': branchCode,

    // Bank Info: Account Number value (row 175 col H, merge H-M)
    '175:H': accountRest,

    // Bank Info: FPS ID (row 176 col D)
    '176:D': bankInfo.fpsId || '',

    // Amount: English (row 178 col D, merge D-G)
    '178:D': totalEnglish || '',

    // Subsidiary name on right side (row 178 col H, merge H-M)
    '178:H': subsidiary.englishName || '',

    // Amount: Chinese (row 180 col D, merge D-F)
    // Override gray color from scheme data to black
    '180:D': {
      value: totalChinese || '',
      style: { color: '#000' },
    },

    // Right side: Address lines (rows 180-183 col H)
    '180:H': subsidiary.addressLine1 || '',
    '181:H': subsidiary.addressLine2 || '',
    '182:H': subsidiary.addressLine3 || '',
    '183:H': subsidiary.region ? `${subsidiary.region}, Hong Kong` : 'Hong Kong',

    // QR Code area (row 185, merge D-E spans 2 rows)
    '185:D': {
      value: qrCodeUrl ? (
        <img src={qrCodeUrl} alt="FPS QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#999', textAlign: 'center' }}>
          QR Code<br/>Unavailable
        </div>
      ),
    },

    // Footer subsidiary name (row 200 col A, merge A-D)
    '200:A': subsidiary.englishName,

    // Footer address (row 201 col A, merge A-D)
    '201:A': {
      value: (
        <div style={{ lineHeight: 1.3 }}>
          <div>{subsidiary.addressLine1}</div>
          <div>{subsidiary.addressLine2}</div>
          <div>{subsidiary.addressLine3}</div>
          <div>{subsidiary.region ? `${subsidiary.region}, Hong Kong` : 'Hong Kong'}</div>
        </div>
      ),
    },

    // Footer contact (row 201 col K, merge K-N)
    '201:K': {
      value: (
        <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
          <div>{spacify(subsidiary.phone || '')}</div>
          <div>{spacify(subsidiary.email || '')}</div>
        </div>
      ),
    },
  };

  return (
    <div
      className="invoice-page payment-details-page"
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
        {/* Main content (rows 161-199) */}
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

export default PaymentDetailsPage;
