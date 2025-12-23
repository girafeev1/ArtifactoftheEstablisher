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
import { representativeNameOnly, representativeToDisplay } from '../../lib/representative';

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

  // Representative handling
  const representative = invoice.representative ?? null;

  // Build bindings map for token replacement
  const bindings: Record<string, string | number> = {
    ClientCompanyName: invoice.companyName || '',
    ClientAddressLine1: invoice.addressLine1 || '',
    ClientAddressLine2: invoice.addressLine2 || '',
    ClientAddressLine3: invoice.addressLine3 || '',
    ClientRegion: invoice.region || '',
    // Representative fields - handle both object and string formats
    ClientRepresentativeTitle: representative?.title ?? '',
    ClientRepresentativeFirstName: representative?.firstName ?? '',
    ClientRepresentativeLastName: representative?.lastName ?? '',
    ClientRepresentativeName: representativeNameOnly(representative) ?? '',
    ClientRepresentativeDisplay: representativeToDisplay(representative) ?? '',
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

    // A4 page dimensions at 96dpi with Google Sheets margins (0.2" top/bottom, 0.3" left/right)
    // A4: 794px × 1123px
    // Usable width: 794 - (2 × 28.8) = 736.4px
    // Usable height: 1123 - (2 × 19.2) = 1084.6px
    const A4_USABLE_WIDTH_PX = 736;
    const A4_USABLE_HEIGHT_PX = 1085;

    // Calculate raw dimensions from template
    const rawWidth = columnWidthsPx.reduce((acc, w) => acc + (w || 0), 0) || 1;
    const rawHeight = rowHeightsPx.reduce((acc, h) => acc + (h || 0), 0) || 1;

    // We need to scale content to fit A4 width
    // Calculate scale factor for width - this is the primary constraint
    const scaleForWidth = A4_USABLE_WIDTH_PX / rawWidth;

    // Calculate what height would be at this width scale
    const heightAtWidthScale = rawHeight * scaleForWidth;

    // Determine if this page is "oversized" (height exceeds A4 at width scale)
    // For oversized pages, we use width-only scaling and rely on CSS page breaks
    // For normal pages, we use uniform scaling to fit both dimensions
    const isOversizedPage = heightAtWidthScale > A4_USABLE_HEIGHT_PX * 1.1; // 10% tolerance

    // For normal pages that fit A4, use uniform scaling
    // For oversized pages (e.g., 28 session notes), use width-only scaling
    // so the page renders at full width instead of shrinking horizontally
    let scaleToFitA4: number;
    if (isOversizedPage) {
      // Oversized page: use width scaling only
      // This keeps the invoice at full A4 width even if content is tall
      // CSS print styles will handle page breaks for the overflow
      scaleToFitA4 = scaleForWidth;
    } else {
      // Normal page: use the smaller scale to fit both dimensions
      const scaleForHeight = A4_USABLE_HEIGHT_PX / rawHeight;
      scaleToFitA4 = Math.min(scaleForWidth, scaleForHeight);
    }

    // For screen display, we render at a larger size for better quality
    // Target 1100px wide for good visual quality
    const TARGET_CONTENT_WIDTH_PX = 1100;
    const scaleForScreen = TARGET_CONTENT_WIDTH_PX / rawWidth;

    // Use the smaller of screen scale and fit-to-A4 scale
    // This ensures content always fits on one A4 page when printed
    const scaleUniform = Math.min(scaleForScreen, scaleToFitA4);

    // Actual rendered dimensions
    const renderedWidth = rawWidth * scaleUniform;
    const renderedHeight = rawHeight * scaleUniform;

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

    // Page dimensions are already calculated above as renderedWidth and renderedHeight

    return (
      <div
        key={page.pageNumber}
        className="invoice-page"
        style={{
          // Set to RENDERED dimensions (after scaling) - this is what fits on A4
          width: `${renderedWidth}px`,
          height: `${renderedHeight}px`,
          position: 'relative',
          // DO NOT use overflow:hidden here - it clips content before transform is applied
          // Print CSS handles overflow clipping appropriately
          overflow: 'visible',
          // Screen margin for visual separation (overridden in print CSS)
          marginBottom: '40px',
        }}
      >
        {/* Clip wrapper - clips the TRANSFORMED content, not the raw layout */}
        <div style={{
          width: `${renderedWidth}px`,
          height: `${renderedHeight}px`,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
          <div className="scheme-wrapper" style={{
            // Transform scales the RAW content down to fit the rendered dimensions
            transformOrigin: 'top left',
            transform: `scale(${scaleUniform})`,
            // Wrapper must be RAW dimensions so grid fits without clipping BEFORE transform
            width: `${rawWidth}px`,
            height: `${rawHeight}px`,
            position: 'relative',
          }}>
          <div className="scheme-grid" style={{
            display: 'grid',
            gridTemplateColumns: colTemplate,
            gridTemplateRows: rowTemplate,
            width: `${rawWidth}px`,
            position: 'relative',
            boxSizing: 'content-box',
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
              if (rawValue.includes('<FPS QR Code>') || rawValue.includes('<FPSQRCode>')) {
                return (
                  <div key={key} style={{
                    gridRow: `${r} / span ${rowSpan}`,
                    gridColumn: `${c} / span ${colSpan}`,
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
              else if (fam.includes('google') && fam.includes('mono')) fontFamily = '"Roboto Mono", monospace';
              else if (fam.includes('roboto')) fontFamily = '"Roboto Mono", monospace';
              else if (fam.includes('karla')) fontFamily = '"Karla", sans-serif';
              else if (fam.includes('cormorant')) fontFamily = '"Cormorant Infant", serif';
              else if (fam.includes('garamond')) fontFamily = '"EB Garamond", serif';
              else if (fam.includes('iansui')) fontFamily = '"Iansui", sans-serif';
              else if (fam.includes('yuji')) fontFamily = '"Yuji Mai", serif';
              else if (fam.includes('federo')) fontFamily = '"Federo", sans-serif';
              else if (fam.includes('chocolate') || fam.includes('classical')) fontFamily = '"Chocolate Classical Sans", sans-serif';
              else if (fam.includes('nanum') || fam.includes('pen script')) fontFamily = '"Nanum Pen Script", cursive';
              else if (fam.includes('covered') || fam.includes('your grace')) fontFamily = '"Covered By Your Grace", cursive';
              else if (fam.includes('yomogi')) fontFamily = '"Yomogi", cursive';
              else if (fam.includes('ephesis')) fontFamily = '"Ephesis", cursive';
              else if (fam.includes('bungee')) fontFamily = '"Bungee Shade", cursive';
              else if (fam.includes('arial')) fontFamily = 'Arial, sans-serif';

              const textAlign = meta.hAlign === 'CENTER' ? 'center' : meta.hAlign === 'RIGHT' ? 'right' : 'left';
              const fontWeight = meta.bold ? '700' : '400';
              const fontStyle = meta.italic ? 'italic' : 'normal';
              // Preserve undefined for font size to allow inheritance from parent
              const baseSize = meta.fontSize ? Number(meta.fontSize) : undefined;
              const fontSize = baseSize !== undefined ? `${baseSize + 2}px` : undefined;

              // Dynamic padding like GeneratedInvoice
              const padX = textAlign === 'center' ? 2 : 4;
              const padY = meta.vAlign === 'MIDDLE' ? 2 : 4;

              // Border rendering helper
              const scaleBorder = (side?: any) => {
                if (!side) return 'none';
                const style = side.style || '';
                const width = style === 'SOLID_MEDIUM' ? '1.5px' : '1px';
                let colorCss = 'rgba(0,0,0,0.75)';
                const rgb = side.color?.rgbColor || side.color;
                if (rgb && (typeof rgb.red === 'number' || typeof rgb.green === 'number' || typeof rgb.blue === 'number')) {
                  const r = Math.round((rgb.red ?? 0) * 255);
                  const g = Math.round((rgb.green ?? 0) * 255);
                  const b = Math.round((rgb.blue ?? 0) * 255);
                  colorCss = `rgb(${r}, ${g}, ${b})`;
                }
                let cssStyle: React.CSSProperties['borderStyle'] = 'solid';
                if (style === 'DOTTED') cssStyle = 'dotted';
                else if (style === 'DASHED') cssStyle = 'dashed';
                else if (style === 'DOUBLE') cssStyle = 'double';
                return `${width} ${cssStyle} ${colorCss}`;
              };

              const border = (meta as any).border || {};
              const borderTop = border.top ? scaleBorder(border.top) : 'none';
              const borderBottom = border.bottom ? scaleBorder(border.bottom) : 'none';
              const borderLeft = border.left ? scaleBorder(border.left) : 'none';
              const borderRight = border.right ? scaleBorder(border.right) : 'none';

              // Foreground color from the sheet
              let fgColor: React.CSSProperties['color'] = undefined;
              const fg = meta.fgColor || (meta as any).textColor;
              if (fg && (typeof fg.red === 'number' || typeof fg.green === 'number' || typeof fg.blue === 'number')) {
                const rVal = Math.round((fg.red ?? 0) * 255);
                const gVal = Math.round((fg.green ?? 0) * 255);
                const bVal = Math.round((fg.blue ?? 0) * 255);
                fgColor = `rgb(${rVal}, ${gVal}, ${bVal})`;
              }

              // Background color
              let bgColor: React.CSSProperties['backgroundColor'] = undefined;
              if (meta.bgColor && (meta.bgColor.red !== 1 || meta.bgColor.green !== 1 || meta.bgColor.blue !== 1)) {
                const rVal = Math.round((meta.bgColor.red ?? 0) * 255);
                const gVal = Math.round((meta.bgColor.green ?? 0) * 255);
                const bVal = Math.round((meta.bgColor.blue ?? 0) * 255);
                bgColor = `rgb(${rVal}, ${gVal}, ${bVal})`;
              }

              // Determine cell content - handle special cases
              let content: React.ReactNode = displayValue;
              const rawTrimmed = rawValue.trim();
              let handled = false;

              // ProjectTitle: Latin in Karla, CJK in Yuji Mai (like GeneratedInvoice)
              if (!handled && rawTrimmed === '<ProjectTitle>' && displayValue) {
                const segments = displayValue
                  .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                  .filter(Boolean);
                content = (
                  <span>
                    {segments.map((seg: string, idx: number) => {
                      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
                      const fam = hasCJK ? '"Yuji Mai", serif' : '"Karla", sans-serif';
                      return (
                        <span key={idx} style={{ fontFamily: fam, fontWeight, fontStyle, fontSize }}>
                          {seg}
                        </span>
                      );
                    })}
                  </span>
                );
                handled = true;
              }

              // PresenterWorkType: Latin in Google Sans Mono bold, CJK in Iansui bold (like GeneratedInvoice)
              if (!handled && rawTrimmed === '<PresenterWorkType>' && displayValue) {
                const segments = displayValue
                  .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                  .filter(Boolean);
                content = (
                  <span>
                    {segments.map((seg: string, idx: number) => {
                      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
                      const fam = hasCJK ? '"Iansui", sans-serif' : '"Google Sans Mono", monospace';
                      return (
                        <span key={idx} style={{ fontFamily: fam, fontWeight: 700, fontSize }}>
                          {seg}
                        </span>
                      );
                    })}
                  </span>
                );
                handled = true;
              }

              // SubsidiaryChineseName: English in Cormorant Infant, Chinese in Iansui with spacify
              // This handles cells containing both <SubsidiaryEnglishName> and <SubsidiaryChineseName>
              const isSubsidiaryNameCell = !handled &&
                rawTrimmed.includes('<SubsidiaryEnglishName>') &&
                rawTrimmed.includes('<SubsidiaryChineseName>');
              if (isSubsidiaryNameCell && displayValue) {
                // Split the display value by lines
                const lines = displayValue.replace(/\r\n/g, '\n').split('\n');
                content = (
                  <span>
                    {lines.map((line: string, lineIdx: number) => {
                      // Detect if line has CJK characters (Chinese name) vs Latin (English name)
                      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(line);
                      if (hasCJK) {
                        // Chinese line: use Iansui, apply spacify
                        const spacedLine = spacify(line);
                        return (
                          <React.Fragment key={lineIdx}>
                            <span style={{ fontFamily: '"Iansui", sans-serif', fontWeight: 700, fontSize }}>
                              {spacedLine}
                            </span>
                            {lineIdx < lines.length - 1 ? <br /> : null}
                          </React.Fragment>
                        );
                      } else {
                        // English line: use Cormorant Infant
                        return (
                          <React.Fragment key={lineIdx}>
                            <span style={{ fontFamily: '"Cormorant Infant", serif', fontWeight: 700, fontSize }}>
                              {line}
                            </span>
                            {lineIdx < lines.length - 1 ? <br /> : null}
                          </React.Fragment>
                        );
                      }
                    })}
                  </span>
                );
                handled = true;
              }

              // Special handling for combined "<ItemNTitle> x<ItemNSubQuantity>" cells
              // Pattern matches: <Item1Title> x<Item1SubQuantity>, <Item2Title> x<Item2SubQuantity>, etc.
              const titleSubQtyMatch = !handled && rawTrimmed.match(/<Item(\d+)Title>\s*x<Item\1SubQuantity>/);
              if (titleSubQtyMatch) {
                const itemNum = titleSubQtyMatch[1];
                const titleText = String(bindings[`Item${itemNum}Title`] ?? '');
                const subVal = bindings[`Item${itemNum}SubQuantity`] ?? '';

                // Calculate font shrink factor for long titles
                // Max comfortable length before shrinking
                const MAX_COMFORTABLE_LENGTH = 50;
                const shrinkFactor = titleText.length > MAX_COMFORTABLE_LENGTH
                  ? Math.max(0.6, MAX_COMFORTABLE_LENGTH / titleText.length)
                  : 1;

                // Apply shrink factor to base size (default to 10 if undefined for calculation)
                const effectiveBaseSize = baseSize ?? 10;
                const adjustedTitleSize = Math.round(effectiveBaseSize * shrinkFactor);
                const titleFontSize = `${adjustedTitleSize + 2}px`;
                const subSize = Math.max(1, effectiveBaseSize - 4);

                content = (
                  <span>
                    <span style={{
                      fontFamily,
                      fontWeight,
                      fontStyle,
                      fontSize: titleFontSize,
                      whiteSpace: 'nowrap',
                    }}>
                      {titleText}
                    </span>
                    {subVal !== undefined && subVal !== null && String(subVal).trim() && (
                      <span style={{ marginLeft: 2, fontSize: `${subSize}px`, fontWeight: 400 }}>
                        {`x${subVal}`}
                      </span>
                    )}
                  </span>
                );
                handled = true;
              }

              // Special handling for item notes: <Item1Notes>, <Item2Notes>, etc.
              // Render multi-line notes with CJK/Latin font handling like GeneratedInvoice
              // CJK uses Chocolate Classical Sans, Latin uses Roboto Mono
              const notesMatch = !handled && rawTrimmed.match(/^<Item(\d+)Notes>$/);
              let isNotesCell = false;
              if (notesMatch && displayValue) {
                isNotesCell = true;
                const lines = displayValue.replace(/\r\n/g, '\n').split('\n');
                content = (
                  <span style={{ lineHeight: 1.3}}>
                    {lines.map((line: string, lineIdx: number) => {
                      // Split line into CJK and Latin segments for proper font handling
                      const segments = line
                        .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                        .filter(Boolean);
                      return (
                        <React.Fragment key={lineIdx}>
                          {segments.map((seg: string, idx: number) => {
                            const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
                            // Use Chocolate Classical Sans for CJK (matching GeneratedInvoice)
                            const fam = hasCJK
                              ? '"Chocolate Classical Sans", sans-serif'
                              : '"Roboto Mono", monospace';
                            return (
                              <span key={idx} style={{ fontFamily: fam, fontSize: '10px' }}>
                                {seg}
                              </span>
                            );
                          })}
                          {lineIdx < lines.length - 1 ? <br /> : null}
                        </React.Fragment>
                      );
                    })}
                  </span>
                );
                handled = true;
              }

              // Wrapping strategy from sheet metadata (like GeneratedInvoice)
              const wrapStrategy = meta.wrapStrategy || '';
              const shouldWrap =
                !wrapStrategy ||
                wrapStrategy === 'WRAP' ||
                wrapStrategy === 'WRAP_STRATEGY_UNSPECIFIED';

              // Calculate line height based on content type
              // Different line heights for:
              // 1. Explicit line breaks (\n) - tighter spacing (1.0) like header/footer addresses
              // 2. Auto-wrap text - slightly more spacing (1.2) for readability
              // 3. Notes cells - moderate spacing (1.3) for long session lists
              // 4. Single-line cells - tightest (0.9) to match Google Sheets
              const hasExplicitLineBreaks = displayValue.includes('\n') || rawValue.includes('\\n');
              const isMultiLineCell = hasExplicitLineBreaks || shouldWrap;

              let lineHeight: number;
              if (isNotesCell) {
                // Item notes (session dates, etc.) - need moderate spacing for readability
                lineHeight = 1.0;
              } else if (hasExplicitLineBreaks) {
                // Cells with explicit line breaks (footer address, header info) - tight
                lineHeight = 0.6;
              } else if (shouldWrap) {
                // Auto-wrap cells - slightly more spacing
                lineHeight = 1.15;
              } else {
                // Single-line cells - tightest
                lineHeight = 1.0;
              }

              // Notes cells should never overflow - they should expand to fit content
              // Other overflow cells can overflow if needed
              const isOverflowCell = !shouldWrap || wrapStrategy === 'OVERFLOW_CELL';

              let whiteSpace: React.CSSProperties['whiteSpace'] = shouldWrap || isNotesCell ? 'pre-wrap' : 'pre';
              let overflowWrap: React.CSSProperties['overflowWrap'] = shouldWrap || isNotesCell ? 'break-word' : 'normal';
              let wordBreak: React.CSSProperties['wordBreak'] = shouldWrap || isNotesCell ? 'break-word' : 'normal';
              // Notes cells: use undefined to let CSS media queries control overflow
              // This allows print styles to enable overflow for page breaking
              // Screen styles will set overflow: hidden via the notes-cell class
              let cellOverflow: React.CSSProperties['overflow'] = isNotesCell ? undefined : (isOverflowCell ? 'visible' : 'hidden');

              return (
                <div
                  key={key}
                  className={isNotesCell ? 'notes-cell' : undefined}
                  style={{
                    gridRow: `${r} / span ${rowSpan}`,
                    gridColumn: `${c} / span ${colSpan}`,
                    fontFamily,
                    fontSize,
                    fontWeight,
                    fontStyle,
                    textAlign,
                    color: fgColor,
                    backgroundColor: bgColor,
                    borderTop,
                    borderBottom,
                    borderLeft,
                    borderRight,
                    padding: `${padY}px ${padX}px`,
                    overflow: cellOverflow,
                    lineHeight,
                    // Match GeneratedInvoice flex styling for vertical alignment
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent:
                      meta.vAlign === 'MIDDLE'
                        ? 'center'
                        : meta.vAlign === 'BOTTOM'
                        ? 'flex-end'
                        : 'flex-start',
                    height: '100%',
                    whiteSpace,
                    overflowWrap,
                    wordBreak,
                  }}
                >
                  {content}
                </div>
              );
            })}
          </div>
          {/* Grid lines overlay - inside scheme-wrapper so it scales with the grid */}
          {showGridOverlay && (() => {
            // Calculate row offsets from row heights
            const rowOffsets: number[] = [];
            let accY = 0;
            rowHeightsPx.forEach((h) => {
              rowOffsets.push(accY);
              accY += h || 0;
            });

            // Column offsets
            const colOffsets: number[] = [];
            let accX = 0;
            columnWidthsPx.forEach((w) => {
              colOffsets.push(accX);
              accX += w || 0;
            });

            return (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${rawWidth}px`,
                  height: `${rawHeight}px`,
                  pointerEvents: 'none',
                }}
              >
                {/* Horizontal lines */}
                {rowHeightsPx.map((_, idx) => (
                  <div
                    key={`h-${idx}`}
                    style={{
                      position: 'absolute',
                      top: rowOffsets[idx],
                      left: 0,
                      width: '100%',
                      height: '1px',
                      borderTop: '1px dashed rgba(255, 0, 0, 0.25)',
                    }}
                  />
                ))}
                {/* Vertical lines */}
                {columnWidthsPx.map((_, idx) => (
                  <div
                    key={`v-${idx}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: colOffsets[idx],
                      width: '1px',
                      height: '100%',
                      borderLeft: '1px dashed rgba(255, 0, 0, 0.25)',
                    }}
                  />
                ))}
              </div>
            );
          })()}
        </div>
        </div>{/* Close clip wrapper */}
        {/* Grid labels - outside clip wrapper to avoid being clipped */}
        {showGridOverlay && !suppressGridLabels && (() => {
          // Calculate scaled row offsets
          const rowOffsets: number[] = [];
          let accY = 0;
          rowHeightsPx.forEach((h) => {
            rowOffsets.push(accY * scaleUniform);
            accY += h || 0;
          });
          const scaledRowHeights = rowHeightsPx.map(h => h * scaleUniform);

          // Calculate scaled column offsets
          const colOffsets: number[] = [];
          let accX = 0;
          columnWidthsPx.forEach((w) => {
            colOffsets.push(accX * scaleUniform);
            accX += w || 0;
          });
          const scaledColWidths = columnWidthsPx.map(w => w * scaleUniform);

          return (
            <>
              {/* Row labels on the left */}
              <div
                className="grid-row-labels"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: -28,
                  width: '26px',
                  height: `${renderedHeight}px`,
                  pointerEvents: 'none',
                }}
              >
                {scaledRowHeights.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      top: rowOffsets[idx],
                      height: h,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: 700,
                      color: 'rgba(255, 0, 0, 0.8)',
                      fontFamily: '"Roboto Mono", monospace',
                      borderTop: '1px dashed rgba(255, 0, 0, 0.4)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
              {/* Column labels at top */}
              <div
                className="grid-col-labels"
                style={{
                  position: 'absolute',
                  top: -18,
                  left: 0,
                  width: `${renderedWidth}px`,
                  height: '16px',
                  pointerEvents: 'none',
                  display: 'flex',
                }}
              >
                {scaledColWidths.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: `${w}px`,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      fontWeight: 700,
                      color: 'rgba(255, 0, 0, 0.8)',
                      fontFamily: '"Roboto Mono", monospace',
                      borderLeft: '1px dashed rgba(255, 0, 0, 0.4)',
                      boxSizing: 'border-box',
                    }}
                  >
                    {String.fromCharCode(65 + idx)}
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="dynamic-invoice-container">
      <style jsx>{`
        .dynamic-invoice-container {
          font-family: 'Roboto Mono', monospace;
          color: #000;
          background-color: #fff;
          padding: 16px 0;
          width: 100%;
        }
        .invoice-page {
          /* Screen: allow natural sizing */
          box-sizing: border-box;
        }
        .scheme-grid {
          font-size: 8px;
          line-height: 1.0;
        }
        /* Print-specific styles - CRITICAL for proper page breaks */
        @media print {
          .dynamic-invoice-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          .invoice-page {
            /* CRITICAL: Treat each page as an indivisible unit */
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            /* Force page break after each page */
            page-break-after: always !important;
            break-after: page !important;
            /* Reset margins for print */
            margin: 0 !important;
            padding: 0 !important;
            /* Use inline dimensions (set by JS to fit A4) */
            /* Do not override width/height - let JS control */
            /* Clip any overflow (content should be scaled to fit) */
            overflow: hidden !important;
            /* Position at top of print page */
            position: relative !important;
          }
          .invoice-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .scheme-wrapper {
            /* Keep scale transform, clip overflow */
            overflow: hidden !important;
          }
          .scheme-grid {
            overflow: hidden !important;
          }
          .notes-cell {
            overflow: hidden !important;
          }
          /* Hide grid overlay labels during print */
          .grid-row-labels,
          .grid-col-labels {
            display: none !important;
          }
        }
        /* Screen display: constrain overflow for clean preview */
        @media screen {
          .invoice-page {
            overflow: hidden;
            /* Visual separation between pages on screen */
            margin-bottom: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .scheme-wrapper {
            overflow: hidden;
          }
          .notes-cell {
            overflow: hidden;
          }
        }
      `}</style>

      {composedLayout.pages.map(page => renderPage(page))}
    </div>
  );
};

export default DynamicInvoice;
