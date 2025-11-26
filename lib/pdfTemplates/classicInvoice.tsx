import { Buffer } from 'buffer'
import React from 'react'
import * as ReactPdf from '@react-pdf/renderer';
const { Document, Page, Text, View, StyleSheet, Font, Image } = ReactPdf;
import { amountHK, num2eng, num2chi } from '../invoiceFormat'
import { FONT_DATA } from './fontData';

// Helper function to process the raw sheet data
const processSheetData = (sheetData: any) => {
  const TARGET_SHEET_TITLE = 'Classic Single-Item Invoice (Sample';
  const targetSheet = sheetData.sheets.find(
    (sheet: any) => sheet.properties?.title === TARGET_SHEET_TITLE
  );

  if (!targetSheet) {
    throw new Error(`Sheet with title "${TARGET_SHEET_TITLE}" not found.`);
  }

  const simplifyCell = (cell: any) => {
    if (!cell) return null;
    const simplified: {
      value?: string | number | boolean;
      format?: {
        fontFamily?: string;
        fontSize?: number;
        bold?: boolean;
        italic?: boolean;
        horizontalAlignment?: string;
        verticalAlignment?: string;
      };
      note?: string;
    } = {};

    if (cell.effectiveValue) {
      const value = Object.values(cell.effectiveValue)[0];
      simplified.value = value as string | number | boolean;
    }

    if (cell.effectiveFormat) {
      const { textFormat, horizontalAlignment, verticalAlignment } = cell.effectiveFormat;
      simplified.format = {
        fontFamily: textFormat?.fontFamily,
        fontSize: textFormat?.fontSize,
        bold: textFormat?.bold,
        italic: textFormat?.italic,
        horizontalAlignment,
        verticalAlignment,
      };
    }
    if(cell.note) {
      simplified.note = cell.note
    }
    return simplified;
  };

  return {
    properties: targetSheet.properties,
    rows: targetSheet.data[0].rowData.map((row: any) => {
      if (!row.values) return [];
      return row.values.map(simplifyCell);
    }),
    merges: targetSheet.merges,
    rowMetadata: targetSheet.data[0].rowMetadata,
    columnMetadata: targetSheet.data[0].columnMetadata,
  };
};

// Remote TTF fallbacks (used only if embedded base64 is missing)
const REMOTE_TTF = {
  RobotoMonoRegular: 'https://raw.githubusercontent.com/google/fonts/main/apache/robotomono/RobotoMono-Regular.ttf',
  RobotoMonoBold: 'https://raw.githubusercontent.com/google/fonts/main/apache/robotomono/RobotoMono-Bold.ttf',
  RobotoMonoVar: 'https://raw.githubusercontent.com/google/fonts/main/ofl/robotomono/RobotoMono%5Bwght%5D.ttf',
  VarelaRoundRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/varelaround/VarelaRound-Regular.ttf',
  RampartOneRegular: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rampartone/RampartOne-Regular.ttf',
  CormorantInfantVar: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantinfant/CormorantInfant%5Bwght%5D.ttf',
  NanumPenScriptRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/nanum-pen-script@5.0.8/files/nanum-pen-script-latin-400-normal.woff',
  YomogiRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/yomogi@5.0.8/files/yomogi-latin-400-normal.woff',
  EphesisRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/ephesis@5.0.8/files/ephesis-latin-400-normal.woff',
  EBGaramondRegular: 'https://cdn.jsdelivr.net/npm/@fontsource/eb-garamond@5.0.8/files/eb-garamond-latin-400-normal.woff',
} as const

const ensureAtobPolyfill = () => {
  if (typeof globalThis.atob !== 'function') {
    globalThis.atob = (input: string) => Buffer.from(input, 'base64').toString('binary')
  }
}

const toDataUri = (base64?: string | null) => (base64 ? `data:font/ttf;base64,${base64}` : null)

const isValidBase64Font = (b64?: string | null) => {
  try {
    if (!b64 || typeof b64 !== 'string' || b64.length < 32) return false
    const buf = Buffer.from(b64, 'base64')
    if (!buf || buf.length < 1024) return false
    // TrueType starts with 00 01 00 00; OpenType(CFF) starts with 'OTTO'
    const sig = buf.slice(0, 4).toString('ascii')
    if (sig === 'OTTO') return true
    const ttfSig = buf.readUInt32BE(0)
    return ttfSig === 0x00010000
  } catch {
    return false
  }
}

const pickFontSrc = (fileKey: keyof typeof FONT_DATA | string, remoteUrl?: string | null) => {
  try {
    // Prefer embedded base64 when available
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const base64: string | undefined = FONT_DATA[fileKey as any]
    if (isValidBase64Font(base64)) {
      const data = toDataUri(base64)
      if (data) {
        try {
          console.info('[pdf-font] using embedded', { fileKey, size: base64?.length })
        } catch {}
        return data
      }
    }
    if (remoteUrl) {
      try { console.info('[pdf-font] using remote', { fileKey, url: remoteUrl }) } catch {}
      return remoteUrl
    }
  } catch (err) {
    try { console.error('[pdf-font] pickFontSrc error', { fileKey, error: (err as any)?.message || String(err) }) } catch {}
  }
  return null
}

