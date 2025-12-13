/**
 * DynamicInvoice Component (New Pagination System)
 *
 * Renders invoices using the modular section-based pagination system.
 * Works in parallel with the existing GeneratedInvoice component.
 */

import React from 'react';
import type { ProjectInvoiceRecord } from '../../lib/projectInvoices';
import type { ProjectRecord } from '../../lib/projectsDatabase';
import type { SubsidiaryDoc } from '../../lib/subsidiaries';
import type { ComposedInvoice, ComposedPage } from '../../lib/invoiceTemplates/layoutComposer';
import { num2eng, num2chi } from '../../lib/invoiceFormat';
import { buildHKFPSPayload, buildHKFPSQrUrl } from '../../lib/fpsPayload';

type DynamicInvoiceProps = {
  invoice: ProjectInvoiceRecord;
  composedLayout: ComposedInvoice; // Pre-calculated layout from pagination engine
  project?: ProjectRecord | null;
  subsidiary?: SubsidiaryDoc | null;
  showGridOverlay?: boolean;
  bankInfo?: any | null;
  suppressGridLabels?: boolean;
};

const DynamicInvoice: React.FC<DynamicInvoiceProps> = ({
  invoice,
  composedLayout,
  project,
  subsidiary,
  showGridOverlay,
  bankInfo,
  suppressGridLabels,
}) => {
  // Calculate totals
  const subtotal = invoice.items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
  const total = subtotal - invoice.items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const effectiveTotal =
    typeof invoice.total === 'number' && !Number.isNaN(invoice.total)
      ? invoice.total
      : total;

  // Format invoice date
  const formatInvoiceDate = (iso?: string | null, display?: string | null) => {
    const raw = iso || display;
    if (!raw) return '';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return raw;
  };

  const invoiceDateRawIso = project?.projectDateIso ?? null;
  const invoiceDate = formatInvoiceDate(invoiceDateRawIso, project?.projectDateDisplay ?? null);
  let invoiceDateDay = '';
  let invoiceDateMonth = '';
  let invoiceDateYear = '';
  if (invoiceDateRawIso) {
    const d = new Date(invoiceDateRawIso);
    if (!Number.isNaN(d.getTime())) {
      const dd = d.getDate();
      const mm = d.getMonth() + 1;
      const yyyy = d.getFullYear();
      invoiceDateDay = dd.toString().padStart(2, '0');
      invoiceDateMonth = mm.toString().padStart(2, '0');
      invoiceDateYear = yyyy.toString();
    }
  }

  // Bank details
  let bankName = '';
  let bankCode = '';
  let bankAccountNumber = '';
  let bankPart1 = '';
  let bankPart2 = '';
  let fpsProxy: string | null = null;
  if (bankInfo) {
    bankName = bankInfo.bankName ?? '';
    bankCode = bankInfo.bankCode ?? '';
    bankAccountNumber = bankInfo.accountNumber ?? '';
    fpsProxy =
      (bankInfo.fpsId != null && String(bankInfo.fpsId)) ||
      (bankInfo.fpsEmail != null && String(bankInfo.fpsEmail)) ||
      null;
  }
  if (bankAccountNumber) {
    const parts = String(bankAccountNumber).split(/[-\s]/).filter(Boolean);
    bankPart1 = parts[0] ?? bankAccountNumber;
    bankPart2 = parts.slice(1).join('-') ?? '';
  }

  // Build bindings map for token replacement
  const bindings: Record<string, string | number> = {
    ClientCompanyName: invoice.companyName || '',
    ClientAddressLine1: invoice.addressLine1 || '',
    ClientAddressLine2: invoice.addressLine2 || '',
    ClientAddressLine3: invoice.addressLine3 || '',
    ClientRegion: invoice.region || '',
    ClientRepresentativeName: invoice.representative || '',
    ClientRepresentativeTitle: (invoice as any).title || '',
    PresenterWorkType: project?.presenterWorkType ?? '',
    ProjectTitle: project?.projectTitle ?? '',
    ProjectNature: project?.projectNature ?? '',
    InvoiceNumber: invoice.invoiceNumber || '',
    InvoiceDate: invoiceDate,
    SubsidiaryEnglishName: subsidiary?.englishName ?? '',
    SubsidiaryChineseName: subsidiary?.chineseName ?? '',
    SubsidiaryAddressLine1: subsidiary?.addressLine1 ?? '',
    SubsidiaryAddressLine2: subsidiary?.addressLine2 ?? '',
    SubsidiaryAddressLine3: subsidiary?.addressLine3 ?? '',
    SubsidiaryRegion: subsidiary?.region ?? '',
    SubsidiaryEmail: subsidiary?.email ?? '',
    SubsidiaryPhone: subsidiary?.phone ?? '',
    InvoiceTotalNumeric: `$${effectiveTotal.toLocaleString('en-HK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    InvoiceTotalEnglish: num2eng(effectiveTotal),
    InvoiceTotalChinese: num2chi(effectiveTotal),
    BankName: bankName,
    BankCode: bankCode,
    BankAccountNumber: bankAccountNumber,
    BankAccountNumberPart1: bankPart1,
    BankAccountNumberPart2: bankPart2,
    FPSId: fpsProxy ?? '',
    SubsidiaryBRNumber: (subsidiary as any)?.brNumber ?? (subsidiary as any)?.br ?? '',
    InvoiceDate_DD: invoiceDateDay,
    InvoiceDate_MM: invoiceDateMonth,
    InvoiceDate_YYYY: invoiceDateYear,
  };

  // Add item bindings (for cells that reference items)
  invoice.items.forEach((item, idx) => {
    const itemNum = idx + 1;
    const lineTotal = (item.unitPrice || 0) * (item.quantity || 0) - (item.discount || 0);
    bindings[`Item${itemNum}Title`] = item.title || '';
    bindings[`Item${itemNum}FeeType`] = item.feeType || '';
    bindings[`Item${itemNum}UnitPrice`] = item.unitPrice ?? 0;
    bindings[`Item${itemNum}Quantity`] = item.quantity ?? 0;
    bindings[`Item${itemNum}QuantityUnit`] = item.quantityUnit ? `/${item.quantityUnit}` : '';
    bindings[`Item${itemNum}SubQuantity`] = item.subQuantity ?? '';
    bindings[`Item${itemNum}Notes`] = item.notes || '';
    bindings[`Item${itemNum}LineTotal`] = `$${lineTotal.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  });

  // FPS QR Code
  const fpsPayload = buildHKFPSPayload(
    fpsProxy,
    false,
    null,
    invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : null
  );
  const fpsQrUrl = buildHKFPSQrUrl(fpsPayload, 220);

  // Token replacement helper
  const spacify = (input: string) => {
    if (!input) return '';
    return String(input)
      .split('\n')
      .map((line) => line.split('').join(' '))
      .join('\n');
  };

  const replaceTokens = (text: string, map: Record<string, string | number>) => {
    const getVal = (rawKey: string, useSpacify: boolean) => {
      const key = String(rawKey || '').trim();
      const val = map[key];
      if (val === undefined || val === null) return '';
      const out = typeof val === 'number' ? String(val) : String(val);
      return useSpacify ? spacify(out) : out;
    };

    let result = text;
    result = result.replace(/<([^>]+)>\s*\*Spacified\*/gi, (_m, field) => getVal(field, true));
    result = result.replace(/\*Spacified\*\s*<([^>]+)>/gi, (_m, field) => getVal(field, true));
    result = result.replace(/<([^>]+)>/g, (_m, field) => getVal(field, false));
    result = result.replace(/\*Spacified\*/gi, '');
    return result.replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
  };

  // Render each page
  const renderPage = (page: ComposedPage) => {
    const { columnWidthsPx, rowHeightsPx, cells, merges } = page;

    const TARGET_CONTENT_WIDTH_PX = 1100;
    const rawWidth = columnWidthsPx.reduce((acc, w) => acc + (w || 0), 0) || 1;
    const scaleUniform = TARGET_CONTENT_WIDTH_PX / rawWidth;
    const colTemplate = columnWidthsPx.map((w) => `${w || 0}px`).join(' ');

    const mergeInfo = new Map<string, { rowSpan: number; colSpan: number; hidden: boolean }>();
    merges.forEach((m) => {
      for (let r = m.r1; r <= m.r2; r++) {
        for (let c = m.c1; c <= m.c2; c++) {
          const key = `${r}:${c}`;
          if (r === m.r1 && c === m.c1) {
            mergeInfo.set(key, {
              rowSpan: m.r2 - m.r1 + 1,
              colSpan: m.c2 - m.c1 + 1,
              hidden: false,
            });
          } else {
            mergeInfo.set(key, { rowSpan: 0, colSpan: 0, hidden: true });
          }
        }
      }
    });

    const rowTemplate = rowHeightsPx.map((h) => `${h || 0}px`).join(' ');

    const entries = Object.entries(cells)
      .map(([key, meta]) => {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        return { key, r, c, meta };
      })
      .sort((a, b) => (a.r === b.r ? a.c - b.c : a.r - b.r));

    const totalHeight = rowHeightsPx.reduce((acc, h) => acc + (h || 0), 0);

    return (
      <div key={page.pageNumber} className="invoice-page" style={{ pageBreakAfter: 'always', marginBottom: '40px' }}>
        <div className="scheme-wrapper" style={{
          transformOrigin: 'top left',
          transform: `scale(${scaleUniform})`,
          width: `${rawWidth * scaleUniform}px`,
          height: `${totalHeight * scaleUniform}px`,
          position: 'relative',
          overflow: 'visible',
        }}>
          <div className="scheme-grid" style={{
            display: 'grid',
            gridTemplateColumns: colTemplate,
            gridTemplateRows: rowTemplate,
            width: `${rawWidth}px`,
            position: 'relative',
            overflow: 'visible',
          }}>
            {entries.map(({ key, r, c, meta }) => {
              const merge = mergeInfo.get(key);
              if (merge?.hidden) return null;

              const rowSpan = merge?.rowSpan || 1;
              const colSpan = merge?.colSpan || 1;

              const rawValue =
                typeof meta.value === 'string' ||
                typeof meta.value === 'number' ||
                typeof meta.value === 'boolean'
                  ? String(meta.value)
                  : '';

              let displayValue = rawValue ? replaceTokens(rawValue, bindings) : '';

              // Handle FPS QR Code placeholder
              if (displayValue.includes('<FPS QR Code>') || displayValue.includes('<FPSQRCode>')) {
                return (
                  <div key={key} style={{
                    gridRow: r,
                    gridColumn: c,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {fpsQrUrl && <img src={fpsQrUrl} alt="FPS QR Code" style={{ width: '100%', height: 'auto', maxWidth: '220px' }} />}
                  </div>
                );
              }

              // Map font families
              const rawFam = (meta.fontFamily || '').replace(/["']/g, '');
              const fam = rawFam.toLowerCase();
              let fontFamily = 'Roboto Mono, monospace';
              if (fam.includes('rampart')) fontFamily = '"Rampart One", cursive';
              else if (fam.includes('fascinate')) fontFamily = '"Fascinate", cursive';
              else if (fam.includes('roboto')) fontFamily = '"Roboto Mono", monospace';
              else if (fam.includes('karla')) fontFamily = '"Karla", sans-serif';
              else if (fam.includes('cormorant')) fontFamily = '"Cormorant Infant", serif';
              else if (fam.includes('garamond')) fontFamily = '"EB Garamond", serif';
              else if (fam.includes('yuji')) fontFamily = '"Yuji Mai", serif';

              const textAlign = meta.hAlign === 'CENTER' ? 'center' : meta.hAlign === 'RIGHT' ? 'right' : 'left';
              const fontWeight = meta.bold ? '700' : '400';
              const fontStyle = meta.italic ? 'italic' : 'normal';
              const baseSize = meta.fontSize ? Number(meta.fontSize) : 10;
              const fontSize = `${baseSize + 2}px`;

              return (
                <div
                  key={key}
                  style={{
                    gridRow: `${r} / span ${rowSpan}`,
                    gridColumn: `${c} / span ${colSpan}`,
                    fontFamily,
                    fontSize,
                    fontWeight,
                    fontStyle,
                    textAlign,
                    display: 'flex',
                    alignItems: meta.vAlign === 'MIDDLE' ? 'center' : meta.vAlign === 'BOTTOM' ? 'flex-end' : 'flex-start',
                    padding: '2px 4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                  }}
                >
                  {displayValue}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="dynamic-invoice-container">
      <style jsx>{`
        .dynamic-invoice-container {
          font-family: 'Roboto Mono', monospace;
        }
        .invoice-page:last-child {
          page-break-after: auto;
        }
      `}</style>

      <div className="invoice-metadata" style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
        <strong>Dynamic Pagination System</strong>
        <div>Total Pages: {composedLayout.totalPages}</div>
        <div>Layout Mode: {composedLayout.metadata.layoutMode}</div>
        <div>Item Count: {composedLayout.metadata.itemCount}</div>
      </div>

      {composedLayout.pages.map(page => renderPage(page))}
    </div>
  );
};

export default DynamicInvoice;
