// Defines the TypeScript shape of the JSON file that `scripts/scan-
// invoice-template.js` produces. This allows the Next.js API layer to
// import the scanned scheme with type safety.

import path from 'path'
import fs from 'fs'

export type ClassicInvoiceSchemeColor = {
  red: number
  green: number
  blue: number
}

export type ClassicInvoiceSchemeBorder = {
  top?: { style?: string | null } | null
  bottom?: { style?: string | null } | null
  left?: { style?: string | null } | null
  right?: { style?: string | null } | null
}

export type ClassicInvoiceSchemeTextRun = {
  text: string
  bold?: boolean | null
  italic?: boolean | null
  font?: string | null
  // Some renderers expect `fontFamily` instead of `font`.
  fontFamily?: string | null
  fontSize?: number | null
  color?: ClassicInvoiceSchemeColor | null
}

export type ClassicInvoiceSchemeCell = {
  value: string | number | boolean | null
  // Some scanners/renderers store rich text as a list of runs.
  // `scripts/scan-invoice-template.js` currently stores single-style cells,
  // but we keep these fields optional for compatibility across renderers.
  richValue?: ClassicInvoiceSchemeTextRun[] | null
  runs?: ClassicInvoiceSchemeTextRun[] | null
  fontFamily?: string | null
  fontSize?: number | null
  bold?: boolean | null
  italic?: boolean | null
  fgColor?: ClassicInvoiceSchemeColor | null
  bgColor?: ClassicInvoiceSchemeColor | null
  hAlign?: string | null
  vAlign?: string | null
  wrapStrategy?: string | null
  border?: ClassicInvoiceSchemeBorder | null
}

// Backwards-compatible aliases used by older renderers.
export type ClassicInvoiceSchemeCellMeta = ClassicInvoiceSchemeCell

export type ClassicInvoiceSchemeMerge = {
  r1: number
  c1: number
  r2: number
  c2: number
}

export type ClassicInvoiceScheme = {
  spreadsheetId: string
  sheetId: number
  sheetTitle: string
  scannedAt: string
  columnWidthsPx: number[]
  rowHeightsPx: number[]
  merges: ClassicInvoiceSchemeMerge[]
  cells: Record<string, ClassicInvoiceSchemeCell>
}

export const CLASSIC_SCHEME_FILENAME = 'classic-instruction-scheme.json'

export function getClassicSchemePath (): string {
  return path.join(process.cwd(), 'tmp', CLASSIC_SCHEME_FILENAME)
}

export function readClassicSchemeSync (): ClassicInvoiceScheme | null {
  const schemePath = getClassicSchemePath()
  try {
    if (!fs.existsSync(schemePath)) return null
    const raw = fs.readFileSync(schemePath, 'utf8')
    if (!raw.trim()) return null
    return JSON.parse(raw) as ClassicInvoiceScheme
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[classicInvoiceScheme] Failed to read scheme', {
      schemePath,
      error: err instanceof Error ? { message: err.message } : err,
    })
    return null
  }
}