const registerFontFamily = () => {
  ensureAtobPolyfill()
  try {
    // RobotoMono: use embedded only; do not rely on remote URLs (can 404 on Vercel)
    let r400 = pickFontSrc('RobotoMono-Regular.ttf', null)
    let r700 = pickFontSrc('RobotoMono-Bold.ttf', null)
    if (!r400 || !r700) {
      try {
        const b64r = (FONT_DATA as any)['RobotoMono-Regular.ttf']?.length
        const b64b = (FONT_DATA as any)['RobotoMono-Bold.ttf']?.length
        console.error('[pdf-font] RobotoMono embedded data check', { b64r, b64b, r400: !!r400, r700: !!r700 })
      } catch {}
      // As a hard fallback on Vercel (to avoid render crash), alias to VarelaRound if RobotoMono assets are invalid
      const alt = pickFontSrc('VarelaRound-Regular.ttf', null)
      if (!r400 && alt) r400 = alt
      if (!r700 && alt) r700 = alt
      try { console.error('[pdf-font] RobotoMono missing; falling back to VarelaRound for registration', { has400: Boolean(r400), has700: Boolean(r700) }) } catch {}
    }
    if (r400 && r700) {
      // Register multiple weight aliases to avoid resolution errors
      const fonts: any[] = [
        // normal style
        { src: r400, fontWeight: 400, fontStyle: 'normal' },
        { src: r400, fontWeight: 'normal', fontStyle: 'normal' },
        { src: r400, fontWeight: 300, fontStyle: 'normal' },
        { src: r400, fontWeight: 500, fontStyle: 'normal' },
        { src: r700, fontWeight: 700, fontStyle: 'normal' },
        { src: r700, fontWeight: 'bold', fontStyle: 'normal' },
        { src: r700, fontWeight: 600, fontStyle: 'normal' },
        { src: r700, fontWeight: 800, fontStyle: 'normal' },
        // italic style aliases (map to same files to avoid missing-face crash)
        { src: r400, fontWeight: 400, fontStyle: 'italic' },
        { src: r400, fontWeight: 'normal', fontStyle: 'italic' },
        { src: r700, fontWeight: 700, fontStyle: 'italic' },
        { src: r700, fontWeight: 'bold', fontStyle: 'italic' },
      ]
      Font.register({ family: 'RobotoMono', fonts })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register RobotoMono', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const varela = pickFontSrc('VarelaRound-Regular.ttf', REMOTE_TTF.VarelaRoundRegular)
    if (!varela) {
      try { console.error('[pdf-font] VarelaRound source missing') } catch {}
    } else {
      Font.register({ family: 'VarelaRound', src: varela })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register VarelaRound', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const ci = pickFontSrc('CormorantInfant[wght].ttf', REMOTE_TTF.CormorantInfantVar)
    if (!ci) {
      try { console.error('[pdf-font] CormorantInfant source missing') } catch {}
    } else {
      Font.register({
        family: 'CormorantInfant',
        fonts: [
          { src: ci, fontWeight: 400, fontStyle: 'normal' },
          { src: ci, fontWeight: 700, fontStyle: 'normal' },
          { src: ci, fontWeight: 400, fontStyle: 'italic' },
          { src: ci, fontWeight: 700, fontStyle: 'italic' },
        ],
      })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register CormorantInfant', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const rampart = pickFontSrc('RampartOne-Regular.ttf', REMOTE_TTF.RampartOneRegular)
    if (!rampart) {
      try { console.error('[pdf-font] RampartOne source missing') } catch {}
    } else {
      // Register under both names to avoid mismatches
      Font.register({ family: 'RampartOne', src: rampart })
      Font.register({ family: 'Rampart One', src: rampart })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register RampartOne', { error: (error as any)?.message || String(error) }) } catch {}
  }
  try {
    const iansuiBase64 = FONT_DATA['Iansui-Regular.ttf']
    const iansui = toDataUri(iansuiBase64)
    if (!iansui) {
      try { console.error('[pdf-font] Iansui embedded data missing') } catch {}
    } else {
      Font.register({ family: 'Iansui', src: iansui })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Iansui', { error: (error as any)?.message || String(error) }) } catch {}
  }
  // Removed Google Sans Mono registration: React-PDF requires direct TTF/OTF; CSS URLs are unsupported.

  // Use embedded EB Garamond variable TTF; alias common names
  try {
    const eb = pickFontSrc('EBGaramond[wght].ttf', null)
    if (!eb) {
      try { console.error('[pdf-font] EBGaramond source missing') } catch {}
    } else {
      Font.register({
        family: 'EB Garamond',
        fonts: [
          { src: eb, fontWeight: 400, fontStyle: 'normal' },
          { src: eb, fontWeight: 700, fontStyle: 'normal' },
        ],
      })
      Font.register({
        family: 'EBGaramond',
        fonts: [
          { src: eb, fontWeight: 400, fontStyle: 'normal' },
          { src: eb, fontWeight: 700, fontStyle: 'normal' },
        ],
      })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register EBGaramond', { error: (error as any)?.message || String(error) }) } catch {}
  }

  // Removed Karla WOFF registration (unsupported format in fontkit/React-PDF). If Karla is
  // required later, embed a TTF as base64 in FONT_DATA or use a valid TTF URL.
}

registerFontFamily()

const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = { top: 21.6, bottom: 21.6, left: 14.4, right: 14.4 } // 0.3"/0.2"
const px2pt = (px: number) => px * 0.75
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN.left - PAGE_MARGIN.right
// Use absolute widths (pt) for closer parity; now derived from A..N grid columns
// Description = A..L, Amount = M..N by default
// These are refined for the items table, not the header/footer band placements
// (COLS_PT is declared below)

// Scanned grid bands (A..N in points) for header/footer placement
const COLS_PT = [36, 18.75, 27, 90, 22.5, 67.5, 56.25, 56.25, 55.5, 30, 26.25, 15, 15, 96]
const COL_OFFSETS_PT: number[] = COLS_PT.reduce((acc: number[], w, i) => {
  acc[i] = (acc[i - 1] || 0) + w
  return acc
}, [])
// Page 1 footer row heights (pt). Pages 2–4 are visually similar; we reuse these for now.
const ROWS_FOOTER_PT = [12, 15.75, 12, 15.75, 12, 15.75, 12, 15.75, 15, 15.75]

const cellLeft = (col: number) => (PAGE_MARGIN.left + (col > 0 ? COL_OFFSETS_PT[col - 1] : 0))
const footerTopY = () => PAGE_HEIGHT - PAGE_MARGIN.bottom - ROWS_FOOTER_PT.reduce((s, h) => s + h, 0)
const footerRowOffset = (row: number) => ROWS_FOOTER_PT.slice(0, row).reduce((s, h) => s + h, 0)

// Table column widths derived from grid
const DESC_COL_WIDTH = COLS_PT.slice(0, 12).reduce((s, w) => s + w, 0) // A..L
const AMOUNT_COL_WIDTH = COLS_PT.slice(12).reduce((s, w) => s + w, 0)   // M..N

const styles = generatedStyles;

export type ClassicInvoiceItem = {
  title?: string | null
  subQuantity?: string | null
  feeType?: string | null
  notes?: string | null
  unitPrice?: number | null
  quantity?: number | null
  quantityUnit?: string | null
  discount?: number | null
}

export interface ClassicInvoiceDocInput {
  invoiceNumber: string
  invoiceDateDisplay?: string | null
  projectNumber?: string | null
  projectDate?: string | null
  companyName: string | null
  addressLine1: string | null
  addressLine2: string | null
  addressLine3: string | null
  region: string | null
  representative: string | null
  presenterWorkType?: string | null
  projectTitle?: string | null
  projectNature?: string | null
  projectPickupDate?: string | null
  subsidiaryEnglishName?: string | null
  subsidiaryChineseName?: string | null
  subsidiaryAddressLines?: string[]
  subsidiaryPhone?: string | null
  subsidiaryEmail?: string | null
  items: ClassicInvoiceItem[]
  subtotal?: number | null
  total?: number | null
  amount?: number | null
  taxOrDiscountPercent?: number | null
  paidTo?: string | null
  paymentStatus?: string | null
  bankName?: string | null
  bankCode?: string | null
  accountType?: string | null
  bankAccountNumber?: string | null
  fpsId?: string | null
  fpsEmail?: string | null
  paymentTerms?: string | null
  sheetData: any;
}

export type ClassicInvoiceVariant = 'bundle' | 'A' | 'A2' | 'B' | 'B2'

type VariantBase = 'A' | 'B'

const LINE_LIMITS: Record<VariantBase, { first: number; other: number }> = {
  B: { first: 32, other: 38 },
  A: { first: 34, other: 42 },
}

const estimateItemLines = (item: ClassicInvoiceItem) => {
  let lines = 3
  if (item.subQuantity) lines += 1
  if (item.feeType) lines += 1
  if (item.notes) {
    const text = String(item.notes)
    const chunks = Math.max(1, Math.ceil(text.length / 80))
    lines += chunks
  }
  return lines
}

const paginateItemsForVariant = (items: ClassicInvoiceItem[], variant: VariantBase) => {
  const limits = LINE_LIMITS[variant]
  const pages: ClassicInvoiceItem[][] = []
  let current: ClassicInvoiceItem[] = []
  let remaining = limits.first
  const otherLimit = limits.other
  const pushPage = () => {
    if (current.length) {
      pages.push(current)
      current = []
    }
  }
  items.forEach((item, index) => {
    const lines = estimateItemLines(item)
    const limit = pages.length === 0 ? limits.first : otherLimit
    if (current.length === 0 && lines > limit) {
      pages.push([item])
      remaining = otherLimit
      return
    }
    if (lines > remaining) {
      pushPage()
      remaining = otherLimit
    }
    current.push(item)
    remaining -= lines
  })
  if (current.length) {
    pages.push(current)
  }
  if (!pages.length) {
    pages.push([])
  }
  return pages
}

const joinAddress = (parts: (string | null | undefined)[]) =>
  parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ')

const renderAddressLines = (lines: (string | null | undefined)[], styleOverride?: any) =>
  lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line, idx) => (
      <Text key={`addr-${idx}`} style={{ fontSize: 10, ...(styleOverride || {}) }}>
        {line}
      </Text>
    ))

// Insert spaces between characters to mirror the sheet's "spacified" style
const spacify = (input: string | null | undefined) => {
  if (!input) return ''
  return String(input)
    .split('\n')
    .map((line) => line.split('').join(' '))
    .join('\n')
}

// Spacified Hong Kong phone number grouping
const spacifyPhoneHK = (raw: string | null | undefined) => {
  if (!raw) return ''
  const s = String(raw)
  const m = s.replace(/\s+/g, '').match(/^(\+)?\(?([0-9]{3})\)?[-\s]?([0-9]{4})[-\s]?([0-9]{4})$/)
  if (!m) return spacify(s)
  const plus = m[1] ? '+ ' : ''
  const a = m[2].split('').join(' ')
  const b = m[3].split('').join(' ')
  const c = m[4].split('').join(' ')
  return `${plus}${a}   ${b}   ${c}`
}

// Header A1:N6 geometry from scanned sheet (px → pt). Applies to page 1.
const HEADER1_COLS_PX = [48, 25, 36, 120, 30, 90, 75, 75, 74, 40, 35, 20, 20, 128]
// Rows 1..6 from scan; rows 7..15 approximated to match sheet defaults
const PAGE1_ROWS_PX = [31, 18, 18, 18, 16, 16, 18, 18, 18, 18, 18, 18, 18, 18, 18]
const HEADER1_COLS_PT = HEADER1_COLS_PX.map(px2pt)
const PAGE1_ROWS_PT = PAGE1_ROWS_PX.map(px2pt)
const header1ColOffsets = HEADER1_COLS_PT.reduce((acc: number[], w, i) => {
  acc[i] = (acc[i - 1] || 0) + w
  return acc
}, [])
const page1RowOffsets = PAGE1_ROWS_PT.reduce((acc: number[], h, i) => {
  acc[i] = (acc[i - 1] || 0) + h
  return acc
}, [])

const a1ToRectPage1 = (colIndex1: number, rowIndex1: number, colSpan = 1, rowSpan = 1) => {
  const c0 = colIndex1 - 1
  const r0 = rowIndex1 - 1
  const left = PAGE_MARGIN.left + (c0 > 0 ? header1ColOffsets[c0 - 1] : 0)
  const top = PAGE_MARGIN.top + (r0 > 0 ? page1RowOffsets[r0 - 1] : 0)
  const width = HEADER1_COLS_PT.slice(c0, c0 + colSpan).reduce((s, v) => s + v, 0)
  const height = PAGE1_ROWS_PT.slice(r0, r0 + rowSpan).reduce((s, v) => s + v, 0)
  return { left, top, width, height }
}

const HeaderGridPage1 = ({ data, qrPayload }: { data: ClassicInvoiceDocInput; qrPayload: string | null }) => {
  const headerHeight = PAGE1_ROWS_PT.slice(0, 6).reduce((s, v) => s + v, 0)
  const page1Height = PAGE1_ROWS_PT.slice(0, 15).reduce((s, v) => s + v, 0)
  const toCell = (c: number, r: number, cs = 1, rs = 1) => a1ToRectPage1(c, r, cs, rs)
  const formatDate = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  return (
    <View style={{ position: 'relative', height: page1Height, width: CONTENT_WIDTH }}>
      {/* E. logo aligned with row 1 top */}
      {(() => {
        const r = toCell(1, 1)
        return (
          <Text style={{ position: 'absolute', left: PAGE_MARGIN.left, top: r.top, fontFamily: 'RampartOne', fontSize: 60 }}>E.</Text>
        )
      })()}
      {/* Subsidiary English + Chinese at N1 */}
      {(() => {
        const r = toCell(14, 1)
        return (
          <View style={{ position: 'absolute', left: r.left, top: r.top, width: r.width }}>
            <Text style={{ fontFamily: 'CormorantInfant', fontSize: 10, fontWeight: 700, textAlign: 'right' }}>{spacify(data.subsidiaryEnglishName ?? 'Establish Records Limited')}</Text>
            {data.subsidiaryChineseName ? (
              <Text style={{ fontFamily: 'Iansui', fontSize: 10, textAlign: 'right' }}>{spacify(data.subsidiaryChineseName)}</Text>
            ) : null}
          </View>
        )
      })()}
      {/* Address J2..J5 */}
      {(() => {
        const r = toCell(10, 2, 1, 4)
        return (
          <View style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height }}>
            {renderAddressLines((data.subsidiaryAddressLines ?? []), { fontFamily: 'CormorantInfant', fontSize: 7, textAlign: 'right' })}
          </View>
        )
      })()}
      {/* Email + Phone J5 */}
      {(() => {
        const r = toCell(10, 5)
        return (
          <View style={{ position: 'absolute', left: r.left, top: r.top, width: r.width }}>
            {data.subsidiaryEmail ? (
              <Text style={{ fontFamily: 'CormorantInfant', fontSize: 7, fontWeight: 700, color: '#666', textAlign: 'right' }}>{spacify(data.subsidiaryEmail)}</Text>
            ) : null}
            {data.subsidiaryPhone ? (
              <Text style={{ fontFamily: 'CormorantInfant', fontSize: 7, fontWeight: 700, color: '#666', textAlign: 'right' }}>{spacifyPhoneHK(data.subsidiaryPhone)}</Text>
            ) : null}
          </View>
        )
      })()}
      {/* BILL TO A6; Client A8..A11; ATTN A13 */}
      {(() => {
        const a6 = toCell(1, 6)
        return (
          <Text style={{ position: 'absolute', left: a6.left, top: a6.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic' }}>BILL TO:</Text>
        )
      })()}
      {(() => {
        const a8 = toCell(1, 8, 6, 1)
        return (
          <Text style={{ position: 'absolute', left: a8.left, top: a8.top, fontFamily: 'RobotoMono', fontSize: 11, fontWeight: 700, fontStyle: 'italic' }}>{data.companyName ?? '-'}</Text>
        )
      })()}
      {(() => {
        const a9 = toCell(1, 9, 6, 1)
        const a10 = toCell(1, 10, 6, 1)
        const a11 = toCell(1, 11, 6, 1)
        const lines = [data.addressLine1, data.addressLine2, joinAddress([data.addressLine3, data.region])].filter((v)=>Boolean(v && String(v).trim())) as string[]
        return (
          <View>
            {lines[0] ? <Text style={{ position: 'absolute', left: a9.left, top: a9.top }}>{lines[0]}</Text> : null}
            {lines[1] ? <Text style={{ position: 'absolute', left: a10.left, top: a10.top }}>{lines[1]}</Text> : null}
            {lines[2] ? <Text style={{ position: 'absolute', left: a11.left, top: a11.top }}>{lines[2]}</Text> : null}
          </View>
        )
      })()}
      {(() => {
        const a13 = toCell(1, 13, 6, 1)
        return data.representative ? (
          <Text style={{ position: 'absolute', left: a13.left, top: a13.top, fontFamily: 'RobotoMono', fontSize: 9, fontWeight: 700, fontStyle: 'italic' }}>ATTN: {data.representative}</Text>
        ) : null
      })()}
      {/* Invoice L7, labels and values N10/M11, N12/L13, FPS at N15 with QR */}
      {(() => {
        const l7 = toCell(12, 7, 1, 1) // col L
        return (
          <Text style={{ position: 'absolute', left: l7.left, top: l7.top, width: HEADER1_COLS_PT[11], textAlign: 'center', fontFamily: 'EB Garamond', fontSize: 35, fontWeight: 700 }}>Invoice</Text>
        )
      })()}
      {(() => {
        const n10 = toCell(14, 10)
        const m11 = toCell(13, 11)
        const n12 = toCell(14, 12)
        const l13 = toCell(12, 13)
        const n15 = toCell(14, 15)
        return (
          <View>
            <Text style={{ position: 'absolute', left: n10.left, top: n10.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: HEADER1_COLS_PT[13] }}>Invoice #:</Text>
            <Text style={{ position: 'absolute', left: m11.left, top: m11.top, fontFamily: 'RobotoMono', fontSize: 9, fontWeight: 700, textAlign: 'right', width: HEADER1_COLS_PT[12] }}>{data.invoiceNumber}</Text>
            <Text style={{ position: 'absolute', left: n12.left, top: n12.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: HEADER1_COLS_PT[13] }}>Issued Date:</Text>
            <Text style={{ position: 'absolute', left: l13.left, top: l13.top, fontFamily: 'RobotoMono', fontSize: 9, fontWeight: 700, textAlign: 'right', width: HEADER1_COLS_PT[11] }}>{formatDate(data.invoiceDateDisplay)}</Text>
            <Text style={{ position: 'absolute', left: n15.left, top: n15.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: HEADER1_COLS_PT[13] }}>FPS:</Text>
            {qrPayload ? (
              <Image src={buildHKFPSQrUrl(qrPayload, 128)!} style={{ position: 'absolute', left: m11.left, top: n15.top + 6, width: 64, height: 64 }} />
            ) : null}
          </View>
        )
      })()}
    </View>
  )
}

// duplicate spacify/spacifyPhoneHK removed (defined earlier at ~400)

const BillTo = ({ data }: { data: ClassicInvoiceDocInput }) => {
  const addressLines = [
    data.addressLine1,
    data.addressLine2,
    joinAddress([data.addressLine3, data.region]),
  ].filter((line): line is string => Boolean(line && line.trim()))
  return (
    <View style={{ flex: 1, paddingRight: 18 }}>
      <Text style={styles.sectionLabel}>BILL TO:</Text>
      <Text style={[styles.billName, { fontStyle: 'italic' }]}>{data.companyName ?? '-'}</Text>
      {addressLines.map((line, idx) => (
        <Text key={`client-line-${idx}`}>{line}</Text>
      ))}
      {data.representative ? (
        <Text style={{ fontStyle: 'italic', marginTop: 4 }}>ATTN: {data.representative}</Text>
      ) : null}
    </View>
  )
}

const ProjectMeta = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={{ marginBottom: 12 }}>
    {data.presenterWorkType ? (
      <Text style={{ fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic' }}>
        {data.presenterWorkType}
      </Text>
    ) : null}
    {data.projectTitle ? (
      <Text style={styles.projectTitle}>{data.projectTitle}</Text>
    ) : null}
    {data.projectNature ? (
      <Text style={styles.projectNature}>{data.projectNature}</Text>
    ) : null}
  </View>
)

const ItemsTable = ({ data, items }: { data: ClassicInvoiceDocInput; items: ClassicInvoiceItem[] }) => (
  <View>
      <View style={[styles.tableHeader, { borderBottomWidth: 2 }]}> 
        <View style={[styles.tableColDesc, { width: DESC_COL_WIDTH }]}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.6 }}>Description</Text>
        </View>
        <View style={[styles.tableColAmount, { width: AMOUNT_COL_WIDTH }]}>
          <Text style={{ fontWeight: 700, letterSpacing: 0.6, textAlign: 'right' }}>Amount</Text>
        </View>
      </View>
    {items.length === 0 ? (
      <View style={{ paddingVertical: 12 }}>
        <Text>No items added.</Text>
      </View>
    ) : (
      items.map((item, idx) => {
        const total = (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)
        return (
          <View key={`item-${idx}`} style={styles.itemRow}>
            <View style={[styles.tableColDesc, { width: DESC_COL_WIDTH }]}>
              <Text style={{ fontSize: 11, fontWeight: 700 }}>{item.title || `Item ${idx + 1}`}</Text>
              {item.subQuantity ? <Text>{item.subQuantity}</Text> : null}
              {item.feeType ? <Text style={{ fontStyle: 'italic' }}>{item.feeType}</Text> : null}
              {item.notes ? <Text>{item.notes}</Text> : null}
              <Text style={{ fontStyle: 'italic', color: '#6b7280', marginTop: 2 }}>
                {amountHK(item.unitPrice ?? 0)} × {item.quantity ?? 0}
                {item.quantityUnit ? ` ${item.quantityUnit}` : ''}
                {item.discount ? ` — Disc ${amountHK(item.discount)}` : ''}
              </Text>
            </View>
            <View style={[styles.tableColAmount, { width: AMOUNT_COL_WIDTH }]}>
              <Text style={styles.amountCell}>{amountHK(total)}</Text>
            </View>
          </View>
        )
      })
    )}
  </View>
)

const computeTotals = (data: ClassicInvoiceDocInput) => {
  const subtotal =
    typeof data.subtotal === 'number'
      ? data.subtotal
      : data.items.reduce((sum, item) => sum + Math.max(0, (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)), 0)
  const total =
    typeof data.total === 'number'
      ? data.total
      : typeof data.amount === 'number'
        ? data.amount
        : subtotal
  const adjustment = total - subtotal
  return { subtotal, total, adjustment }
}

const Totals = ({ data }: { data: ClassicInvoiceDocInput }) => {
  const { subtotal, total, adjustment } = computeTotals(data)
  const hasAdjustment = Math.abs(adjustment) >= 0.01
  return (
    <View style={styles.totalsBlock}>
      <View style={styles.totalsRow}>
        <Text>Subtotal</Text>
        <Text>{amountHK(subtotal)}</Text>
      </View>
      {hasAdjustment ? (
        <View style={styles.totalsRow}>
          <Text>Adjustment</Text>
          <Text>{amountHK(adjustment)}</Text>
        </View>
      ) : null}
      <View style={[styles.totalsRow, { marginTop: 6 }]}>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>Invoice Total</Text>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{amountHK(total)}</Text>
      </View>
      <View style={{ marginTop: 8 }}>
        <Text>For the amount of: {num2eng(total) || amountHK(total)}</Text>
        <Text style={{ fontFamily: 'Iansui' }}>茲付金額：{num2chi(total)}</Text>
      </View>
    </View>
  )
}

// Removed generic PaymentSummary from item pages. All payment identifiers and terms are
// rendered only on the Payment Details/Instructions pages to match the classic invoices.

const FooterBlock = ({ data }: { data: ClassicInvoiceDocInput }) => (
  <View style={styles.footer}>
    <Text>{data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
    {data.subsidiaryChineseName ? <Text style={styles.footerZh}>{data.subsidiaryChineseName}</Text> : null}
    {renderAddressLines(data.subsidiaryAddressLines ?? [])}
    {data.subsidiaryPhone ? <Text>{data.subsidiaryPhone}</Text> : null}
    {data.subsidiaryEmail ? <Text>{data.subsidiaryEmail}</Text> : null}
  </View>
)

// Footer per scanned layout (labels on left block; bank details on right block)
const ScannedFooter = ({ data, pageNumber, totalPages }: { data: ClassicInvoiceDocInput; pageNumber: number; totalPages: number }) => {
  const leftX = cellLeft(0) // col A
  const rightX = cellLeft(6) // col G
  const y0 = footerTopY()
  const at = (row: number) => ({ position: 'absolute' as const, left: leftX, top: y0 + footerRowOffset(row) })
  const atr = (row: number) => ({ position: 'absolute' as const, left: rightX, top: y0 + footerRowOffset(row) })
  const label = (txt: string, side: 'L' | 'R', row: number) => (
    <Text style={{ fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', ...(side === 'L' ? at(row) : atr(row)) }}>{txt}</Text>
  )
  const value = (txt: string, side: 'L' | 'R', row: number, strong = false) => (
    <Text style={{ fontFamily: 'RobotoMono', fontSize: strong ? 11 : 10, fontWeight: strong ? 700 : 400, ...(side === 'L' ? at(row) : atr(row)) }}>{txt}</Text>
  )
  const beneficiary = data.paidTo ?? data.subsidiaryEnglishName ?? ''
  const bank = [data.bankName, data.bankCode ? `(${data.bankCode})` : ''].filter(Boolean).join(' ')
  const acct = data.bankAccountNumber ?? ''
  const fps = data.fpsId ?? ''
  return (
    <View>
      {label('Cheque Payable To :', 'L', 0)}
      {beneficiary ? value(beneficiary, 'L', 1, true) : null}
      {label('Bank:', 'R', 0)}
      {bank ? value(bank, 'R', 1) : null}
      {label('Account Number:', 'R', 2)}
      {acct ? value(acct, 'R', 3) : null}
      {label('FPS ID:', 'R', 4)}
      {fps ? value(fps, 'R', 5) : null}
      <Text style={{ position: 'absolute', left: PAGE_MARGIN.left, right: PAGE_MARGIN.right, textAlign: 'center', top: y0 + footerRowOffset(9), fontSize: 9, color: '#94a3b8' }}>
        Page {pageNumber} of {totalPages}
      </Text>
    </View>
  )
}

type ItemPageDescriptor = {
  kind: 'items'
  variantBase: VariantBase
  items: ClassicInvoiceItem[]
  pageIndex: number
  totalPagesForVariant: number
}

type ExtraPageDescriptor =
  | { kind: 'payment-details'; title: 'Payment Details' }
  | { kind: 'payment-instructions'; title: 'Payment Instructions' }

type PageDescriptor = ItemPageDescriptor | ExtraPageDescriptor

const buildHKFPSPayload = (
  fpsProxyValue: string | null,
  includeAmount: boolean,
  amountNumber: number | null,
) => {
  if (!fpsProxyValue || !fpsProxyValue.trim()) return null
  const TLV = (id: string, val: string | null | undefined) => {
    if (!val) return ''
    const str = String(val)
    return id + (`0${str.length}`).slice(-2) + str
  }

  const CRC16 = (input: string) => {
    let crc = 0xffff
    for (let i = 0; i < input.length; i++) {
      crc ^= (input.charCodeAt(i) & 0xff) << 8
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
        else crc <<= 1
        crc &= 0xffff
      }
    }
    return (`000${crc.toString(16).toUpperCase()}`).slice(-4)
  }

  const payloadFormat = TLV('00', '01')
  const pointOfInit = TLV('01', includeAmount ? '12' : '11')
  const raw = fpsProxyValue.trim()
  let proxyType: 'id' | 'phone' | 'email'
  if (/@/.test(raw)) proxyType = 'email'
  else if (/^\+/.test(raw)) proxyType = 'phone'
  else proxyType = 'id'
  const GUID = 'hk.com.hkicl'
  let mai = TLV('00', GUID)
  if (proxyType === 'email') mai += TLV('04', raw)
  else if (proxyType === 'phone') mai += TLV('03', raw)
  else mai += TLV('02', raw)
  const merchantAccountInfo = TLV('26', mai)
  const mcc = TLV('52', '0000')
  const currency = TLV('53', '344')
  let amountTLV = ''
  if (includeAmount && typeof amountNumber === 'number' && Number.isFinite(amountNumber)) {
    let amt = amountNumber.toFixed(2).replace(/\.00$/, '')
    amountTLV = TLV('54', amt)
  }
  const country = TLV('58', 'HK')
  const name = TLV('59', 'NA')
  const city = TLV('60', 'HK')
  const withoutCRC = payloadFormat + pointOfInit + merchantAccountInfo + mcc + currency + amountTLV + country + name + city
  const crc = CRC16(withoutCRC + '63' + '04')
  return withoutCRC + '63' + '04' + crc
}

const buildHKFPSQrUrl = (payload: string | null, size = 220) =>
  payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`
    : null

const PaymentDetailsPage = ({
  data,
  qrPayload,
  pageNumber,
  totalPages,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
}) => {
  const qrUrl = buildHKFPSQrUrl(qrPayload, 240)
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ fontFamily: 'CormorantInfant', fontSize: 22, letterSpacing: 0.3, marginBottom: 12 }}>
        Payment Details
      </Text>

      {/* Beneficiary / Bank identifiers */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
          Beneficiary: <Text style={{ fontWeight: 700 }}>{data.paidTo ?? data.subsidiaryEnglishName ?? '-'}</Text>
        </Text>
        {(data as any).brNo ? (
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>BR No.: {(data as any).brNo}</Text>
        ) : null}
        {data.bankName ? (
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
            Bank: {data.bankName}{data.bankCode ? ` (${data.bankCode})` : ''}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 24, marginTop: 2 }}>
          {data.bankCode ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Branch Code: {data.bankCode}</Text>
          ) : null}
          {data.bankAccountNumber ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Account Number: {data.bankAccountNumber}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 }}>
          {data.fpsId ? (
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>FPS ID: {data.fpsId}</Text>
          ) : null}
          {qrUrl ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image src={qrUrl} style={{ width: 120, height: 120 }} />
              <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>FPS QR Code</Text>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
            For the amount of: <Text style={{ fontWeight: 700 }}>{num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
          </Text>
          <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>茲付金額：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>Address:</Text>
          {renderAddressLines(data.subsidiaryAddressLines ?? [])}
        </View>
      </View>

      {/* Terms & Conditions */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: 'CormorantInfant', fontSize: 16, marginBottom: 6 }}>Terms & Conditions</Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          1. Acceptance: By continuing to use our services, instructing us to proceed, requesting release of deliverables, failing to object in writing within the dispute period, or paying in whole or in part, the Client is deemed to have agreed to and be bound by these Terms & Conditions.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          2. Payment: Payment is due within seven (7) calendar days after the earlier of (i) the Invoice date; or (ii) the Client’s written request to release final deliverables. Deliverables are released only after receipt of cleared funds.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          3. Disputes: Any billing disputes must be submitted in writing within three (3) days of receipt of this Invoice; otherwise, the Invoice is deemed accepted.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          4. Late Charges: If payment is not received when due, a late fee of the greater of HK$150 or 1.5% of the outstanding balance per 14-day period accrues until paid in full, unless otherwise agreed in writing.
        </Text>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
          5. Other terms customary to your invoices can be added verbatim here.
        </Text>
      </View>

      <FooterBlock data={data} />
      <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
    </Page>
  )
}

const PaymentInstructionsPage = ({
  data,
  qrPayload,
  pageNumber,
  totalPages,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
}) => (
  <Page size="A4" style={styles.page}>
    <Text style={{ fontFamily: 'CormorantInfant', fontSize: 22, letterSpacing: 0.3, marginBottom: 10 }}>
      Payment Instructions
    </Text>
      <Text style={{ fontSize: 10, marginBottom: 12 }}>
      Payment for this invoice is required within <Text style={{ fontWeight: 700 }}>7 DAYS</Text> of its issuance. Please choose from the payment methods listed below.
    </Text>

    {/* 1. Payable Cheque */}
    <View style={{ borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fff7e6', borderRadius: 6, padding: 16, marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>1. Payable Cheque</Text>
      <View style={{ borderWidth: 1, borderColor: '#eab308', backgroundColor: '#fffef7', borderRadius: 4, padding: 12 }}>
        <Text style={{ fontSize: 10 }}>
          Pay to: {data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}
        </Text>
        <Text style={{ fontSize: 10 }}>Amount (in words): {num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>金額（中文）：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
      </View>
    </View>

    <Text style={{ fontSize: 10, textAlign: 'center', marginBottom: 12 }}>or</Text>

    {/* 2. Payment Transfer */}
    <View style={{ borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fff4', borderRadius: 6, padding: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 6 }}>2. Payment Transfer</Text>
      <Text style={{ fontSize: 10 }}>Account Name: {data.paidTo ?? data.subsidiaryEnglishName ?? 'Establish Records Limited'}</Text>
      {data.bankName ? (
        <Text style={{ fontSize: 10 }}>
          Bank: {data.bankName}{data.bankCode ? ` (${data.bankCode})` : ''}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 24, marginTop: 2 }}>
        {data.bankCode ? <Text style={{ fontSize: 10 }}>Branch Code: {data.bankCode}</Text> : null}
        {data.bankAccountNumber ? <Text style={{ fontSize: 10 }}>Account Number: {data.bankAccountNumber}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
        {data.fpsId ? <Text style={{ fontSize: 10 }}>FPS ID: {data.fpsId}</Text> : null}
        {qrPayload ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image src={buildHKFPSQrUrl(qrPayload, 128)!} style={{ width: 96, height: 96 }} />
            <Text style={{ fontFamily: 'RobotoMono', fontSize: 9 }}>
              ↑ SCAN IN BANK APP
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 8 }}>
        <Text style={{ fontFamily: 'RobotoMono', fontSize: 10 }}>
          For the amount of: <Text style={{ fontWeight: 700 }}>{num2eng((typeof data.total === 'number' ? data.total : data.amount) ?? 0) || amountHK((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
        </Text>
        <Text style={{ fontFamily: 'Iansui', fontSize: 10 }}>茲付金額：{num2chi((typeof data.total === 'number' ? data.total : data.amount) ?? 0)}</Text>
      </View>
    </View>

    <FooterBlock data={data} />
    <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
  </Page>
)

const renderHeaderForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showClientBlock: boolean,
) => {
  if (variant === 'A') {
    return (
      <>
        <HeaderGridPage1 data={data} qrPayload={buildHKFPSPayload(data.fpsId ?? data.fpsEmail ?? null, false, null)} />
      </>
    )
  }

  return (
    <>
      <HeaderGridPage1 data={data} qrPayload={buildHKFPSPayload(data.fpsId ?? data.fpsEmail ?? null, false, null)} />
    </>
  )
}

const renderFooterForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showFooter: boolean,
  pageNumber: number,
  totalPages: number,
) => (
  <>
    {showFooter ? <ScannedFooter data={data} pageNumber={pageNumber} totalPages={totalPages} /> : null}
  </>
)

const renderItemPage = (
  data: ClassicInvoiceDocInput,
  descriptor: ItemPageDescriptor,
  pageNumber: number,
  totalPages: number,
  includeTotals: boolean,
  showFooter: boolean,
) => (
  <Page key={`items-${descriptor.variantBase}-${descriptor.pageIndex}-${pageNumber}`} size="A4" style={styles.page}>
    {renderHeaderForVariant(data, descriptor.variantBase, descriptor.pageIndex === 0)}
    <ItemsTable data={data} items={descriptor.items} />
    {includeTotals ? <Totals data={data} /> : null}
    {renderFooterForVariant(data, descriptor.variantBase, showFooter, pageNumber, totalPages)}
  </Page>
)

const buildDescriptors = (variant: ClassicInvoiceVariant, data: ClassicInvoiceDocInput): PageDescriptor[] => {
  const descriptors: PageDescriptor[] = []
  const addVariantBlock = (base: VariantBase, includePaymentDetails: boolean, includePaymentInstructions: boolean) => {
    const paginated = paginateItemsForVariant(data.items, base)
    paginated.forEach((items, pageIndex) => {
      descriptors.push({
        kind: 'items',
        variantBase: base,
        items,
        pageIndex,
        totalPagesForVariant: paginated.length,
      })
    })
    if (includePaymentDetails) descriptors.push({ kind: 'payment-details', title: 'Payment Details' })
    if (includePaymentInstructions) descriptors.push({ kind: 'payment-instructions', title: 'Payment Instructions' })
  }

  switch (variant) {
    case 'B':
      addVariantBlock('B', false, false)
      break
    case 'B2':
      addVariantBlock('B', false, true)
      break
    case 'A':
      addVariantBlock('A', true, false)
      break
    case 'A2':
      addVariantBlock('A', true, true)
      break
    case 'bundle':
    default:
      // Produce exactly 4 pages to mirror company standard:
      // 1) Invoice (variant B), 2) Invoice (variant A), 3) Payment Details, 4) Payment Instructions
      addVariantBlock('B', false, false) // Variant B items pages
      addVariantBlock('A', true, true) // Variant A items pages, plus payment details and instructions
      break
  }
  return descriptors
}

import { generatedStyles } from './generatedStyles';

export const buildClassicInvoiceDocument = (
  data: ClassicInvoiceDocInput,
  options?: { variant?: ClassicInvoiceVariant },
) => {
  const variant = options?.variant ?? 'bundle'
  const descriptors = buildDescriptors(variant, data)
  const totalPages = descriptors.length
  let pageCounter = 0

  const fpsProxyValue = data.fpsId != null ? String(data.fpsId) : (data.fpsEmail ?? null)
  const qrPayload = buildHKFPSPayload(fpsProxyValue, false, null)
  const qrPayloadWithAmount = buildHKFPSPayload(fpsProxyValue, true, data.total ?? data.amount ?? null)

  return (
    <Document>
      {descriptors.map((descriptor, idx) => {
        pageCounter += 1
        const currentPage = pageCounter
        switch (descriptor.kind) {
          case 'items': {
            const isLastPageOfVariant = descriptor.pageIndex === descriptor.totalPagesForVariant - 1
            const includeTotals = isLastPageOfVariant
            const showFooter = descriptor.variantBase === 'B' ? isLastPageOfVariant : true
            return renderItemPage(data, descriptor, currentPage, totalPages, includeTotals, showFooter)
          }
          case 'payment-details':
            return (
              <PaymentDetailsPage
                key={`payment-details-${currentPage}`}
                data={data}
                qrPayload={qrPayloadWithAmount}
                pageNumber={currentPage}
                totalPages={totalPages}
              />
            )
          case 'payment-instructions':
            return (
              <PaymentInstructionsPage
                key={`payment-instructions-${currentPage}`}
                data={data}
                qrPayload={qrPayload}
                pageNumber={currentPage}
                totalPages={totalPages}
              />
            )
          default:
            return null
        }
      })}
    </Document>
  )
}
