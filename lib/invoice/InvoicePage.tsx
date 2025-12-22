/**
 * InvoicePage Component
 *
 * Composes all invoice sub-components into a single page layout.
 * Handles first page vs continuation page, with/without total box.
 * Applies scaling to fit A4 page dimensions, matching DynamicInvoice behavior.
 */

import React from 'react';
import { InvoiceGrid, Spacer } from './grid';
import { InvoiceHeaderFull, InvoiceHeaderContinuation } from './components/headers';
import { ItemTableHeader, ItemRow } from './components/items';
import { TotalBox } from './components/totals';
import { FooterFull, FooterSimple } from './components/footers';
import { TOTAL_WIDTH } from './grid/gridConstants';
import type { ProjectInvoiceRecord, ProjectRecord, SubsidiaryDoc, BankInfo, InvoiceItem } from './types';

export interface InvoicePageProps {
  /** Page number (1-based) */
  pageNumber: number;
  /** Total number of pages */
  totalPages: number;
  /** Is this the first page? */
  isFirstPage: boolean;
  /** Is this the last page? (show total box and full footer) */
  isLastPage: boolean;
  /** Items to render on this page */
  items: InvoiceItem[];
  /** Starting item index (for global numbering) */
  startItemIndex: number;
  /** Spacing configuration */
  spacing: {
    preItem: number;
    betweenItems: number;
    beforeTotal: number;
    afterTotal?: number;
  };
  /** Invoice record */
  invoice: ProjectInvoiceRecord;
  /** Project record (optional) */
  project?: ProjectRecord | null;
  /** Subsidiary info */
  subsidiary: SubsidiaryDoc;
  /** Bank information */
  bankInfo: BankInfo;
  /** Invoice total amount */
  total: number;
  /** Total in English words */
  totalEnglish?: string;
  /** Total in Chinese characters */
  totalChinese?: string;
  /** QR code URL for payment */
  qrCodeUrl?: string;
  /** Show debug grid column overlay */
  debug?: boolean;
  /** Show debug flexbox/cell borders */
  flexDebug?: boolean;
}

// A4 page dimensions at 96dpi with margins
const A4_USABLE_WIDTH_PX = 736;
const A4_USABLE_HEIGHT_PX = 1085;

// Raw content dimensions (before scaling)
const RAW_WIDTH = TOTAL_WIDTH; // 816px
const RAW_HEIGHT = 1180; // Approximate content height

// Scale factor to fit A4 width
const SCALE_FOR_A4 = A4_USABLE_WIDTH_PX / RAW_WIDTH; // ~0.902

// For screen display, target larger size for quality
const TARGET_SCREEN_WIDTH = 900;
const SCALE_FOR_SCREEN = TARGET_SCREEN_WIDTH / RAW_WIDTH;

// Use the smaller scale (fit to A4)
const SCALE_UNIFORM = Math.min(SCALE_FOR_SCREEN, SCALE_FOR_A4);

// Rendered dimensions after scaling
const RENDERED_WIDTH = RAW_WIDTH * SCALE_UNIFORM;
const RENDERED_HEIGHT = RAW_HEIGHT * SCALE_UNIFORM;

/**
 * InvoicePage - Composes a single invoice page
 *
 * Layout varies based on page type:
 * - First page: Full header (476px)
 * - Continuation page: Minimal header (210px)
 * - Last page: Total box + full footer (195px)
 * - Middle page: Simple footer (81px)
 */
