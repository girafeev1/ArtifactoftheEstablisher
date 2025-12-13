import React from 'react';
import type { ProjectInvoiceRecord } from '../../lib/projectInvoices';
import type { ClassicInvoiceScheme } from '../../lib/pdfTemplates/classicInvoiceScheme';
import type { ProjectRecord } from '../../lib/projectsDatabase';
import type { SubsidiaryDoc } from '../../lib/subsidiaries';
import { num2eng, num2chi } from '../../lib/invoiceFormat';
import { buildHKFPSPayload, buildHKFPSQrUrl } from '../../lib/fpsPayload';
import { representativeNameOnly } from '../../lib/representative';

type GeneratedInvoiceProps = {
  invoice: ProjectInvoiceRecord;
  // Optional classic instruction scheme; this will allow us to
  // progressively drive the HTML from the same grid-based metadata
  // that previously powered the PDF renderers.
  scheme?: ClassicInvoiceScheme;
  project?: ProjectRecord | null;
  subsidiary?: SubsidiaryDoc | null;
  showGridOverlay?: boolean;
  bankInfo?: any | null;
  // When true, do not render row/column labels even if the Grid toggle
  // is enabled. This lets the print/PDF path omit debug labels while
  // still showing them in the interactive preview.
  suppressGridLabels?: boolean;
};

