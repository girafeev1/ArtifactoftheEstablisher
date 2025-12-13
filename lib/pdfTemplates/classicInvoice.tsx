import { Buffer } from 'buffer'
import React from 'react'
import * as ReactPdf from '@react-pdf/renderer';
const { Document, Page, Text, View, StyleSheet, Font, Image } = ReactPdf;
import { amountHK, num2eng, num2chi } from '../invoiceFormat'
import { FONT_DATA } from './fontData';
import { readClassicSchemeSync } from './classicInvoiceScheme'

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
  // Intentionally omit remote italics by default; fontkit may reject
  // certain remote responses ("Unknown font format"). Prefer embedded
  // base64 via FONT_DATA. If italic TTFs are added to public/pdf-fonts
  // and embedded, they will be used. Otherwise we fall back to non-italic.
  RobotoMonoItalic: null as any,
  RobotoMonoBoldItalic: null as any,
  KarlaRegular: 'https://fonts.gstatic.com/s/karla/v33/qkBIXvYC6trAT55ZBi1ueQVIjQTD-JqqFA.ttf',
  KarlaItalic: 'https://fonts.gstatic.com/s/karla/v33/qkBKXvYC6trAT7RQNNK2EG7SIwPWMNlCV0lP.ttf',
  YujiMaiRegular: 'https://fonts.gstatic.com/s/yujimai/v8/ZgNQjPxdJ7DEHrS0gC38.ttf',
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
    // Prefer embedded italics; fall back to remote TTF only for italics if missing
    let r400i = pickFontSrc('RobotoMono-Italic.ttf', null)
    let r700i = pickFontSrc('RobotoMono-BoldItalic.ttf', null)
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
        // italic styles: prefer true italic files; fall back to regular/bold if missing
        { src: r400i || r400, fontWeight: 400, fontStyle: 'italic' },
        { src: r400i || r400, fontWeight: 'normal', fontStyle: 'italic' },
        { src: r700i || r700, fontWeight: 700, fontStyle: 'italic' },
        { src: r700i || r700, fontWeight: 'bold', fontStyle: 'italic' },
      ]
      Font.register({ family: 'RobotoMono', fonts })
      if (!r400i || !r700i) {
        try { console.warn('[pdf-font] RobotoMono italic TTFs not embedded; italic will render using upright glyphs') } catch {}
      }
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

  // Karla (for presenter/worktype)
  try {
    const karla400 = pickFontSrc('Karla-Regular.ttf', REMOTE_TTF.KarlaRegular)
    const karla400i = pickFontSrc('Karla-Italic.ttf', REMOTE_TTF.KarlaItalic)
    if (karla400 || karla400i) {
      const fonts: any[] = []
      if (karla400) fonts.push({ src: karla400, fontWeight: 400, fontStyle: 'normal' })
      if (karla400i) fonts.push({ src: karla400i, fontWeight: 400, fontStyle: 'italic' })
      Font.register({ family: 'Karla', fonts })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register Karla', { error: (error as any)?.message || String(error) }) } catch {}
  }

  // Yuji Mai (for CJK in project title) — only regular available; register as both 400 and 700
  try {
    const ym = pickFontSrc('YujiMai-Regular.ttf', REMOTE_TTF.YujiMaiRegular)
    if (ym) {
      Font.register({
        family: 'YujiMai',
        fonts: [
          { src: ym, fontWeight: 400, fontStyle: 'normal' },
          { src: ym, fontWeight: 700, fontStyle: 'normal' },
        ],
      })
    }
  } catch (error) {
    try { console.error('[pdf-font] failed to register YujiMai', { error: (error as any)?.message || String(error) }) } catch {}
  }

  // Removed Karla WOFF registration (unsupported format in fontkit/React-PDF). If Karla is
  // required later, embed a TTF as base64 in FONT_DATA or use a valid TTF URL.
}

registerFontFamily()

const PAGE_WIDTH = 595.28 // A4 width in points
const PAGE_HEIGHT = 841.89
const PAGE_MARGIN = { top: 14.4, bottom: 14.4, left: 21.6, right: 21.6 } // top/bottom 0.2", left/right 0.3"
const px2pt = (px: number) => px * 0.75;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN.left - PAGE_MARGIN.right
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_MARGIN.top - PAGE_MARGIN.bottom

let COLS_PT: number[] = []
let ROWS_PT_RAW: number[] = []
let ROW_OFFSETS_PT: number[] = []
// PAGE1_ROWS_PT / HEADER1_COLS_PT and their offsets are populated once layout is initialized.
let COL_OFFSETS_PT: number[] = []
let PAGE1_ROWS_PT: number[] = []
let HEADER1_COLS_PT: number[] = []
let header1ColOffsets: number[] = []
let page1RowOffsets: number[] = []
let ROWS_FOOTER_PT_RAW: number[] = [12, 15.75, 12, 15.75, 12, 15.75, 12, 15.75, 15, 15.75]
let ROWS_FOOTER_PT: number[] = []
let FONT_SCALE = 1

type CellMeta = {
  value?: string | number | boolean
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  color?: { red?: number; green?: number; blue?: number; alpha?: number }
  backgroundColor?: { red?: number; green?: number; blue?: number; alpha?: number }
  hAlign?: 'LEFT' | 'CENTER' | 'RIGHT'
  vAlign?: 'TOP' | 'MIDDLE' | 'BOTTOM'
  wrapStrategy?: string
  textRotationDeg?: number
  runs?: Array<{
    text: string
    fontFamily?: string
    fontSize?: number
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strikethrough?: boolean
    color?: { red?: number; green?: number; blue?: number; alpha?: number }
  }>
}

type MergeSpan = { r1: number; r2: number; c1: number; c2: number }

let CELL_META: Record<string, CellMeta> = {}
let MERGE_SPANS: MergeSpan[] = []