export const InvoicePage: React.FC<InvoicePageProps> = ({
  pageNumber,
  totalPages,
  isFirstPage,
  isLastPage,
  items,
  startItemIndex,
  spacing,
  invoice,
  project,
  subsidiary,
  bankInfo,
  total,
  totalEnglish,
  totalChinese,
  qrCodeUrl,
  debug,
  flexDebug,
}) => {
  // Extra padding for debug labels (column labels at top, row labels at left)
  const debugPaddingTop = debug ? 24 : 0;
  const debugPaddingLeft = debug ? 32 : 0;

  return (
    <div
      className="invoice-page"
      style={{
        width: `${RENDERED_WIDTH + debugPaddingLeft}px`,
        height: `${RENDERED_HEIGHT + debugPaddingTop}px`,
        position: 'relative',
        overflow: debug ? 'visible' : 'hidden',
        marginBottom: '40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        paddingTop: debugPaddingTop,
        paddingLeft: debugPaddingLeft,
      }}
    >
      {/* Clip wrapper - clips the transformed content */}
      <div style={{
        width: `${RENDERED_WIDTH}px`,
        height: `${RENDERED_HEIGHT}px`,
        overflow: debug ? 'visible' : 'hidden',
        position: 'absolute',
        top: debugPaddingTop,
        left: debugPaddingLeft,
      }}>
        {/* Scale wrapper - scales raw content to fit A4 */}
        {/* Using flex column layout to push footer to bottom */}
        <div style={{
          transformOrigin: 'top left',
          transform: `scale(${SCALE_UNIFORM})`,
          width: `${RAW_WIDTH}px`,
          height: `${RAW_HEIGHT}px`,
          position: 'relative',
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Main content grid */}
          <InvoiceGrid showGrid={debug} style={{ flex: '0 0 auto' }}>
            {/* === Header === */}
            {isFirstPage ? (
              <InvoiceHeaderFull
                invoice={invoice}
                project={project}
                subsidiary={subsidiary}
                qrCodeUrl={qrCodeUrl}
                debug={flexDebug}
              />
            ) : (
              <InvoiceHeaderContinuation
                invoice={invoice}
                project={project}
                subsidiary={subsidiary}
                pageNumber={pageNumber}
                debug={flexDebug}
              />
            )}

            {/* === Table Header === */}
            <ItemTableHeader debug={flexDebug} />

            {/* === Pre-Item Spacing === */}
            {spacing.preItem > 0 && (
              <Spacer rows={spacing.preItem} />
            )}

            {/* === Items === */}
            {items.map((item, idx) => (
              <React.Fragment key={startItemIndex + idx}>
                {/* Between-item spacing (except before first item) */}
                {idx > 0 && spacing.betweenItems > 0 && (
                  <Spacer rows={spacing.betweenItems} />
                )}
                <ItemRow
                  item={item}
                  index={startItemIndex + idx}
                  debug={flexDebug}
                />
              </React.Fragment>
            ))}

            {/* === Before Total Spacing === */}
            {isLastPage && spacing.beforeTotal > 0 && (
              <Spacer rows={spacing.beforeTotal} />
            )}

            {/* === Total Box (last page only) === */}
            {isLastPage && (
              <TotalBox
                total={total}
                totalEnglish={totalEnglish}
                totalChinese={totalChinese}
                debug={flexDebug}
              />
            )}

            {/* === After Total Spacing === */}
            {isLastPage && spacing.afterTotal && spacing.afterTotal > 0 && (
              <Spacer rows={spacing.afterTotal} />
            )}
          </InvoiceGrid>

          {/* Flexible spacer - pushes footer to bottom */}
          <div style={{ flex: '1 1 auto', minHeight: '0px' }} />

          {/* Footer grid - always at bottom of page */}
          <InvoiceGrid showGrid={debug} style={{ flex: '0 0 auto' }}>
            {isLastPage ? (
              <FooterFull
                subsidiary={subsidiary}
                bankInfo={bankInfo}
                totalEnglish={totalEnglish}
                totalChinese={totalChinese}
                debug={flexDebug}
              />
            ) : (
              <FooterSimple
                subsidiary={subsidiary}
                pageNumber={pageNumber}
                totalPages={totalPages}
                debug={flexDebug}
              />
            )}
          </InvoiceGrid>
        </div>{/* Close scale wrapper */}
      </div>{/* Close clip wrapper */}
    </div>
  );
};

export default InvoicePage;
