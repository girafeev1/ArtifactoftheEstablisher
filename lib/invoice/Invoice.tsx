/**
 * Invoice Component
 *
 * Main invoice renderer that handles pagination and renders all pages.
 * Replaces the old DynamicInvoice + JSON section approach.
 */

import React, { useMemo } from 'react';
import { InvoicePage } from './InvoicePage';
import { PaymentDetailsPage, PaymentInstructionsPage } from './components';
import { paginateInvoice, type InvoicePaginationResult, type InvoiceItem as PaginationInvoiceItem } from '../invoiceTemplates/paginationEngine';
import type { ProjectInvoiceRecord, ProjectRecord, SubsidiaryDoc, BankInfo, InvoiceItem, InvoiceVariant } from './types';

export interface InvoiceProps {
  /** Invoice record from database */
  invoice: ProjectInvoiceRecord;
  /** Project record (optional) */
  project?: ProjectRecord | null;
  /** Subsidiary info */
  subsidiary: SubsidiaryDoc;
  /** Bank information */
  bankInfo: BankInfo;
  /** Invoice variant (affects which supplementary pages to include) */
  variant?: InvoiceVariant;
  /** Total in English words */
  totalEnglish?: string;
  /** Total in Chinese characters */
  totalChinese?: string;
  /** QR code URL for payment */
  qrCodeUrl?: string;
  /** Client representative name (for cheque signature) */
  clientRepresentative?: string;
  /** Show debug grid column overlay */
  debug?: boolean;
  /** Show debug flexbox/cell borders */
  flexDebug?: boolean;
}

/**
 * Calculate invoice total from items
 */
function calculateInvoiceTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => {
    const lineTotal = (item.unitPrice || 0) * (item.quantity || 0) - (item.discount || 0);
    return sum + lineTotal;
  }, 0);
}

/**
 * Invoice - Main invoice renderer
 *
 * Features:
 * - Automatic pagination based on item count and content
 * - First page with full header, continuation pages with minimal header
 * - Last page with total box and full payment footer
 * - Support for multi-page invoices
 */