const GeneratedInvoice: React.FC<GeneratedInvoiceProps> = ({
  invoice,
  scheme,
  project,
  subsidiary,
  showGridOverlay,
  bankInfo,
  suppressGridLabels,
}) => {
  const subtotal = invoice.items.reduce((acc, item) => acc + ((item.unitPrice || 0) * (item.quantity || 0)), 0);
  const total = subtotal - invoice.items.reduce((acc, item) => acc + (item.discount || 0), 0);
  const effectiveTotal =
    typeof invoice.total === 'number' && !Number.isNaN(invoice.total)
      ? invoice.total
      : total;

  // Build a simple bindings map so we can render the scheme grid
  // with real values instead of raw <FieldName> tokens. This is a
  // subset of the bindings used in the old PDF renderers and only
  // covers fields we can derive from the invoice alone.
  const firstItem: any = (invoice.items && invoice.items[0]) || {};
  const lineTotalNumber =
    Math.max(
      0,
      (firstItem.unitPrice || 0) * (firstItem.quantity || 0) - (firstItem.discount || 0),
    );

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

  // Bank details (resolved from paidTo identifier when available)
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
  const representative = invoice.representative ?? null
  const bindings: Record<string, string | number> = {
    // Client
    ClientCompanyName: invoice.companyName || '',
    ClientAddressLine1: invoice.addressLine1 || '',
    ClientAddressLine2: invoice.addressLine2 || '',
    ClientAddressLine3: invoice.addressLine3 || '',
    ClientRegion: invoice.region || '',
    ClientRepresentativeTitle: representative?.title ?? '',
    ClientRepresentativeFirstName: representative?.firstName ?? '',
    ClientRepresentativeLastName: representative?.lastName ?? '',
    // Backwards-compatible token for older schemes; prefer FirstName/LastName tokens.
    ClientRepresentativeName: representativeNameOnly(representative) ?? '',
    // Project meta
    PresenterWorkType: project?.presenterWorkType ?? '',
    ProjectTitle: project?.projectTitle ?? '',
    ProjectNature: project?.projectNature ?? '',
    // Invoice meta
    InvoiceNumber: invoice.invoiceNumber || '',
    InvoiceDate: invoiceDate,
    // Subsidiary (from SubsidiaryDoc)
    SubsidiaryEnglishName: subsidiary?.englishName ?? '',
    SubsidiaryChineseName: subsidiary?.chineseName ?? '',
    SubsidiaryAddressLine1: subsidiary?.addressLine1 ?? '',
    SubsidiaryAddressLine2: subsidiary?.addressLine2 ?? '',
    SubsidiaryAddressLine3: subsidiary?.addressLine3 ?? '',
    SubsidiaryRegion: subsidiary?.region ?? '',
    SubsidiaryEmail: subsidiary?.email ?? '',
    SubsidiaryPhone: subsidiary?.phone ?? '',
    // Items (first item only for page 1)
    ItemTitle: firstItem.title || '',
    ItemFeeType: firstItem.feeType || '',
    ItemNotes: firstItem.notes || '',
    ItemUnitPrice: firstItem.unitPrice ?? 0,
    ItemQuantity: firstItem.quantity ?? 0,
    // Prefix the quantity unit with a slash so "/hour" etc. matches the
    // Instruction sheet rendering.
    ItemQuantityUnit: firstItem.quantityUnit ? `/${firstItem.quantityUnit}` : '',
    // Keep sub-quantity numeric; we'll add the "x" prefix during render and
    // ensure it uses regular weight per the design.
    ItemSubQuantity: firstItem.subQuantity ?? '',
    ItemLineTotal: `$${lineTotalNumber.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    // Totals
    InvoiceTotalNumeric: `$${effectiveTotal.toLocaleString('en-HK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    InvoiceTotalEnglish: num2eng(effectiveTotal),
    InvoiceTotalChinese: num2chi(effectiveTotal),
    // Bank / FPS (English labels handled in sheet)
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

  // In development, log a concise snapshot of the bindings that are most
  // relevant to the Instruction-based layout so we can see exactly what
  // data is flowing from Firestore/API into the HTML/Chromium pipeline.
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('[GeneratedInvoice][bindings]', {
      invoiceNumber: bindings.InvoiceNumber,
      clientCompanyName: bindings.ClientCompanyName,
      clientRegion: bindings.ClientRegion,
      subsidiaryEnglishName: bindings.SubsidiaryEnglishName,
      subsidiaryChineseName: bindings.SubsidiaryChineseName,
      subsidiaryAddress: [
        bindings.SubsidiaryAddressLine1,
        bindings.SubsidiaryAddressLine2,
        bindings.SubsidiaryAddressLine3,
        bindings.SubsidiaryRegion,
      ],
      subsidiaryEmail: bindings.SubsidiaryEmail,
      subsidiaryPhone: bindings.SubsidiaryPhone,
      invoiceDate: bindings.InvoiceDate,
      bankName: bindings.BankName,
      bankCode: bindings.BankCode,
      bankAccountNumberPart1: bindings.BankAccountNumberPart1,
      bankAccountNumberPart2: bindings.BankAccountNumberPart2,
    });
  }

  // Build a simple FPS QR payload and URL using the same encoding as the
  // previous PDF renderers. For now we only fixate the payee and leave the
  // amount open; once the layout is fully stable we can consider encoding
  // the invoice total as a fixed amount.
  const fpsPayload = buildHKFPSPayload(
    fpsProxy,
    false, // includeAmount
    null,
    invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : null,
  );
  const fpsQrUrl = buildHKFPSQrUrl(fpsPayload, 220);

  const spacify = (input: string) => {
    if (!input) return '';
    return String(input)
      .split('\n')
      .map((line) => line.split('').join(' '))
      .join('\n');
  };
  // Spacify words: insert spaces between letters while keeping a single
  // space token between words so "Establish Records Limited" becomes
  // "E s t a b l i s h   R e c o r d s   L i m i t e d".
  const spacifyWords = (input: string) => {
    if (!input) return '';
    return String(input)
      .trim()
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part)) return ' ';
        return part.split('').join(' ');
      })
      .join(' ')
      .replace(/\s+/g, ' ');
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

    // 1) Replace tokens and honour *Spacified* markers.
    //    First handle tokens that are marked for spacing.
    result = result.replace(/<([^>]+)>\s*\*Spacified\*/gi, (_m, field) => getVal(field, true));
    result = result.replace(/\*Spacified\*\s*<([^>]+)>/gi, (_m, field) => getVal(field, true));
    //    Then the remaining tokens normally.
    result = result.replace(/<([^>]+)>/g, (_m, field) => getVal(field, false));
    // 2) Any leftover markers should disappear.
    result = result.replace(/\*Spacified\*/gi, '');
    // 3) Normalise line breaks.
    return result.replace(/\r\n/g, '\n').replace(/\\n/g, '\n');
  };

  // Simple scheme-driven debug grid for the Instruction sheet rows 1–202.
  // For now we render all rows in a single tall band; Chromium's A4 print
  // pagination will split this into multiple pages.
  const schemeGrid = (() => {
    if (!scheme) return null;
    const { columnWidthsPx, rowHeightsPx, cells, merges } = scheme;
    if (!Array.isArray(columnWidthsPx) || !Array.isArray(rowHeightsPx) || !cells) return null;

    const safeNum = (val: any, fallback = 0): number => {
      const n = Number(val);
      return isNaN(n) ? fallback : n;
    };

    const PAGE1_START = 1;
    const PAGE1_END = 202;

    // Column widths: use the raw px widths from the Instruction sheet so the
    // horizontal proportions match the original design as closely as
    // possible. The container will be centered by the surrounding layout.
    // Use the raw px widths from the Instruction sheet and a single global
    // scale factor to mimic Google Sheets "Fit to width" behaviour. The
    // scale is applied at the wrapper level so all content (text, borders,
    // grid tracks) shrinks uniformly to fit an A4 content width.
    // Target content width for fit-to-width. Apply a uniform scale to the
    // entire grid (X and Y) based on the raw sheet width, preserving the
    // proportions of both columns and rows.
    const TARGET_CONTENT_WIDTH_PX = 1100; // adjust as needed for overall fit
    const rawWidth = columnWidthsPx.reduce((acc, w) => acc + safeNum(w), 0) || 1;
    const scaleUniform = TARGET_CONTENT_WIDTH_PX / rawWidth;
    const colTemplate = columnWidthsPx.map((w) => `${safeNum(w)}px`).join(' ');

    const mergeInfo = new Map<string, { rowSpan: number; colSpan: number; hidden: boolean }>();
    (merges || []).forEach((m) => {
      // Clamp merges to the page‑1 band we actually render (rows 1–57).
      const r1 = m.r1;
      const r2 = Math.min(m.r2, PAGE1_END);
      const c1 = m.c1;
      const c2 = m.c2;
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const key = `${r}:${c}`;
          if (r === r1 && c === c1) {
            mergeInfo.set(key, {
              rowSpan: r2 - r1 + 1,
              colSpan: c2 - c1 + 1,
              hidden: false,
            });
          } else {
            mergeInfo.set(key, { rowSpan: 0, colSpan: 0, hidden: true });
          }
        }
      }
    });
    // Manual merge fix: J202:N202 is a footer band in the sheet but isn’t
    // present in some exported scheme snapshots. Ensure it’s merged so
    // content spans correctly.
    const manualMergeKey = '202:10';
    if (!mergeInfo.has(manualMergeKey)) {
      mergeInfo.set(manualMergeKey, { rowSpan: 1, colSpan: 5, hidden: false });
      for (let c = 11; c <= 14; c++) {
        mergeInfo.set(`202:${c}`, { rowSpan: 0, colSpan: 0, hidden: true });
      }
    }

    // Row heights: take the raw px heights from the Instruction sheet for
    // rows 1–57 and use them directly as CSS grid row sizes. This keeps the
    // vertical proportions consistent with the original design without
    // introducing any additional scaling that could distort line spacing.
    const pageRowHeights = rowHeightsPx.slice(PAGE1_START - 1, PAGE1_END).map((h) => safeNum(h));
    const rowTemplate = pageRowHeights.map((h) => `${h || 0}px`).join(' ');

    const rowOffsets: number[] = [];
    let accY = 0;
    pageRowHeights.forEach((h) => {
      rowOffsets.push(accY);
      accY += h || 0;
    });
    const totalHeight = accY;

    const colOffsets: number[] = [];
    let accX = 0;
    columnWidthsPx.forEach((w) => {
      colOffsets.push(accX);
      accX += safeNum(w);
    });

    const entries = Object.entries(cells)
      .map(([key, meta]) => {
        const [rStr, cStr] = key.split(':');
        const r = Number(rStr);
        const c = Number(cStr);
        return { key, r, c, meta };
      })
      .filter(({ r }) => r >= PAGE1_START && r <= PAGE1_END)
      .sort((a, b) => (a.r === b.r ? a.c - b.c : a.r - b.r));

    // In dev, log the raw geometry so we can compare against the Instruction
    // sheet PNG. We deliberately avoid applying a CSS transform scale here and
    // instead let the browser / print engine fit the content to A4 based on
    // its natural pixel dimensions.
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[GeneratedInvoice][grid-scale]', {
        totalWidthPx: rawWidth,
        pageRowHeights,
        columnWidthsPx,
      });
    }

    return (
      <div className="scheme-debug" style={{ overflow: 'visible' }}>
        <div
          className="scheme-wrapper"
          style={{
            transformOrigin: 'top left',
            transform: `scale(${scaleUniform})`,
            width: `${rawWidth * scaleUniform}px`,
            height: `${totalHeight * scaleUniform}px`,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <div
            className="scheme-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: colTemplate,
              gridTemplateRows: rowTemplate,
              width: `${rawWidth}px`,
              position: 'relative',
              overflow: 'visible',
            }}
          >
          {/* Page break markers at rows 57, 110, 151 to mirror the Instruction sheet pages */}
          {([57, 110, 151] as const)
            .filter((r) => r > PAGE1_START && r <= PAGE1_END)
            .map((r, idx) => {
              // Place the marker at the bottom of the target row rather than the top.
              const rowIdx = r - PAGE1_START;
              const y = (rowOffsets[rowIdx] ?? 0) + (pageRowHeights[rowIdx] ?? 0);
              return (
                <div
                  key={`page-marker-${idx}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${y}px`,
                    height: 0,
                    borderTop: '1px solid rgba(37,99,235,0.35)',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              );
            })}
          {entries.map(({ key, r, c, meta }) => {
            const merge = mergeInfo.get(key);
            if (merge?.hidden) return null;
            const rowIndex = r - PAGE1_START + 1;
            const colIndex = c;
            const rowSpan = merge?.rowSpan || 1;
            const colSpan = merge?.colSpan || 1;
            const rawValue =
              typeof meta.value === 'string' ||
              typeof meta.value === 'number' ||
              typeof meta.value === 'boolean'
                ? String(meta.value)
                : '';
            const isN1Cell =
              (r === 1 && c === 14) ||
              (r === 1 && c === 10) ||
              (r === 62 && c === 10) ||
              (r === 115 && c === 10) ||
              (r === 156 && c === 10);
            // For the combined subsidiary header cell (N1) we only want the
            // English name spacified. The Instruction sheet currently marks
            // both lines with *Spacified*, so we strip the marker from the
            // Chinese line before token replacement.
            let templateValue = rawValue;
            if (isN1Cell && typeof templateValue === 'string') {
              templateValue = templateValue.replace(
                /(<SubsidiaryChineseName[^>]*>)\s*\*Spacified\*/i,
                '$1',
              );
            }
            let displayValue = templateValue ? replaceTokens(templateValue, bindings) : '';

            // Map sheet font families to CSS font stacks that we load via Google Fonts.
            // Normalise incoming family names (Sheets may include quotes or
            // multiple fallbacks) so we can map them to the @font-face names
            // we load for preview/PDF.
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
            else if (fam.includes('chocolate') || fam.includes('classical')) {
              fontFamily = '"Chocolate Classical Sans", sans-serif';
            } else if (fam.includes('nanum pen')) {
              fontFamily = '"Nanum Pen Script", cursive';
            } else if (fam.includes('covered by your grace')) {
              fontFamily = '"Covered By Your Grace", cursive';
            } else if (fam.includes('yomogi')) {
              fontFamily = '"Yomogi", cursive';
            } else if (fam.includes('ephesis')) {
              fontFamily = '"Ephesis", cursive';
            } else if (fam.includes('bungee shade')) {
              fontFamily = '"Bungee Shade", cursive';
            } else if (fam.includes('arial')) {
              fontFamily = 'Arial, sans-serif';
            }

            const textAlign =
              meta.hAlign === 'CENTER'
                ? 'center'
                : meta.hAlign === 'RIGHT'
                ? 'right'
                : 'left';
            let fontWeight: React.CSSProperties['fontWeight'] = meta.bold ? '700' : '400';
            const fontStyle = meta.italic ? 'italic' : 'normal';
            // Use sheet font sizes but bump them by +2 to more closely match
            // the desired output sizing. If the sheet has no fontSize, leave
            // undefined to inherit.
            const baseSize = meta.fontSize ? safeNum(meta.fontSize, 10) : undefined;
            let fontSize = baseSize !== undefined ? `${baseSize + 2}px` : undefined;

            // Borders from the scheme: draw only where the sheet specifies
            // them so divider lines and boxes (e.g. items header, totals box)
            // line up with the original, and vary thickness, style and color
            // based on the Google Sheets border metadata.
            const border = meta.border || {};
            const scaleBorder = (side?: any) => {
              if (!side) return 'none';
              const style = side.style || '';
              // Thickness: SOLID_MEDIUM in the sheet becomes a thicker rule.
              const width = style === 'SOLID_MEDIUM' ? '1.5px' : '1px';
              // Border color: prefer the explicit side.color if present,
              // fall back to a neutral dark grey. Google Sheets encodes
              // colors as rgbColor floats (0–1); convert to CSS.
              let colorCss = 'rgba(0,0,0,0.75)';
              const rgb = side.color?.rgbColor || side.color;
              if (
                rgb &&
                (typeof rgb.red === 'number' ||
                  typeof rgb.green === 'number' ||
                  typeof rgb.blue === 'number')
              ) {
                const r = Math.round((rgb.red ?? 0) * 255);
                const g = Math.round((rgb.green ?? 0) * 255);
                const b = Math.round((rgb.blue ?? 0) * 255);
                colorCss = `rgb(${r}, ${g}, ${b})`;
              }
              // Style: approximate the Sheet styles with CSS equivalents.
              let cssStyle: React.CSSProperties['borderStyle'] = 'solid';
              if (style === 'DOTTED') cssStyle = 'dotted';
              else if (style === 'DASHED') cssStyle = 'dashed';
              else if (style === 'DOUBLE') cssStyle = 'double';
              // For SOLID / SOLID_MEDIUM we keep "solid" and rely on width.
              return `${width} ${cssStyle} ${colorCss}`;
            };
            const borderTop = border.top ? scaleBorder(border.top as any) : 'none';
            const borderBottom = border.bottom ? scaleBorder(border.bottom as any) : 'none';
            const borderLeft = border.left ? scaleBorder(border.left as any) : 'none';
            const borderRight = border.right ? scaleBorder(border.right as any) : 'none';

            // Foreground color from the sheet (text color).
            let fgColor: React.CSSProperties['color'] = undefined;
            const fg = meta.fgColor || (meta as any).textColor || (meta as any).foregroundColor;
            if (fg && (typeof fg.red === 'number' || typeof fg.green === 'number' || typeof fg.blue === 'number')) {
              const r = Math.round((fg.red ?? 0) * 255);
              const g = Math.round((fg.green ?? 0) * 255);
              const b = Math.round((fg.blue ?? 0) * 255);
              fgColor = `rgb(${r}, ${g}, ${b})`;
            }

            // Wrapping strategy: when the sheet indicates WRAP (or is
            // unspecified) we allow content to wrap within the cell width,
            // respecting explicit line breaks. Otherwise we keep the text on
            // a single line and clip the overflow. For page 4 (rows 152–202)
            // force OVERFLOW (no wrapping).
            const wrapStrategy = meta.wrapStrategy || '';
            const shouldWrap =
              !wrapStrategy ||
              wrapStrategy === 'WRAP' ||
              wrapStrategy === 'WRAP_STRATEGY_UNSPECIFIED';
            const isPage4 = r >= 152;
            const effectiveWrap = isPage4 ? false : shouldWrap;

            let whiteSpace: React.CSSProperties['whiteSpace'] = effectiveWrap ? 'pre-wrap' : 'pre';
            let overflowWrap: React.CSSProperties['overflowWrap'] = effectiveWrap ? 'break-word' : 'normal';
            let wordBreak: React.CSSProperties['wordBreak'] = effectiveWrap ? 'break-word' : 'normal';
            // For non-wrapping cells, allow the content to overflow so it is
            // not clipped when the text is wider than the column.
            const isOverflowCell = !effectiveWrap;
            let contentOverflow: React.CSSProperties['overflow'] | undefined = isOverflowCell ? 'visible' : undefined;

            // Hard overrides for specific fields where the Instruction sheet
            // uses mixed styling that the scheme doesn't fully capture.
            const rawTrimmed = rawValue.trim();
            let content: React.ReactNode = displayValue;

            // When the item quantity is 1 (or missing) we hide the per‑unit
            // breakdown (<ItemUnitPrice>, <ItemQuantityUnit>, x<ItemQuantity>)
            // so that single‑quantity invoices only show the line total. This
            // mirrors the behaviour of the Instruction sheet.
            const qtyNumber = Number(bindings.ItemQuantity ?? 0);
            const isUnitPriceCell =
              rawTrimmed === '<ItemUnitPrice>' ||
              rawTrimmed === '<ItemQuantityUnit>' ||
              rawTrimmed === '<ItemQuantity>' ||
              rawTrimmed === 'x<ItemQuantity>';
            if (isUnitPriceCell && !(qtyNumber > 1)) {
              content = '';
            }

            // FPS QR cell: render the QR image if we have a URL; otherwise
            // leave the cell empty.
            if (
              rawTrimmed === '<FPS QR Code>' ||
              rawTrimmed === '<FPSQRCode>'
            ) {
              content = fpsQrUrl ? (
                <img
                  src={fpsQrUrl}
                  alt="FPS QR"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : '';
              // Allow QR to overflow so it isn't clipped if the cell is tight.
              contentOverflow = 'visible';
            } else {
              // Coordinate‑specific override: N1 (row 1, col 14) is the
              // combined subsidiary English + Chinese name header. The
              // Instruction sheet uses Cormorant Infant for the English
              // line and Iansui bold for the Chinese line. The scheme only
              // stores a single font per cell, so we reconstruct the two
              // lines here from the fully token‑replaced value.
              let handled = false;
              if (isN1Cell && displayValue) {
                const lines = displayValue.split(/\r?\n/);
                let engLine = '';
                let chiLine = '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  // Heuristic: if the line contains any non‑ASCII chars,
                  // treat it as the Chinese line.
                  if (/[^\u0000-\u00ff]/.test(trimmed)) {
                    chiLine = trimmed;
                  } else {
                    engLine = trimmed;
                  }
                }
                content = (
                  <>
                    {engLine && (
                      <span
                        style={{
                          fontFamily: '"Cormorant Infant", serif',
                          fontWeight: 700,
                          whiteSpace: 'pre',
                          wordBreak: 'normal',
                          overflowWrap: 'normal',
                          display: 'block',
                          textAlign: 'right',
                        }}
                      >
                        {engLine}
                      </span>
                    )}
                    {chiLine && (
                      <span
                        style={{
                          fontFamily: '"Iansui", sans-serif',
                          fontWeight: 700,
                          whiteSpace: 'pre',
                          wordBreak: 'normal',
                          overflowWrap: 'normal',
                          display: 'block',
                          textAlign: 'right',
                        }}
                      >
                        {spacify(chiLine)}
                      </span>
                    )}
                  </>
                );
                handled = true;
              }

              // Project title cell: render Chinese characters in Yuji Mai bold
              // and Latin characters in Karla bold so the mixed‑script title
              // matches the Instruction design more closely. We also force
              // this cell to *not* wrap so the title stays on a single line
              // within the merged band, even if the text would otherwise wrap
              // based on the column width.
              if (!handled && rawTrimmed === '<ProjectTitle>' && displayValue) {
                // Do not wrap the project title; allow it to overflow rather
                // than inserting an extra line break between CJK / Latin
                // segments.
                whiteSpace = 'pre';
                overflowWrap = 'normal';
                wordBreak = 'normal';

                // Normalise any explicit line breaks coming from the sheet
                // into spaces so they do not force an extra visual line.
                const titleValue = displayValue.replace(/\r?\n/g, ' ');

                const segments = titleValue
                  .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                  .filter(Boolean);
                content = (
                  <span>
                    {segments.map((seg, idx) => {
                      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(
                        seg,
                      );
                      const fam = hasCJK ? '"Yuji Mai", serif' : '"Karla", sans-serif';
                      return (
                        <span
                          key={idx}
                          style={{
                            fontFamily: fam,
                            fontWeight: 700,
                          }}
                        >
                          {seg}
                        </span>
                      );
                    })}
                  </span>
                );
                handled = true;
              }

              // PresenterWorkType: Latin in Google Sans Mono bold, CJK in Iansui bold.
              if (!handled && rawTrimmed === '<PresenterWorkType>' && displayValue) {
                const segments = displayValue
                  .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                  .filter(Boolean);
                content = (
                  <span>
                    {segments.map((seg, idx) => {
                      const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg);
                      const fam = hasCJK ? '"Iansui", sans-serif' : '"Google Sans Mono", monospace';
                      return (
                        <span
                          key={idx}
                          style={{
                            fontFamily: fam,
                            fontWeight: 700,
                          }}
                        >
                          {seg}
                        </span>
                      );
                    })}
                  </span>
                );
                handled = true;
              }

              // Item notes: render CJK segments using Chocolate Classical Sans
              // while keeping Latin text in Roboto Mono. This mirrors the
              // mixed font treatment from the design.
              if (!handled && rawTrimmed === '<ItemNotes>' && displayValue) {
                const lines = displayValue.replace(/\r\n/g, '\n').split('\n');
                content = (
                  <span>
                    {lines.map((line, lineIdx) => {
                      const segments = line
                        .split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/)
                        .filter(Boolean);
                      return (
                        <React.Fragment key={lineIdx}>
                          {segments.map((seg, idx) => {
                            const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(
                              seg,
                            );
                            const fam = hasCJK
                              ? '"Chocolate Classical Sans", sans-serif'
                              : '"Roboto Mono", monospace';
                            return (
                              <span
                                key={idx}
                                style={{
                                  fontFamily: fam,
                                }}
                              >
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

              // Special handling for the combined "<ItemTitle> <ItemSubQuantity>" cell:
              // render the title and the "x<subQty>" part with different font sizes,
              // but keep them on the same line by wrapping them in a single inline
              // container.
              if (!handled && rawTrimmed.includes('<ItemTitle>') && rawTrimmed.includes('<ItemSubQuantity>')) {
                const titleText = replaceTokens('<ItemTitle>', bindings);
                const subVal = bindings.ItemSubQuantity;
                const baseSize = safeNum(meta.fontSize, 10);
                const subSize = Math.max(1, baseSize - 4);

                content = (
                  <span>
                    <span
                      style={{
                        fontFamily,
                        fontWeight,
                        fontStyle,
                        fontSize: `${baseSize}px`,
                      }}
                    >
                      {titleText}
                    </span>
                    {subVal !== undefined && subVal !== null && String(subVal).trim() && (
                      <span
                        style={{
                          marginLeft: 2,
                          fontSize: `${subSize}px`,
                          fontWeight: 400,
                        }}
                      >
                        {`x${subVal}`}
                      </span>
                    )}
                  </span>
                );
              }
              // Standalone <ItemSubQuantity> cell (if any): render smaller with "x" prefix.
              else if (!handled && rawTrimmed === '<ItemSubQuantity>') {
                const sub = bindings.ItemSubQuantity;
                if (sub !== undefined && sub !== null && String(sub).trim()) {
                  const baseSize = safeNum(meta.fontSize, 10);
                  const subSize = Math.max(1, baseSize - 4);
                  content = (
                    <span
                      style={{
                        fontSize: `${subSize}px`,
                        fontWeight: 400,
                      }}
                    >
                      {`x${sub}`}
                    </span>
                  );
                } else {
                  content = '';
                }
              }
            }

            // add a bit more inset for non-centered content
            const padX = textAlign === 'center' ? 2 : 4;
            const padY = meta.vAlign === 'MIDDLE' ? 2 : 4;

            return (
              <div
                key={key}
                className="scheme-cell"
                style={{
                  gridRow: `${rowIndex} / span ${rowSpan}`,
                  gridColumn: `${colIndex} / span ${colSpan}`,
                  borderTop,
                  borderBottom,
                  borderLeft,
                  borderRight,
                  padding: `${padY}px ${padX}px`,
                  // Honour sheet background fill when present so header
                  // bands, totals boxes, etc. visually match the template.
                  ...(meta.bgColor
                    ? {
                        backgroundColor: `rgb(${Math.round(
                          (meta.bgColor.red ?? 0) * 255,
                        )}, ${Math.round((meta.bgColor.green ?? 0) * 255)}, ${Math.round(
                          (meta.bgColor.blue ?? 0) * 255,
                        )})`,
                      }
                    : null),
                  // When the Grid toggle is enabled, draw a light dashed
                  // outline for every cell so the underlying A–N / 1–57
                  // structure is visually apparent without relying on a
                  // separate overlay layer that can drift out of sync
                  // with the content.
                  ...(showGridOverlay
                    ? {
                        boxSizing: 'border-box',
                        outline: '0.5px dashed rgba(37, 99, 235, 0.4)',
                      }
                    : null),
                  // For diagnostic purposes, allow the N1 header cell
                  // (row 1, col 14) to overflow its grid box so we can
                  // see exactly how the text wants to sit relative to
                  // the column. All other cells keep default overflow.
                  overflow: isN1Cell || isOverflowCell ? 'visible' : undefined,
                }}
              >
                <div
                  style={{
                    fontFamily,
                    fontWeight,
                    fontStyle,
                  fontSize,
                  textAlign,
                    color: fgColor,
                    overflow: contentOverflow || (isPage4 ? 'visible' : undefined),
                    // Separate line spacing for multi-line vs single-line cells.
                    lineHeight:
                      typeof displayValue === 'string' && displayValue.includes('\n')
                        ? 1.2
                        : 1.0,
                    // Treat the inner container as a flex column so we can
                    // respect the sheet's vertical alignment metadata for
                    // merged cells (TOP / MIDDLE / BOTTOM) instead of
                    // always pinning text to the top of the cell.
                    display: 'flex',
                    flexDirection: 'column',
                    // Respect sheet vertical alignment (TOP / MIDDLE / BOTTOM).
                    justifyContent:
                      meta.vAlign === 'MIDDLE'
                        ? 'center'
                        : meta.vAlign === 'BOTTOM'
                        ? 'flex-end'
                        : 'flex-start',
                    // Keep a fixed height so vAlign has an effect even with overflow.
                    height: '100%',
                    whiteSpace,
                    overflowWrap,
                    wordBreak,
                  }}
                >
                  {content}
                </div>
              </div>
            );
          })}
          </div>
          {/* Row / column labels overlayed using absolute positioning so they share
              the same coordinate system and scale as the grid without affecting
              layout. Only render when the Grid toggle is enabled and when we're
              not explicitly suppressing labels (e.g. for print/PDF). */}
          {showGridOverlay && !suppressGridLabels && (
            <div
              className="scheme-label-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                fontSize: 8,
                color: 'rgba(37,99,235,0.7)',
              }}
            >
              {/* Row labels: 1–202 down the left side */}
              {pageRowHeights.map((h, idx) => {
                const rowNumber = PAGE1_START + idx;
                const centerY = rowOffsets[idx] + (h || 0) / 2;
                return (
                  <div
                    key={`r-${rowNumber}`}
                    style={{
                      position: 'absolute',
                      // Keep row labels *inside* the grid content area so
                      // they are not clipped by page margins when printed.
                      // A small inset from the left edge is enough for
                      // debugging while staying within the A4 content box.
                      left: 2,
                      top: centerY,
                      transform: 'translateY(-50%)',
                      textAlign: 'left',
                    }}
                  >
                    {rowNumber}
                  </div>
                );
              })}
              {/* Column labels: A–N across the top */}
              {columnWidthsPx.map((w, idx) => {
                const colNumber = idx + 1;
                const centerX = colOffsets[idx] + safeNum(w) / 2;
                const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                const label = letters[colNumber - 1] || String(colNumber);
                return (
                  <div
                    key={`c-${label}`}
                    style={{
                      position: 'absolute',
                      // Keep column labels inside the top edge of the grid
                      // so they remain visible within the printable area.
                      top: 2,
                      left: centerX,
                      transform: 'translateX(-50%)',
                      textAlign: 'center',
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  })();

  return (
    <div className="invoice-container">
      {schemeGrid}

      <style jsx>{`
        .invoice-container {
          font-family: 'Roboto Mono', monospace;
          color: #000;
          background-color: #fff;
          padding: 16px 0;
          width: 100%;
        }
        .scheme-debug {
          margin-top: 0;
          display: flex;
          justify-content: center;
        }
        .scheme-wrapper {
          position: relative;
          display: inline-block;
        }
        .scheme-grid {
          font-size: 8px;
          line-height: 1.0;
          border: 1px solid rgba(0,0,0,0.1);
          box-sizing: content-box;
        }
        .scheme-cell {
          /* Let the explicit row heights from the Instruction scheme fully
             control the vertical geometry. Avoid extra min-height or vertical
             padding that would cause rows to grow beyond their px values and
             drift away from the computed rowOffsets/colOffsets used for
             labels. */
          padding: 0 2px;
          overflow: hidden;
        }
      `}</style>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Rampart+One&family=Fascinate&family=Roboto+Mono:wght@400;700&family=Karla:wght@400;700&family=Cormorant+Infant:wght@400;700&family=EB+Garamond:wght@400;700&family=Iansui:wght@400;700&family=Yuji+Mai:wght@400;700&family=Federo&family=Chocolate+Classical+Sans&family=Nanum+Pen+Script&family=Covered+By+Your+Grace&family=Yomogi&family=Ephesis&family=Bungee+Shade&display=swap');
      `}</style>
    </div>
  );
};

export default GeneratedInvoice;