const cellKey = (r1: number, c1: number) => `${r1}:${c1}`

const getCellMeta = (r1: number, c1: number): CellMeta | undefined =>
  CELL_META[cellKey(r1, c1)]

const findMergeForCell = (r1: number, c1: number): MergeSpan | undefined =>
  MERGE_SPANS.find((m) => r1 >= m.r1 && r1 <= m.r2 && c1 >= m.c1 && c1 <= m.c2)

const normalizeHAlign = (value: unknown): CellMeta['hAlign'] | undefined => {
  if (value === 'LEFT' || value === 'CENTER' || value === 'RIGHT') return value
  return undefined
}

const normalizeVAlign = (value: unknown): CellMeta['vAlign'] | undefined => {
  if (value === 'TOP' || value === 'MIDDLE' || value === 'BOTTOM') return value
  return undefined
}

// Normalize font family names coming from Google Sheets to registered PDF fonts.
const normalizeFontFamily = (input?: string | null): string | undefined => {
  if (!input) return undefined
  // Strip surrounding quotes and split on commas; take the first token
  const first = input.replace(/^["']|["']$/g, '').split(',')[0]?.trim().toLowerCase()
  if (!first) return undefined
  if (first.includes('roboto mono')) return 'RobotoMono'
  if (first.includes('cormorant')) return 'CormorantInfant'
  if (first.includes('iansui')) return 'Iansui'
  if (first.includes('yuji mai')) return 'YujiMai'
  if (first.includes('karla')) return 'Karla'
  if (first.includes('varela')) return 'VarelaRound'
  if (first.includes('rampart')) return 'RampartOne'
  // Default to RobotoMono to avoid missing font registration errors
  return 'RobotoMono'
}

const footerRowOffset = (row: number) =>
  ROWS_FOOTER_PT.slice(0, row).reduce((sum, h) => sum + h, 0)

const getLayoutHelpers = () => {
  // Single source of truth for all row/column derived geometry. This is called
  // after `initializeLayout` has populated COLS_PT and ROWS_PT_RAW.
  const rowsForPage = ROWS_PT_RAW.slice(0, Math.min(57, ROWS_PT_RAW.length))
  const rawTotal = rowsForPage.reduce((sum, h) => sum + h, 0)
  // If the sheet is taller than the printable area, scale everything down uniformly
  const ROW_SCALE =
    rawTotal > 0 && rawTotal > CONTENT_HEIGHT
      ? CONTENT_HEIGHT / rawTotal
      : 1
  const ROWS_PT = ROWS_PT_RAW.map((v) => v * ROW_SCALE)

  // Column / row offsets for the full sheet
  ROW_OFFSETS_PT = ROWS_PT.reduce((acc: number[], h, i) => {
    acc[i] = (acc[i - 1] || 0) + h
    return acc
  }, [])
  COL_OFFSETS_PT = COLS_PT.reduce((acc: number[], w, i) => {
    acc[i] = (acc[i - 1] || 0) + w
    return acc
  }, [])

  // Header / page 1 specific geometry (rows 1..57; header uses 1..15)
  PAGE1_ROWS_PT = ROWS_PT.slice(0, 57)
  HEADER1_COLS_PT = COLS_PT.slice()
  header1ColOffsets = HEADER1_COLS_PT.reduce((acc: number[], w, i) => {
    acc[i] = (acc[i - 1] || 0) + w
    return acc
  }, [])
  page1RowOffsets = PAGE1_ROWS_PT.reduce((acc: number[], h, i) => {
    acc[i] = (acc[i - 1] || 0) + h
    return acc
  }, [])

  // Footer rows use the same scale factor.
  ROWS_FOOTER_PT = ROWS_FOOTER_PT_RAW.map((v) => v * ROW_SCALE)

  const colLeft1 = (c1: number) => (c1 <= 1 ? 0 : COL_OFFSETS_PT[c1 - 2])
  const colWidth1 = (c1: number, colSpan = 1) =>
    COLS_PT.slice(c1 - 1, c1 - 1 + colSpan).reduce((s, v) => s + v, 0)
  const rowTop1 = (r1: number) => (r1 <= 1 ? 0 : ROW_OFFSETS_PT[r1 - 2])
  const rowHeight1 = (r1: number, rowSpan = 1) =>
    ROWS_PT.slice(r1 - 1, r1 - 1 + rowSpan).reduce((s, v) => s + v, 0)
  const alignY = (
    r1: number,
    fontSize: number,
    vAlign: 'TOP' | 'MIDDLE' | 'BOTTOM' | null | undefined,
    rowSpan = 1
  ) => {
    const top = rowTop1(r1)
    const height = rowHeight1(r1, rowSpan)
    if (vAlign === 'BOTTOM') return top + height - fontSize
    if (vAlign === 'MIDDLE') return top + (height - fontSize) / 2
    return top
  }
  return { colLeft1, colWidth1, rowTop1, rowHeight1, alignY }
}

const initializeLayout = (sheetData: any) => {
  // Reset derived meta each time we build a document so we don't leak
  // information between different invoices.
  CELL_META = {}
  MERGE_SPANS = []

  // Prefer a locally cached scheme (generated via the dev-only import
  // endpoint) when available so that we do not need to depend on the live
  // spreadsheet at runtime once the layout is tuned.
  try {
    const scheme = readClassicSchemeSync()
    if (scheme && scheme.rowHeightsPx.length > 0 && scheme.columnWidthsPx.length > 0) {
      const rawCols = scheme.columnWidthsPx.slice()
      const totalWidth = rawCols.reduce((sum: number, w: number) => sum + w, 0) || 1
      const scale = CONTENT_WIDTH / totalWidth
      FONT_SCALE = scale
      COLS_PT = rawCols.map((w: number) => w * scale)
      ROWS_PT_RAW = scheme.rowHeightsPx.map((px) => px2pt(px || 0))

      const toColor = (src: any) => {
        if (!src) return undefined
        const { red, green, blue, alpha } = src
        if (red == null && green == null && blue == null && alpha == null) return undefined
        return { red, green, blue, alpha }
      }

      Object.entries(scheme.cells).forEach(([key, metaRaw]) => {
        const [rStr, cStr] = key.split(":")
        const r1 = Number(rStr)
        const c1 = Number(cStr)
        if (!Number.isFinite(r1) || !Number.isFinite(c1) || r1 <= 0 || c1 <= 0) {
          return
        }
        const meta: CellMeta = {}
        if (metaRaw.value !== undefined) meta.value = metaRaw.value as any
        if (metaRaw.fontFamily) meta.fontFamily = normalizeFontFamily(metaRaw.fontFamily)
        if (metaRaw.hAlign) meta.hAlign = normalizeHAlign(metaRaw.hAlign)
        if (metaRaw.vAlign) meta.vAlign = normalizeVAlign(metaRaw.vAlign)
        if (metaRaw.fontSize != null) meta.fontSize = metaRaw.fontSize * FONT_SCALE
        if (metaRaw.bold) meta.bold = true
        if (metaRaw.italic) meta.italic = true
        if ((metaRaw as any).underline) meta.underline = true
        if ((metaRaw as any).strikethrough) meta.strikethrough = true
        if ((metaRaw as any).wrapStrategy) meta.wrapStrategy = (metaRaw as any).wrapStrategy
        if ((metaRaw as any).textRotationDeg != null) meta.textRotationDeg = (metaRaw as any).textRotationDeg
        if ((metaRaw as any).color) meta.color = toColor((metaRaw as any).color)
        if ((metaRaw as any).backgroundColor) meta.backgroundColor = toColor((metaRaw as any).backgroundColor)
        if ((metaRaw as any).runs) meta.runs = (metaRaw as any).runs as any
        if (Object.keys(meta).length) {
          CELL_META[cellKey(r1, c1)] = meta
        }
      })

      MERGE_SPANS = (scheme.merges || []).map((m) => ({
        r1: m.r1,
        r2: m.r2,
        c1: m.c1,
        c2: m.c2,
      }))

      return
    }
  } catch {
    // Ignore scheme read failures; fall back to sheet data / hard-coded layout.
  }

  if (sheetData && sheetData.data?.[0]?.columnMetadata && sheetData.data?.[0]?.rowMetadata) {
    const rawCols = sheetData.data[0].columnMetadata.map((m: any) => m.pixelSize || 0)
    const totalWidth = rawCols.reduce((sum: number, w: number) => sum + w, 0)
    const scale = totalWidth > 0 ? CONTENT_WIDTH / totalWidth : 1
    FONT_SCALE = scale
    COLS_PT = rawCols.map((w: number) => w * scale)
    ROWS_PT_RAW = sheetData.data[0].rowMetadata.map((m: any) => px2pt(m.pixelSize || 0))

    // Capture per‑cell formatting meta (alignment, font) for later use when
    // positioning labels/values so that we stay faithful to the sheet design.
    const grid = sheetData.data[0]
    grid.rowData?.forEach((row: any, rIdx: number) => {
      const r1 = rIdx + 1
      row.values?.forEach((cell: any, cIdx: number) => {
        const c1 = cIdx + 1
        const fmt = cell.effectiveFormat
        if (!fmt) return
        const meta: CellMeta = {}
        if (cell.effectiveValue) {
          const value = Object.values(cell.effectiveValue)[0]
          meta.value = value as any
        }
        if (fmt.textFormat?.fontFamily) meta.fontFamily = fmt.textFormat.fontFamily
        if (fmt.horizontalAlignment) meta.hAlign = fmt.horizontalAlignment as any
        if (fmt.verticalAlignment) meta.vAlign = fmt.verticalAlignment as any
        if (fmt.textFormat?.fontSize != null) meta.fontSize = fmt.textFormat.fontSize * FONT_SCALE
        if (fmt.textFormat?.bold) meta.bold = true
        if (fmt.textFormat?.italic) meta.italic = true
        if (fmt.textFormat?.underline) meta.underline = true
        if (fmt.textFormat?.strikethrough) meta.strikethrough = true
        if (fmt.wrapStrategy) meta.wrapStrategy = fmt.wrapStrategy
        if (Object.keys(meta).length) {
          CELL_META[cellKey(r1, c1)] = meta
        }
      })
    })

    // Capture merge spans so we can reason about merged regions when needed.
    sheetData.merges?.forEach((m: any) => {
      const r1 = (m.startRowIndex ?? 0) + 1
      const r2 = (m.endRowIndex ?? r1) // end index is exclusive in API
      const c1 = (m.startColumnIndex ?? 0) + 1
      const c2 = (m.endColumnIndex ?? c1)
      MERGE_SPANS.push({ r1, r2, c1, c2 })
    })
  } else {
    // Fallback to hardcoded values if sheetData is not available
    COLS_PT = [
      32.4753, 16.9142, 24.3565, 81.1882, 20.2971, 60.8912, 50.7426, 50.7426,
      50.0661, 27.0627, 23.6799, 13.5314, 13.5314, 86.6008,
    ]
    ROWS_PT_RAW = [
      23.25, 13.5, 13.5, 13.5, 12, 12, 12, 24, 13.5, 14.25, 14.25, 14.25,
      15.75, 15.75, 15.75, 15.75, 12.75, 44.4, 15.75, 15.75, 15.75, 15.75,
      15.75, 15.75, 25, 15.75, 17.25, 13.5, 35, 15.75, 15.75, 15.75, 15.75,
      15.75, 15.75, 16.5, 15.75, 15.75, 15.75, 17.25, 16.5, 21.75, 15.75,
      15.75, 15.75, 15.75, 15.75, 12, 15.75, 12, 15.75, 12, 15.75, 12, 15.75,
      15, 15.75,
    ]
  }
}


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

type BuildOptions = { variant?: ClassicInvoiceVariant; showGrid?: boolean; showBlocks?: boolean; showLabels?: boolean }

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

const a1ToRectPage1 = (colIndex1: number, rowIndex1: number, colSpan = 1, rowSpan = 1) => {
  const c0 = colIndex1 - 1
  const r0 = rowIndex1 - 1
  const left = (c0 > 0 ? header1ColOffsets[c0 - 1] : 0)
  const top = (r0 > 0 ? page1RowOffsets[r0 - 1] : 0)
  const width = HEADER1_COLS_PT.slice(c0, c0 + colSpan).reduce((s, v) => s + v, 0)
  const height = PAGE1_ROWS_PT.slice(r0, r0 + rowSpan).reduce((s, v) => s + v, 0)
  return { left, top, width, height }
}

const GridOverlay = ({ height, showRows, showLabels }: { height: number; showRows?: boolean; showLabels?: boolean }) => (
  <View style={{ position: 'absolute', left: 0, top: 0, width: CONTENT_WIDTH, height }}>
    {COL_OFFSETS_PT.map((x, idx) => (
      <View key={`v-${idx}`} style={{ position: 'absolute', left: x, top: 0, width: 0.5, height, backgroundColor: 'rgba(0,0,255,0.2)' }} />
    ))}
    {showRows
      ? [0, ...ROW_OFFSETS_PT.filter((y) => y <= height)].map((y, idx) => (
          <View key={`h-${idx}`} style={{ position: 'absolute', left: 0, top: y, height: 0.5, width: CONTENT_WIDTH, backgroundColor: 'rgba(255,0,0,0.2)' }} />
        ))
      : null}
    {showLabels ? (
      <>
        {COL_OFFSETS_PT.map((x, idx) => (
          <Text key={`cl-${idx}`} style={{ position: 'absolute', left: x + 2, top: 0, fontSize: 6, color: '#2563eb' }}>
            {String.fromCharCode(65 + idx)}
          </Text>
        ))}
        {[0, ...ROW_OFFSETS_PT.filter((y) => y <= height)].map((y, idx) => (
          <Text key={`rl-${idx}`} style={{ position: 'absolute', left: 0, top: y + 1, fontSize: 6, color: '#dc2626' }}>
            {idx + 1}
          </Text>
        ))}
      </>
    ) : null}
  </View>
)

const BlocksOverlay = ({ show, layoutHelpers }: { show?: boolean; layoutHelpers: ReturnType<typeof getLayoutHelpers> }) => {
  if (!show) return null
  const { colLeft1, colWidth1, rowTop1, rowHeight1 } = layoutHelpers
  const blocks = [
    { name: 'Header band', col: 1, colSpan: 14, row: 1, rowSpan: 6, color: 'rgba(59,130,246,0.08)' },
    { name: 'Project meta', col: 1, colSpan: 9, row: 17, rowSpan: 3, color: 'rgba(16,185,129,0.08)' },
    { name: 'Items header', col: 1, colSpan: 14, row: 23, rowSpan: 1, color: 'rgba(234,179,8,0.1)' },
    { name: 'Items row', col: 1, colSpan: 14, row: 27, rowSpan: 1, color: 'rgba(234,88,12,0.08)' },
    { name: 'Totals box', col: 7, colSpan: 8, row: 41, rowSpan: 3, color: 'rgba(139,92,246,0.1)' },
    { name: 'Footer', col: 1, colSpan: 14, row: 52, rowSpan: 3, color: 'rgba(148,163,184,0.08)' },
  ]
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>
      {blocks.map((b) => {
        const left = colLeft1(b.col)
        const top = rowTop1(b.row)
        const width = colWidth1(b.col, b.colSpan)
        const height = rowHeight1(b.row, b.rowSpan)
        return (
          <View key={b.name} style={{ position: 'absolute', left, top, width, height, backgroundColor: b.color, borderWidth: 0.5, borderColor: '#94a3b8' }}>
            <Text style={{ fontSize: 7, color: '#0f172a', opacity: 0.8, margin: 2 }}>{b.name}</Text>
          </View>
        )
      })}
    </View>
  )
}

const HeaderGridPage1 = ({ data, qrPayload, showGrid }: { data: ClassicInvoiceDocInput; qrPayload: string | null; showGrid?: boolean }) => {
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
    // Header band sized to the content area; all coords relative to (0,0)
    <View style={{ position: 'relative', height: page1Height, width: CONTENT_WIDTH }}>
      {showGrid ? <GridOverlay height={page1Height} showRows /> : null}
      {/* E. logo aligned with row 1 top (adjusted for sheet row height) */}
      {(() => {
        const r = toCell(1, 1)
        return (
          <Text style={{ position: 'absolute', left: 0, top: r.top - 20, fontFamily: 'RampartOne', fontSize: 56 }}>E.</Text>
        )
      })()}
      {/* Subsidiary English + Chinese across J1..N1 (merge) */}
      {(() => {
        const r = toCell(10, 1, 5, 1)
        return (
          <View style={{ position: 'absolute', left: r.left, top: r.top, width: r.width }}>
            <Text style={{ fontFamily: 'CormorantInfant', fontSize: 9.5, fontWeight: 700, textAlign: 'right' }}>{spacify(data.subsidiaryEnglishName ?? 'Establish Records Limited')}</Text>
            {data.subsidiaryChineseName ? (
              <Text style={{ fontFamily: 'Iansui', fontSize: 9.5, textAlign: 'right' }}>{spacify(data.subsidiaryChineseName)}</Text>
            ) : null}
          </View>
        )
      })()}
      {/* Address J2..J5 merged across J..N */}
      {(() => {
        const r = toCell(10, 2, 5, 4)
        return (
          <View style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, height: r.height }}>
            {renderAddressLines((data.subsidiaryAddressLines ?? []), { fontFamily: 'CormorantInfant', fontSize: 7, textAlign: 'right' })}
          </View>
        )
      })()}
      {/* Email + Phone J5 across J..N */}
      {(() => {
        const r = toCell(10, 5, 5, 1)
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
            {lines[0] ? <Text style={{ position: 'absolute', left: a9.left, top: a9.top, width: a9.width, overflow: 'hidden' }}>{lines[0]}</Text> : null}
            {lines[1] ? <Text style={{ position: 'absolute', left: a10.left, top: a10.top, width: a10.width, overflow: 'hidden' }}>{lines[1]}</Text> : null}
            {lines[2] ? <Text style={{ position: 'absolute', left: a11.left, top: a11.top, width: a11.width, overflow: 'hidden' }}>{lines[2]}</Text> : null}
          </View>
        )
      })()}
      {(() => {
        const a13 = toCell(1, 13, 6, 1)
        return data.representative ? (
          <Text style={{ position: 'absolute', left: a13.left, top: a13.top, fontFamily: 'RobotoMono', fontSize: 9 }}>
            <Text style={{ fontWeight: 700, fontStyle: 'italic' }}>ATTN: </Text>
            <Text style={{ fontWeight: 700, fontStyle: 'normal' }}>{data.representative}</Text>
          </Text>
        ) : null
      })()}
      {/* Invoice L7, labels and values N10/M11, N12/L13, FPS at N15 with QR */}
      {(() => {
        const r = toCell(12, 7, 3, 1) // L..N merged
        return (
          <Text style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, textAlign: 'center', fontFamily: 'EB Garamond', fontSize: 35, fontWeight: 700 }}>Invoice</Text>
        )
      })()}
      {(() => {
        const invLabel = toCell(13, 10, 2, 1) // M..N merged for label
        const invValue = toCell(12, 11, 3, 1) // L..N merged for value
        const dateLabel = toCell(13, 12, 2, 1)
        const dateValue = toCell(12, 13, 3, 1)
        const fpsLabel = toCell(14, 15)
        const fpsQrTop = fpsLabel.top + PAGE1_ROWS_PT[14] - 2 // next line below label, slight nudge
        return (
          <View>
            <Text style={{ position: 'absolute', left: invLabel.left, top: invLabel.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: invLabel.width, overflow: 'hidden' }}>Invoice #:</Text>
            <Text style={{ position: 'absolute', left: invValue.left, top: invValue.top, fontFamily: 'RobotoMono', fontSize: 9, fontWeight: 700, textAlign: 'right', width: invValue.width, overflow: 'hidden' }}>#{data.invoiceNumber}</Text>
            <Text style={{ position: 'absolute', left: dateLabel.left, top: dateLabel.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: dateLabel.width, overflow: 'hidden' }}>Issued Date:</Text>
            <Text style={{ position: 'absolute', left: dateValue.left, top: dateValue.top, fontFamily: 'RobotoMono', fontSize: 9, fontWeight: 700, textAlign: 'right', width: dateValue.width, overflow: 'hidden' }}>{formatDate(data.invoiceDateDisplay)}</Text>
            <Text style={{ position: 'absolute', left: fpsLabel.left, top: fpsLabel.top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic', textAlign: 'right', width: fpsLabel.width, overflow: 'hidden' }}>FPS:</Text>
            {qrPayload ? (
              <Image src={buildHKFPSQrUrl(qrPayload, 128)!} style={{ position: 'absolute', left: fpsLabel.left - 64 + fpsLabel.width, top: fpsQrTop, width: 64, height: 64 }} />
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

const ProjectMeta = ({ data, layoutHelpers }: { data: ClassicInvoiceDocInput, layoutHelpers: any }) => {
  const { colLeft1, rowTop1 } = layoutHelpers;
  const splitRuns = (txt: string) => {
    const runs: { isCjk: boolean; txt: string }[] = []
    let buf = ''
    let mode: boolean | null = null
    for (const ch of txt) {
      const isCjk = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(ch)
      if (mode === null) {
        mode = isCjk; buf = ch; continue
      }
      if (isCjk === mode) buf += ch
      else { runs.push({ isCjk: mode, txt: buf }); buf = ch; mode = isCjk }
    }
    if (buf) runs.push({ isCjk: mode ?? false, txt: buf })
    return runs
  }

  const renderMixed = (txt: string, cjkFont: string, latinFont: string, baseStyle: any) => (
    <Text style={baseStyle}>
      {splitRuns(txt).map((r, idx) => (
        <Text key={idx} style={{ fontFamily: r.isCjk ? cjkFont : latinFont }}>{r.txt}</Text>
      ))}
    </Text>
  )

  const left = colLeft1(1)
  const width = colLeft1(10) - left
  const row17Top = rowTop1(17)
  const row18Top = rowTop1(18)
  const row19Top = rowTop1(19)

  return (
    <View style={{ position: 'absolute', left, top: row17Top, width }}>
      {data.presenterWorkType ? (
        renderMixed(data.presenterWorkType, 'Iansui', 'Karla', { fontSize: 9 })
      ) : null}
      {data.projectTitle ? (
        <View style={{ position: 'absolute', left: -5, top: row18Top - row17Top, width }}>
          {renderMixed(data.projectTitle, 'YujiMai', 'Karla', { fontSize: 24, fontWeight: 'bold' })}
        </View>
      ) : null}
      {data.projectNature ? (
        <Text style={{ position: 'absolute', left: 0, top: row19Top - row17Top, fontFamily: 'RobotoMono', fontSize: 8, fontStyle: 'italic' }}>
          {data.projectNature}
        </Text>
      ) : null}
    </View>
  )
}

const ItemsTable = ({ data, items, layoutHelpers }: { data: ClassicInvoiceDocInput; items: ClassicInvoiceItem[], layoutHelpers: any }) => {
  const { rowTop1, rowHeight1 } = layoutHelpers;
  const headerRow = 23
  const headerHeight = rowHeight1(headerRow) // follow sheet row height

  const item = items[0] || {}
  const bindings = buildTokenBindings(data, { item })

  // Use global coordinates for header and item rows so they align directly
  // with the scheme's grid (rows 23, 27, 28).
  const headerNodes = renderRangeFromScheme(headerRow, headerRow, 1, 14, bindings, layoutHelpers)
  const itemNodes = renderRangeFromScheme(27, 28, 1, 14, bindings, layoutHelpers)

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: rowTop1(headerRow),
          width: CONTENT_WIDTH,
          height: headerHeight,
          borderTopWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: '#0f172a',
        }}
      >
        {headerNodes}
      </View>

      {/* Item rows from scheme (rows 27–28) */}
      {itemNodes}
    </View>
  )
}

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

const Totals = ({ data, layoutHelpers }: { data: ClassicInvoiceDocInput, layoutHelpers: any }) => {
  const { colLeft1, rowTop1, colWidth1, rowHeight1 } = layoutHelpers;
  const { subtotal, total } = computeTotals(data)
  const boxLeft = colLeft1(7) // merged G..N in sheet
  const boxTop = rowTop1(41)
  const boxWidth = colWidth1(7, 8) // cols 7..14
  const boxHeight = rowHeight1(41, 3) // rows 41..43

  const bindings = {
    ...buildBindings(data, total),
    InvoiceTotalNumeric: total.toFixed(2),
  }

  const nodes = renderRangeFromScheme(41, 43, 7, 14, bindings, layoutHelpers)

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CONTENT_WIDTH,
        height: CONTENT_HEIGHT,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: boxLeft,
          top: boxTop,
          width: boxWidth,
          height: boxHeight,
          borderWidth: 1.5,
          borderColor: '#0f172a',
        }}
      />
      {nodes}
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

// Generic token replacement using bindings map
const replaceTokens = (text: string, bindings: Record<string, string | number | null | undefined>) => {
  return text.replace(/<([^>]+)>/g, (_, token) => {
    const key = token.trim()
    const val = bindings[key]
    if (val === null || val === undefined) return ''
    if (typeof val === 'number') return String(val)
    return String(val)
  })
}

// Render a single cell using scheme meta (value/runs/fonts/align)
const renderCellFromScheme = (
  row: number,
  col: number,
  meta: CellMeta,
  bindings: Record<string, string | number | null | undefined>,
  layoutHelpers: any,
) => {
  const { colLeft1, colWidth1, alignY } = layoutHelpers
  const merge = findMergeForCell(row, col)
  const rowSpan = merge ? merge.r2 - merge.r1 + 1 : 1
  const colSpan = merge ? merge.c2 - merge.c1 + 1 : 1

  const baseFontSize = meta.fontSize ?? 10
  const vAlign: 'TOP' | 'MIDDLE' | 'BOTTOM' =
    meta.vAlign === 'MIDDLE' ? 'MIDDLE' : meta.vAlign === 'BOTTOM' ? 'BOTTOM' : 'TOP'
  const top = alignY(row, baseFontSize, vAlign, rowSpan)
  const left = colLeft1(col)
  const width = colWidth1(col, colSpan)
  const textAlign =
    meta.hAlign === 'RIGHT' ? 'right' : meta.hAlign === 'CENTER' ? 'center' : 'left'
  // Honour the sheet's wrap strategy: OVERFLOW / CLIP should render on a single
  // line (no wrapping) while WRAP may break across lines.
  const shouldWrap =
    !meta.wrapStrategy ||
    meta.wrapStrategy === 'WRAP' ||
    meta.wrapStrategy === 'WRAP_STRATEGY_UNSPECIFIED'

  // Build runs: if meta.runs exists, use it; otherwise a single run from value.
  const runs =
    meta.runs && meta.runs.length > 0
      ? meta.runs
      : meta.value != null
        ? [{ text: String(meta.value) }]
        : []

  if (runs.length === 0) return null

  return (
    <Text
      key={`${row}-${col}`}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        fontSize: baseFontSize,
        textAlign,
      }}
      wrap={shouldWrap}
      hyphenationCallback={(word) => [word]}
    >
      {runs.map((run, idx) => {
        const text = replaceTokens(run.text, bindings)
        if (!text) return null
        const runStyle: any = {}
        if (run.fontFamily || meta.fontFamily) runStyle.fontFamily = normalizeFontFamily(run.fontFamily ?? meta.fontFamily)
        if (run.fontSize || meta.fontSize) runStyle.fontSize = run.fontSize ?? meta.fontSize
        if (run.bold || meta.bold) runStyle.fontWeight = (run.bold ?? meta.bold) ? 700 : undefined
        if (run.italic || meta.italic) runStyle.fontStyle = (run.italic ?? meta.italic) ? 'italic' : 'normal'
        if (run.underline || meta.underline) runStyle.textDecoration = 'underline'
        if (run.strikethrough || meta.strikethrough) runStyle.textDecoration = 'line-through'
        return (
          <Text key={idx} style={runStyle}>
            {text}
          </Text>
        )
      })}
    </Text>
  )
}

// Build a bindings map for common footer fields from invoice data.
const buildBindings = (data: ClassicInvoiceDocInput, total: number) => {
  // Split bank account number into parts if possible
  const acct = data.bankAccountNumber ?? ''
  const acctParts = acct.split(/[-\s]/).filter(Boolean)
  const acctPart1 = acctParts[0] ?? acct
  const acctPart2 = acctParts[1] ?? ''
  return {
    SubsidiaryEnglishName: data.subsidiaryEnglishName,
    SubsidiaryChineseName: data.subsidiaryChineseName,
    SubsidiaryAddressLine1: data.subsidiaryAddressLines?.[0],
    SubsidiaryAddressLine2: data.subsidiaryAddressLines?.[1],
    SubsidiaryAddressLine3: data.subsidiaryAddressLines?.[2],
    SubsidiaryRegion: data.subsidiaryAddressLines?.[3],
    InvoiceTotalEnglish: num2eng(total),
    InvoiceTotalChinese: num2chi(total),
    InvoiceTotalNumeric: total.toFixed(2),
    BankName: data.bankName,
    BankCode: data.bankCode,
    BankAccountNumber: acct,
    BankAccountNumberPart1: acctPart1,
    BankAccountNumberPart2: acctPart2,
    FPSId: data.fpsId,
  }
}

// Build a unified bindings map for all known tokens
const buildTokenBindings = (
  data: ClassicInvoiceDocInput,
  opts?: { item?: ClassicInvoiceItem; pageNumber?: number; totalPages?: number },
) => {
  const item = opts?.item ?? data.items?.[0] ?? {}
  const { subtotal, total } = computeTotals(data)

  const acct = data.bankAccountNumber ?? ''
  const acctParts = acct.split(/[-\s]/).filter(Boolean)
  const acctPart1 = acctParts[0] ?? acct
  const acctPart2 = acctParts[1] ?? ''

  const formatDate = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return {
    // Subsidiary
    SubsidiaryEnglishName: data.subsidiaryEnglishName ?? '',
    SubsidiaryChineseName: data.subsidiaryChineseName ?? '',
    SubsidiaryAddressLine1: data.subsidiaryAddressLines?.[0] ?? '',
    SubsidiaryAddressLine2: data.subsidiaryAddressLines?.[1] ?? '',
    SubsidiaryAddressLine3: data.subsidiaryAddressLines?.[2] ?? '',
    SubsidiaryRegion: data.subsidiaryAddressLines?.[3] ?? '',
    SubsidiaryBRNumber: '', // not available in data
    SubsidiaryEmail: data.subsidiaryEmail ?? '',
    SubsidiaryPhone: data.subsidiaryPhone ?? '',

    // Client
    ClientCompanyName: data.companyName ?? '',
    ClientAddressLine1: data.addressLine1 ?? '',
    ClientAddressLine2: data.addressLine2 ?? '',
    ClientAddressLine3: data.addressLine3 ?? '',
    ClientRegion: data.region ?? '',
    ClientRepresentativeName: data.representative ?? '',
    ClientRepresentativeTitle: data.representative ?? '',

    // Project
    PresenterWorkType: data.presenterWorkType ?? '',
    ProjectTitle: data.projectTitle ?? '',
    ProjectNature: data.projectNature ?? '',

    // Invoice
    InvoiceNumber: data.invoiceNumber ?? '',
    InvoiceDate: formatDate(data.invoiceDateDisplay),
    InvoiceTotalNumeric: total.toFixed(2),
    InvoiceTotalEnglish: num2eng(total) ?? '',
    InvoiceTotalChinese: num2chi(total) ?? '',

    // Items (first item only for now)
    ItemTitle: item.title ?? '',
    ItemFeeType: item.feeType ?? '',
    ItemFeeNote: item.notes ?? item.feeType ?? '',
    ItemNote: item.notes ?? '',
    ItemUnitPrice: item.unitPrice ?? 0,
    ItemQuantity: item.quantity ?? 0,
    ItemQuantityUnit: item.quantityUnit ?? '',
    ItemSubQuantity: item.subQuantity ?? '',
    ItemLineTotal: ((item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discount ?? 0)) || 0,

    // Bank / FPS
    BankName: data.bankName ?? '',
    BankCode: data.bankCode ?? '',
    BankAccountNumber: acct,
    BankAccountNumberPart1: acctPart1,
    BankAccountNumberPart2: acctPart2,
    FPSId: data.fpsId ?? '',
    FPSQRCode: data.fpsId ?? data.fpsEmail ?? '',
    'FPS QR Code': data.fpsId ?? data.fpsEmail ?? '',

    // Page info
    PageNumber: opts?.pageNumber ?? '',
    PageTotal: opts?.totalPages ?? '',
  }
}

// Render all cells in a range using the scheme meta and token bindings
const renderRangeFromScheme = (
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number,
  bindings: Record<string, string | number | null | undefined>,
  layoutHelpers: any,
) => {
  const nodes: React.ReactNode[] = []
  for (let r = fromRow; r <= toRow; r += 1) {
    for (let c = fromCol; c <= toCol; c += 1) {
      const merge = findMergeForCell(r, c)
      if (merge && (merge.r1 !== r || merge.c1 !== c)) continue
      const meta = getCellMeta(r, c)
      if (!meta) continue
      const rendered = renderCellFromScheme(r, c, meta, bindings, layoutHelpers)
      if (rendered) nodes.push(rendered)
    }
  }
  return nodes
}

// Footer rendered directly from scheme cells (Instruction A48:N57)
const SchemeFooter = ({
  data,
  pageNumber,
  totalPages,
  layoutHelpers,
}: {
  data: ClassicInvoiceDocInput
  pageNumber: number
  totalPages: number
  layoutHelpers: any
}) => {
  const { colLeft1, colWidth1, alignY } = layoutHelpers
  const { total } = computeTotals(data)
  const bindings = {
    ...buildBindings(data, total),
    PageNumber: pageNumber,
    PageTotal: totalPages,
  }

  const nodes = renderRangeFromScheme(48, 57, 1, 14, bindings, layoutHelpers)

  // Fallback page number if no token existed
  const metaPage = getCellMeta(57, 1)
  if (metaPage && (!metaPage.value || String(metaPage.value).includes('<PageNumber>'))) {
    const top = alignY(57, metaPage.fontSize ?? 8, metaPage.vAlign ?? 'TOP')
    nodes.push(
      <Text
        key="page-number-fallback"
        style={{
          position: 'absolute',
          left: colLeft1(1),
          width: colWidth1(1, 14),
          top,
          fontSize: metaPage.fontSize ?? 8,
          textAlign: 'center',
        }}
      >
        Page {pageNumber} of {totalPages}
      </Text>,
    )
  }

  return <View style={{ position: 'absolute', left: 0, top: 0, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>{nodes}</View>
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
  // Coerce to string and trim; accept numeric IDs as well
  const inputStr = typeof fpsProxyValue === 'string' ? fpsProxyValue : (fpsProxyValue != null ? String(fpsProxyValue) : '')
  const raw = inputStr.trim()
  if (!raw) return null
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
  showGrid,
  showLabels,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
  showGrid?: boolean
  showLabels?: boolean
}) => {
  const qrUrl = buildHKFPSQrUrl(qrPayload, 240)
  return (
    <Page size="A4" style={styles.page}>
      <View style={{ position: 'absolute', left: PAGE_MARGIN.left, top: PAGE_MARGIN.top, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>
        {showGrid ? <GridOverlay height={CONTENT_HEIGHT} showRows showLabels={showLabels} /> : null}
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
      </View>
      <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
    </Page>
  )
}

const PaymentInstructionsPage = ({
  data,
  qrPayload,
  pageNumber,
  totalPages,
  showGrid,
  showLabels,
}: {
  data: ClassicInvoiceDocInput
  qrPayload: string | null
  pageNumber: number
  totalPages: number
  showGrid?: boolean
  showLabels?: boolean
}) => (
  <Page size="A4" style={styles.page}>
    <View style={{ position: 'absolute', left: PAGE_MARGIN.left, top: PAGE_MARGIN.top, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>
      {showGrid ? <GridOverlay height={CONTENT_HEIGHT} showRows showLabels={showLabels} /> : null}
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
    </View>
    <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
  </Page>
)

const renderHeaderForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showClientBlock: boolean,
  showGrid?: boolean,
) => {
  if (variant === 'A') {
    return (
      <>
        <HeaderGridPage1 data={data} qrPayload={buildHKFPSPayload(data.fpsId ?? data.fpsEmail ?? null, false, null)} showGrid={showGrid} />
      </>
    )
  }

  return (
    <>
      <HeaderGridPage1 data={data} qrPayload={buildHKFPSPayload(data.fpsId ?? data.fpsEmail ?? null, false, null)} showGrid={showGrid} />
    </>
  )
}

const renderFooterForVariant = (
  data: ClassicInvoiceDocInput,
  variant: VariantBase,
  showFooter: boolean,
  pageNumber: number,
  totalPages: number,
  showGrid?: boolean,
  layoutHelpers?: any
) => (
  <>
    {showFooter ? <SchemeFooter data={data} pageNumber={pageNumber} totalPages={totalPages} layoutHelpers={layoutHelpers} /> : null}
  </>
)

const renderItemPage = (
  data: ClassicInvoiceDocInput,
  descriptor: ItemPageDescriptor,
  pageNumber: number,
  totalPages: number,
  includeTotals: boolean,
  showFooter: boolean,
  showGrid?: boolean,
  showBlocks?: boolean,
  showLabels?: boolean,
  layoutHelpers?: any,
) => (
  <Page key={`items-${descriptor.variantBase}-${descriptor.pageIndex}-${pageNumber}`} size="A4" style={styles.page}>
    <View style={{ position: 'absolute', left: PAGE_MARGIN.left, top: PAGE_MARGIN.top, width: CONTENT_WIDTH, height: CONTENT_HEIGHT }}>
      {renderHeaderForVariant(data, descriptor.variantBase, descriptor.pageIndex === 0, showGrid)}
      <ProjectMeta data={data} layoutHelpers={layoutHelpers} />
      {showGrid ? <GridOverlay height={CONTENT_HEIGHT} showRows showLabels={showLabels} /> : null}
      {showBlocks && layoutHelpers ? <BlocksOverlay show layoutHelpers={layoutHelpers} /> : null}
      <ItemsTable data={data} items={descriptor.items} layoutHelpers={layoutHelpers} />
      {includeTotals ? <Totals data={data} layoutHelpers={layoutHelpers} /> : null}
      {renderFooterForVariant(data, descriptor.variantBase, true, pageNumber, totalPages, showGrid, layoutHelpers)}
    </View>
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
  options?: BuildOptions,
) => {
  initializeLayout(data.sheetData);
  const layoutHelpers = getLayoutHelpers();
  const variant = options?.variant ?? 'bundle'
  const showGrid = options?.showGrid ?? false
  const showBlocks = options?.showBlocks ?? false
  const showLabels = options?.showLabels ?? false
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
            return renderItemPage(data, descriptor, currentPage, totalPages, includeTotals, showFooter, showGrid, showBlocks, showLabels, layoutHelpers)
          }
          case 'payment-details':
            return (
              <PaymentDetailsPage
                key={`payment-details-${currentPage}`}
                data={data}
                qrPayload={qrPayloadWithAmount}
                pageNumber={currentPage}
                totalPages={totalPages}
                showGrid={showGrid}
                showLabels={showLabels}
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
                showGrid={showGrid}
                showLabels={showLabels}
              />
            )
          default:
            return null
        }
      })}
    </Document>
  )
}