export const Invoice: React.FC<InvoiceProps> = ({
  invoice,
  project,
  subsidiary,
  bankInfo,
  variant = 'B',
  totalEnglish,
  totalChinese,
  qrCodeUrl,
  clientRepresentative,
  debug,
  flexDebug,
}) => {
  // Extract items from invoice
  const items: InvoiceItem[] = useMemo(() => {
    if (!invoice.items || !Array.isArray(invoice.items)) {
      return [];
    }
    return invoice.items.map(item => ({
      title: item.title || '',
      feeType: item.feeType || '',
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 0,
      quantityUnit: item.quantityUnit || '',
      subQuantity: item.subQuantity ?? undefined,
      notes: item.notes ?? undefined,
      discount: item.discount ?? undefined,
    }));
  }, [invoice.items]);

  // Calculate pagination
  const pagination: InvoicePaginationResult = useMemo(() => {
    if (items.length === 0) {
      // Return single empty page
      return {
        pages: [{
          pageNumber: 1,
          type: 'single' as const,
          sections: {
            header: 'header-versionB-full',
            tableHeader: 'item-table-header',
            items: [],
            totalBox: true,
            footer: 'footer-full-payment',
          },
          spacing: {
            preItem: 3,
            betweenItems: 0,
            beforeTotal: 3,
            afterTotal: 0,
          },
          spacingPx: {
            preItemPx: 63,
            betweenItemsPx: 0,
            beforeTotalPx: 63,
            afterTotalPx: 0,
          },
          dynamicSpacing: false,
          rowsUsed: 0,
          rowsAvailable: 51,
          remainingSpacePx: 0,
        }],
        totalPages: 1,
        itemDistribution: [0],
        layoutMode: 'single-page' as const,
      };
    }
    // Convert to PaginationInvoiceItem which requires quantityUnit
    const paginationItems: PaginationInvoiceItem[] = items.map(item => ({
      title: item.title,
      feeType: item.feeType,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      quantityUnit: item.quantityUnit || '',
      subQuantity: item.subQuantity,
      notes: item.notes,
      discount: item.discount,
    }));
    return paginateInvoice(paginationItems);
  }, [items]);

  // Calculate total
  const total = useMemo(() => calculateInvoiceTotal(items), [items]);

  // Debug: Log pagination and data info in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Invoice] Pagination:', {
      itemCount: items.length,
      totalPages: pagination.totalPages,
      layoutMode: pagination.layoutMode,
      itemDistribution: pagination.itemDistribution,
    });
    console.log('[Invoice] Data:', {
      variant,
      hasSubsidiary: !!subsidiary,
      subsidiaryName: subsidiary?.englishName,
      hasBankInfo: !!bankInfo,
      bankName: bankInfo?.bankName || '(empty)',
      bankCode: bankInfo?.bankCode || '(empty)',
      accountNumber: bankInfo?.accountNumber || '(empty)',
      fpsId: bankInfo?.fpsId || '(not set)',
      fpsEmail: bankInfo?.fpsEmail || '(not set)',
      hasQrCodeUrl: !!qrCodeUrl,
      qrCodeUrl: qrCodeUrl ? qrCodeUrl.substring(0, 50) + '...' : '(none)',
    });
  }

  // Determine which supplementary pages to include based on variant
  const includePaymentDetails = variant === 'A' || variant === 'A2' || variant === 'bundle';
  const includePaymentInstructions = variant === 'B2' || variant === 'A2' || variant === 'bundle';

  return (
    <div className="invoice-container">
      <style>{`
        .invoice-container {
          font-family: 'Roboto Mono', monospace;
          color: #000;
          background-color: #fff;
          padding: 16px 0;
          width: 100%;
        }
        .invoice-page {
          box-sizing: border-box;
        }
        /* Print-specific styles */
        @media print {
          .invoice-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          .invoice-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            position: relative !important;
            box-shadow: none !important;
          }
          .invoice-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
        /* Screen display */
        @media screen {
          .invoice-page {
            overflow: hidden;
            margin-bottom: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
      `}</style>
      {/* Main Invoice Pages */}
      {pagination.pages.map((page, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = page.sections.totalBox;

        // Get items for this page
        const pageItems = page.sections.items.map(pi => pi.item);
        const startItemIndex = page.sections.items[0]?.itemIndex ?? 0;

        return (
          <InvoicePage
            key={page.pageNumber}
            pageNumber={page.pageNumber}
            totalPages={pagination.totalPages}
            isFirstPage={isFirstPage}
            isLastPage={isLastPage}
            items={pageItems}
            startItemIndex={startItemIndex}
            spacing={{
              preItem: page.spacing.preItem,
              betweenItems: page.spacing.betweenItems,
              beforeTotal: page.spacing.beforeTotal,
              afterTotal: 2,
            }}
            invoice={invoice}
            project={project}
            subsidiary={subsidiary}
            bankInfo={bankInfo}
            total={total}
            totalEnglish={totalEnglish}
            totalChinese={totalChinese}
            qrCodeUrl={qrCodeUrl}
            variant={variant}
            debug={debug}
            flexDebug={flexDebug}
          />
        );
      })}

      {/* Supplementary Pages based on variant */}
      {includePaymentDetails && (
        <PaymentDetailsPage
          subsidiary={subsidiary}
          bankInfo={bankInfo}
          qrCodeUrl={qrCodeUrl}
          total={total}
          totalEnglish={totalEnglish}
          totalChinese={totalChinese}
          debug={debug}
          flexDebug={flexDebug}
        />
      )}

      {includePaymentInstructions && (
        <PaymentInstructionsPage
          subsidiary={subsidiary}
          bankInfo={bankInfo}
          invoiceNumber={invoice.invoiceNumber}
          invoiceDate={invoice.createdAt || undefined}
          total={total}
          totalEnglish={totalEnglish}
          totalChinese={totalChinese}
          clientRepresentative={clientRepresentative}
          qrCodeUrl={qrCodeUrl}
          debug={debug}
          flexDebug={flexDebug}
        />
      )}
    </div>
  );
};

export default Invoice;
