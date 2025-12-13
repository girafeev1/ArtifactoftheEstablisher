import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { Buffer } from 'buffer'
import type { ClassicInvoiceDocInput } from './classicInvoice'
import { readClassicSchemeSync, type ClassicInvoiceScheme, type ClassicInvoiceSchemeCellMeta, type ClassicInvoiceSchemeMerge } from './classicInvoiceScheme'
import { amountHK, num2eng, num2chi } from '../invoiceFormat'
import { FONT_DATA } from './fontData'
// Local FPS helpers (duplicated from classicInvoice to avoid import/export mismatch)
const buildHKFPSPayload = (
  fpsProxyValue: string | null,
  includeAmount: boolean,
  amountNumber: number | null,
  billRef?: string | null,
) => {
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
  let additionalData = ''
  if (billRef && billRef.trim()) {
    additionalData = TLV('62', TLV('01', billRef.trim()))
  }
  const withoutCRC = payloadFormat + pointOfInit + merchantAccountInfo + mcc + currency + amountTLV + country + name + city + additionalData
  const crc = CRC16(withoutCRC + '63' + '04')
  return withoutCRC + '63' + '04' + crc
}

const buildHKFPSQrUrl = (payload: string | null, size = 220) =>
  payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`
    : null

export type InvoicePdfKitInput = ClassicInvoiceDocInput

const px2pt = (px: number) => (px || 0) * 0.75

// Logical font names used inside this module. They don't have to match the
// underlying TTF family strings – we map them explicitly in `registerFonts`.
const CJK_FONT_NAME = 'YujiMai'
const LATIN_FONT_NAME = 'Helvetica'
const ROBOTO_FONT_NAME = 'RobotoMono'
const ROBOTO_BOLD_FONT_NAME = 'RobotoMono-Bold'
const ROBOTO_ITALIC_FONT_NAME = 'RobotoMono-Italic'
const ROBOTO_BOLDITALIC_FONT_NAME = 'RobotoMono-BoldItalic'
const CORMORANT_FONT_NAME = 'CormorantInfant'
const CORMORANT_BOLD_FONT_NAME = 'CormorantInfant-Bold'
const IANSUI_FONT_NAME = 'Iansui'
const EB_GARAMOND_FONT_NAME = 'EBGaramond'
const RAMPART_FONT_NAME = 'RampartOne'
const KARLA_FONT_NAME = 'Karla'
const EB_GARAMOND_BOLD_FONT_NAME = 'EBGaramond-Bold'
const FEDERO_FONT_NAME = 'Federo'
// Use a compact line height for rows that were meant to stay single-line.
const DEFAULT_LINE_HEIGHT = 0.6
const SINGLE_LINE_HEIGHT_MULT_MIDDLE = 1.5
const SINGLE_LINE_HEIGHT_MULT_OTHER = 1.1
const VERTICAL_INSET = 2 // inset from top/bottom to avoid hugging edges
const RUN_PADDING = 0 // horizontal padding between runs (right alignment uses exact width)
const DEBUG = process.env.PDFKIT_DEBUG === '1'

const registerFonts = (doc: PDFDocument) => {
  // Roboto Mono – base Latin mono.
  try {
    const roboto = (FONT_DATA as any)['RobotoMono-Regular.ttf']
    if (roboto && typeof roboto === 'string' && roboto.length > 32) {
      const buf = Buffer.from(roboto, 'base64')
      doc.registerFont(ROBOTO_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', ROBOTO_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', ROBOTO_FONT_NAME)
  }

  // Roboto Mono Bold
  try {
    const robotoBold = (FONT_DATA as any)['RobotoMono-Bold.ttf']
    if (robotoBold && typeof robotoBold === 'string' && robotoBold.length > 32) {
      const buf = Buffer.from(robotoBold, 'base64')
      doc.registerFont(ROBOTO_BOLD_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', ROBOTO_BOLD_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', ROBOTO_BOLD_FONT_NAME)
  }

  // Yuji Mai – preferred CJK display font (for titles / header Chinese text).
  try {
    let buf: Buffer | null = null
    const yujiB64 = (FONT_DATA as any)['YujiMai-Regular.ttf']
    if (yujiB64 && typeof yujiB64 === 'string' && yujiB64.length > 32) {
      buf = Buffer.from(yujiB64, 'base64')
    } else {
      const p = path.resolve(process.cwd(), 'public', 'pdf-fonts', 'YujiMai-Regular.ttf')
      if (fs.existsSync(p)) {
        buf = fs.readFileSync(p)
      }
    }
    if (buf) {
      doc.registerFont(CJK_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', CJK_FONT_NAME)
    }
  } catch (e) {
    if (DEBUG) console.warn('[pdfkit] Failed to register', CJK_FONT_NAME, e)
  }

  // Iansui – primary Chinese body font; also used as a fallback when Yuji is unavailable.
  try {
    const iansui = (FONT_DATA as any)['Iansui-Regular.ttf']
    if (iansui && typeof iansui === 'string' && iansui.length > 32) {
      const buf = Buffer.from(iansui, 'base64')
      doc.registerFont(IANSUI_FONT_NAME, buf)
      // If we don't have a separate Yuji font file, use Iansui for CJK title as well.
      doc.registerFont(CJK_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', IANSUI_FONT_NAME, '(+ CJK alias)')
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', IANSUI_FONT_NAME)
  }

  // Karla family – now that we have real static TTFs, register full family.
  try {
    const kReg = (FONT_DATA as any)['Karla-Regular.ttf']
    const kBold = (FONT_DATA as any)['Karla-Bold.ttf']
    const kIt = (FONT_DATA as any)['Karla-Italic.ttf']
    const kBI = (FONT_DATA as any)['Karla-BoldItalic.ttf']
    if (kReg && typeof kReg === 'string' && kReg.length > 32) {
      doc.registerFont(KARLA_FONT_NAME, Buffer.from(kReg, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', KARLA_FONT_NAME)
    }
    if (kBold && typeof kBold === 'string' && kBold.length > 32) {
      doc.registerFont(`${KARLA_FONT_NAME}-Bold`, Buffer.from(kBold, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', `${KARLA_FONT_NAME}-Bold`)
    }
    if (kIt && typeof kIt === 'string' && kIt.length > 32) {
      doc.registerFont(`${KARLA_FONT_NAME}-Italic`, Buffer.from(kIt, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', `${KARLA_FONT_NAME}-Italic`)
    }
    if (kBI && typeof kBI === 'string' && kBI.length > 32) {
      doc.registerFont(`${KARLA_FONT_NAME}-BoldItalic`, Buffer.from(kBI, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', `${KARLA_FONT_NAME}-BoldItalic`)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register Karla family')
  }

  // Cormorant Infant – serif for headers; now with a real bold cut.
  try {
    const cReg = (FONT_DATA as any)['CormorantInfant-Regular.ttf']
    const cBold = (FONT_DATA as any)['CormorantInfant-Bold.ttf']
    if (cReg && typeof cReg === 'string' && cReg.length > 32) {
      doc.registerFont(CORMORANT_FONT_NAME, Buffer.from(cReg, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', CORMORANT_FONT_NAME)
    }
    if (cBold && typeof cBold === 'string' && cBold.length > 32) {
      doc.registerFont(CORMORANT_BOLD_FONT_NAME, Buffer.from(cBold, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', CORMORANT_BOLD_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', CORMORANT_FONT_NAME)
  }

  // EB Garamond – serif for headers; now with a real bold cut.
  try {
    const eReg = (FONT_DATA as any)['EBGaramond-Regular.ttf']
    const eBold = (FONT_DATA as any)['EBGaramond-Bold.ttf']
    if (eReg && typeof eReg === 'string' && eReg.length > 32) {
      doc.registerFont(EB_GARAMOND_FONT_NAME, Buffer.from(eReg, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', EB_GARAMOND_FONT_NAME)
    }
    if (eBold && typeof eBold === 'string' && eBold.length > 32) {
      doc.registerFont(EB_GARAMOND_BOLD_FONT_NAME, Buffer.from(eBold, 'base64'))
      if (DEBUG) console.log('[pdfkit] Registered', EB_GARAMOND_BOLD_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', EB_GARAMOND_FONT_NAME)
  }

  // Rampart One – logo face.
  try {
    const rampart = (FONT_DATA as any)['RampartOne-Regular.ttf']
    if (rampart && typeof rampart === 'string' && rampart.length > 32) {
      const buf = Buffer.from(rampart, 'base64')
      doc.registerFont(RAMPART_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', RAMPART_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', RAMPART_FONT_NAME)
  }

  // Varela Round – currently only used in a few UI labels, but we register it
  // so the scheme can reference it if needed.
  try {
    const varela = (FONT_DATA as any)['VarelaRound-Regular.ttf']
    if (varela && typeof varela === 'string' && varela.length > 32) {
      const buf = Buffer.from(varela, 'base64')
      doc.registerFont('VarelaRound', buf)
      if (DEBUG) console.log('[pdfkit] Registered', 'VarelaRound')
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', 'VarelaRound')
  }

  // Federo – display font for InvoiceTotalEnglish.
  try {
    const fed = (FONT_DATA as any)['Federo-Regular.ttf']
    if (fed && typeof fed === 'string' && fed.length > 32) {
      const buf = Buffer.from(fed, 'base64')
      doc.registerFont(FEDERO_FONT_NAME, buf)
      if (DEBUG) console.log('[pdfkit] Registered', FEDERO_FONT_NAME)
    }
  } catch {
    if (DEBUG) console.warn('[pdfkit] Failed to register', FEDERO_FONT_NAME)
  }
}

type LayoutHelpers = {
  colLeft: (c1: number) => number
  colWidth: (c1: number, span?: number) => number
  rowTop: (r1: number) => number
  rowHeight: (r1: number, span?: number) => number
  contentWidth: number
  scaleX: number
}

const buildLayoutHelpers = (doc: PDFDocument, scheme: any): { helpers: LayoutHelpers; marginLeft: number; marginTop: number } => {
  // Margins in points: 0.3" left/right = 21.6pt; 0.2" top/bottom = 14.4pt
  const marginLeft = 21.6
  const marginTop = 14.4
  const contentWidth = doc.page.width - marginLeft * 2
  const rowHeightsPx: number[] = scheme.rowHeightsPx || []
  const colWidthsPx: number[] = scheme.columnWidthsPx || []

  const totalWidthPx = colWidthsPx.reduce((s, w) => s + w, 0) || 1
  const scaleX = contentWidth / totalWidthPx
  const colsPt = colWidthsPx.map((w) => w * scaleX)

  const rowsPtRaw = rowHeightsPx.map((px) => px2pt(px))
  const firstPageRows = rowsPtRaw.slice(0, 57)
  const rawHeight = firstPageRows.reduce((s, h) => s + h, 0)
  const contentHeight = doc.page.height - marginTop * 2
  // Only shrink if the sheet is taller than the available space; otherwise keep original proportions to avoid “tall” rows.
  const rowScale = rawHeight > contentHeight && rawHeight > 0 ? contentHeight / rawHeight : 1
  const rowsPt = rowsPtRaw.map((h) => h * rowScale)

  const colOffsets: number[] = []
  colsPt.forEach((w, i) => {
    colOffsets[i] = (colOffsets[i - 1] || 0) + w
  })
  const rowOffsets: number[] = []
  rowsPt.forEach((h, i) => {
    rowOffsets[i] = (rowOffsets[i - 1] || 0) + h
  })

  const helpers: LayoutHelpers = {
    colLeft: (c1: number) => (c1 <= 1 ? 0 : colOffsets[c1 - 2] || 0),
    colWidth: (c1: number, span = 1) =>
      colsPt.slice(c1 - 1, c1 - 1 + span).reduce((s, v) => s + v, 0),
    rowTop: (r1: number) => (r1 <= 1 ? 0 : rowOffsets[r1 - 2] || 0),
    rowHeight: (r1: number, span = 1) =>
      rowsPt.slice(r1 - 1, r1 - 1 + span).reduce((s, v) => s + v, 0),
    contentWidth,
    scaleX,
  }

  return { helpers, marginLeft, marginTop }
}

// Given a row/col and scheme merges, find the merge covering that cell.
const findMerge = (merges: ClassicInvoiceSchemeMerge[], r: number, c: number) => {
  for (const m of merges) {
    if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m
  }
  return null
}

// Naive token replacement
const spacify = (input: string) =>
  String(input)
    .split('\n')
    .map((line) => line.split('').join(' '))
    .join('\n')

// Replace tokens; basic placeholder replacement, with optional spacified suffix.
const replaceTokens = (text: string, bindings: Record<string, string | number>) =>
  text
    .replace(/<([^>]+)>/g, (_, tokenRaw) => {
      const raw = tokenRaw.trim()
      const spacified = /\(Spacified\)|\*Spacified\*/i.test(raw)
      const key = raw.replace(/\s*\(Spacified\)\s*$/i, '').replace(/\*Spacified\*\s*$/i, '')
      const val = bindings[key]
      if (val === undefined || val === null) return ''
      const out = typeof val === 'number' ? String(val) : String(val)
      return spacified ? spacify(out) : out
    })
    // Honour literal "\n" coming from the sheet (cells that include the characters backslash+n).
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')

const fetchQrBuffer = async (url: string): Promise<Buffer | null> => {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

export const buildInvoicePdfKitDocument = async (
  data: InvoicePdfKitInput,
  options?: { showGrid?: boolean },
): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    ;(async () => {
      try {
        const scheme = readClassicSchemeSync()
        const doc = new PDFDocument({ size: 'A4' })
        const chunks: Buffer[] = []

        doc.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        doc.on('end', () => {
          resolve(Buffer.concat(chunks))
        })
        doc.on('error', (err) => {
          reject(err)
        })

        // Ensure CJK font is registered; default Latin font is Helvetica.
        registerFonts(doc)
        doc.font(LATIN_FONT_NAME)

        if (!scheme) {
          // Fallback to the simple debug output if no scheme file is present.
          doc.fontSize(16).text('Invoice (PDFKit engine)', 56, 56)
          doc.moveDown()
          doc.fontSize(12).text(`Invoice #: ${data.invoiceNumber}`)
          if (data.companyName) {
            doc.moveDown()
            doc.text(`Bill To: ${data.companyName}`)
          }
          doc.end()
          return
        }

      const { helpers, marginLeft, marginTop } = buildLayoutHelpers(doc, scheme)
      const { colLeft, colWidth, rowTop, rowHeight, scaleX } = helpers

      // Optional light grid for page 1 (rows 1..57, cols 1..14) for visual debugging.
      const colsCount = scheme.columnWidthsPx.length
      const rowsCount = Math.min(57, scheme.rowHeightsPx.length)
      if (options?.showGrid) {
        doc.save()
        doc.lineWidth(0.25)
        doc.strokeColor('#e5e7eb')
        for (let c = 1; c <= colsCount; c += 1) {
          const x = marginLeft + colLeft(c)
          doc.moveTo(x, marginTop).lineTo(x, marginTop + rowTop(rowsCount + 1)).stroke()
        }
        for (let r = 1; r <= rowsCount + 1; r += 1) {
          const y = marginTop + rowTop(r)
          doc.moveTo(marginLeft, y).lineTo(marginLeft + colLeft(colsCount + 1), y).stroke()
        }
        // Grid labels (columns A..N, rows 1..57)
        doc.fontSize(6).fillColor('#9ca3af')
        for (let c = 1; c <= colsCount; c += 1) {
          const x = marginLeft + colLeft(c)
          doc.text(String.fromCharCode(64 + c), x + 2, marginTop - 8, { lineBreak: false })
        }
        for (let r = 1; r <= rowsCount; r += 1) {
          const y = marginTop + rowTop(r)
          doc.text(String(r), marginLeft - 10, y + 2, { lineBreak: false })
        }
        doc.restore()
      }

      // Very small subset of the header and bill-to block, positioned by grid.
      const merges: ClassicInvoiceSchemeMerge[] = scheme.merges || []

      // Build bindings for token replacement
      const totalAmount = data.total ?? data.amount ?? data.subtotal ?? 0
      const totalEng = totalAmount ? num2eng(totalAmount) : ''
      const totalChi = totalAmount ? num2chi(totalAmount) : ''

      // Bank account split
      const accountNumberRaw = data.bankAccountNumber ?? ''
      const accountParts = String(accountNumberRaw).split('-')
      const bankPart1 = accountParts.shift() || ''
      const bankPart2 = accountParts.join('-')

      const bindings: Record<string, string | number> = {
        InvoiceNumber: data.invoiceNumber ?? '',
        InvoiceDate: data.invoiceDateDisplay
          ? (() => {
              const d = new Date(data.invoiceDateDisplay)
              return Number.isNaN(d.getTime())
                ? ''
                : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            })()
          : '',
        // Subsidiary
        SubsidiaryEnglishName: data.subsidiaryEnglishName ?? '',
        SubsidiaryChineseName: data.subsidiaryChineseName ?? '',
        SubsidiaryAddressLine1: data.subsidiaryAddressLines?.[0] ?? '',
        SubsidiaryAddressLine2: data.subsidiaryAddressLines?.[1] ?? '',
        SubsidiaryAddressLine3: data.subsidiaryAddressLines?.[2] ?? '',
        SubsidiaryRegion: data.subsidiaryAddressLines?.[3] ?? '',
        SubsidiaryEmail: data.subsidiaryEmail ?? '',
        SubsidiaryPhone: data.subsidiaryPhone ?? '',
        // Client
        ClientCompanyName: data.companyName ?? '',
        ClientAddressLine1: data.addressLine1 ?? '',
        ClientAddressLine2: data.addressLine2 ?? '',
        ClientAddressLine3: data.addressLine3 ?? '',
        ClientRegion: data.region ?? '',
        ClientRepresentativeName: data.representative ?? '',
        // No explicit title in the data; leave blank to avoid duplication.
        ClientRepresentativeTitle: '',
        // Project
        PresenterWorkType: data.presenterWorkType ?? '',
        ProjectTitle: data.projectTitle ?? '',
        ProjectNature: data.projectNature ?? '',
        // Items (first item only for page 1)
        ItemTitle: (data.items?.[0]?.title) ?? '',
        ItemFeeType: (data.items?.[0]?.feeType) ?? '',
        ItemNotes: (data as any).item1Notes ?? (data.items?.[0]?.notes) ?? '',
        ItemUnitPrice: (data.items?.[0]?.unitPrice) ?? 0,
        ItemQuantity: (data.items?.[0]?.quantity) ?? 0,
        ItemQuantityUnit: (data.items?.[0]?.quantityUnit) ?? '',
        ItemSubQuantity: (data.items?.[0]?.subQuantity) ?? '',
        ItemLineTotal: (() => {
          const num = Math.max(0, (data.items?.[0]?.unitPrice ?? 0) * (data.items?.[0]?.quantity ?? 0) - (data.items?.[0]?.discount ?? 0))
          return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        })(),
        // Totals
        InvoiceTotalNumeric: totalAmount.toFixed(2),
        InvoiceTotalEnglish: totalEng,
        InvoiceTotalChinese: totalChi,
        // Bank / FPS
        BankName: data.bankName ?? '',
        BankCode: data.bankCode ?? '',
        BankAccountNumber: data.bankAccountNumber ?? '',
        BankAccountNumberPart1: bankPart1,
        BankAccountNumberPart2: bankPart2,
        FPSId: data.fpsId ?? '',
      }
      // FPS QR payload with locked amount and invoice reference (for completeness)
      const qrPayload = buildHKFPSPayload(
        (data.fpsId as any) ?? (data as any).fpsEmail ?? null,
        true,
        data.total ?? data.amount ?? data.subtotal ?? null,
        data.invoiceNumber ? `#${data.invoiceNumber}` : null,
      )

// Helper to render a single cell from scheme meta with tokens and font selection.
      const drawCell = (r: number, c: number, meta: ClassicInvoiceSchemeCellMeta) => {
        const merge = findMerge(merges, r, c)
        const rowSpan = merge ? (merge.r2 - merge.r1 + 1) : 1
        const colSpan = merge ? (merge.c2 - merge.c1 + 1) : 1
        // Skip interior cells of a merge
        if (merge && (merge.r1 !== r || merge.c1 !== c)) return
        const x = marginLeft + colLeft(c)
        const y = marginTop + rowTop(r)
      const w = colWidth(c, colSpan)
      const h = rowHeight(r, rowSpan)

        // Borders
        if (meta.border) {
          doc.save()
          doc.lineWidth(1)
          doc.strokeColor('#111827')
          if (meta.border.top) {
            doc.moveTo(x, y).lineTo(x + w, y).stroke()
          }
          if (meta.border.bottom) {
            doc.moveTo(x, y + h).lineTo(x + w, y + h).stroke()
          }
          if (meta.border.left) {
            doc.moveTo(x, y).lineTo(x, y + h).stroke()
          }
          if (meta.border.right) {
            doc.moveTo(x + w, y).lineTo(x + w, y + h).stroke()
          }
          doc.restore()
        }

        // Text
        if (meta.value === undefined && (!meta.runs || meta.runs.length === 0)) return
        // Font sizes: keep sheet value (in px / pt) unscaled so proportions match the source.
        const baseFontSize = meta.fontSize ?? 10
        const hAlign = meta.hAlign === 'RIGHT' ? 'right' : meta.hAlign === 'CENTER' ? 'center' : 'left'
        const vAlign = meta.vAlign === 'BOTTOM' ? 'bottom' : meta.vAlign === 'MIDDLE' ? 'middle' : 'top'
        const wrap = !meta.wrapStrategy || meta.wrapStrategy === 'WRAP' || meta.wrapStrategy === 'WRAP_STRATEGY_UNSPECIFIED'

        const selectFont = (runText: string, family?: string, bold?: boolean, italic?: boolean) => {
          const fam = (family || '').toLowerCase()
          const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(runText)

          // 1) Hard overrides for specific fields where your design specifies fonts
          // independent of the sheet's family.
          if (meta.value === '<PresenterWorkType>') {
            // Presenter worktype: Iansui bold for CJK, Karla for Latin.
            return hasCJK ? IANSUI_FONT_NAME : KARLA_FONT_NAME
          }
          if (meta.value === '<ProjectTitle>') {
            // Project title: Yuji for CJK, Karla for Latin (bold enforced later).
            return hasCJK ? CJK_FONT_NAME : KARLA_FONT_NAME
          }
          if (meta.value === '<SubsidiaryChineseName>') {
            // Subsidiary Chinese name: Iansui bold for CJK.
            return IANSUI_FONT_NAME
          }
          if (meta.value === '<ItemNotes>') {
            // Item notes: Yuji for CJK (for coverage), bold Roboto mono for Latin.
            return hasCJK ? CJK_FONT_NAME : ROBOTO_BOLD_FONT_NAME
          }

          // 2) Family-based mapping from the scheme → actual PDFKit font names.
          if (fam.includes('rampart')) {
            return RAMPART_FONT_NAME
          }
          if (fam.includes('roboto')) {
            if (bold) return ROBOTO_BOLD_FONT_NAME
            return ROBOTO_FONT_NAME
          }
          // In the sheet some cells use "Google Sans Mono" – treat that as our
          // mono body face as well so it doesn't fall back to Helvetica.
          if (fam.includes('google') && fam.includes('mono')) {
            if (bold) return ROBOTO_BOLD_FONT_NAME
            return ROBOTO_FONT_NAME
          }
          if (fam.includes('karla')) {
            if (bold && italic) return `${KARLA_FONT_NAME}-BoldItalic`
            if (bold) return `${KARLA_FONT_NAME}-Bold`
            if (italic) return `${KARLA_FONT_NAME}-Italic`
            return KARLA_FONT_NAME
          }
          if (fam.includes('cormorant')) {
            return bold ? CORMORANT_BOLD_FONT_NAME : CORMORANT_FONT_NAME
          }
          if (fam.includes('garamond')) {
            return bold ? EB_GARAMOND_BOLD_FONT_NAME : EB_GARAMOND_FONT_NAME
          }
          if (fam.includes('varela')) {
            return 'VarelaRound'
          }
          if (fam.includes('iansui') || fam.includes('yuji')) {
            return hasCJK ? CJK_FONT_NAME : IANSUI_FONT_NAME
          }

          // 3) If the text itself contains CJK characters, prefer Yuji for
          // coverage; some specific fields override this above.
          if (hasCJK) return CJK_FONT_NAME

          // 4) Default Latin fallback – keep using Helvetica here so we don't break
          // anything if a cell has an unexpected font family.
          if (bold && italic) return 'Helvetica-BoldOblique'
          if (bold) return 'Helvetica-Bold'
          if (italic) return 'Helvetica-Oblique'
          return LATIN_FONT_NAME
        }

        // Build runs (keep newlines intact; split later so blank lines are preserved)
        const runs: { text: string; fontFamily?: string; fontSize?: number; bold?: boolean; italic?: boolean }[] = []
        if (meta.runs && meta.runs.length > 0) {
          meta.runs.forEach((r) => {
            let txt = replaceTokens(r.text || '', bindings)
            if (r.text && r.text.trim() === '<ItemSubQuantity>') {
              const v = bindings.ItemSubQuantity
              if (v !== undefined && v !== null && String(v).trim()) {
                txt = `x${v}`
              } else {
                txt = ''
              }
            }
            if (r.text && r.text.trim() === '<ItemQuantityUnit>') {
              const v = bindings.ItemQuantityUnit
              if (v !== undefined && v !== null && String(v).trim()) {
                txt = `/${v}`
              } else {
                txt = ''
              }
            }
            const spacifiedMarker = /\(Spacified\)|\*Spacified\*/i
            const hasMarker = spacifiedMarker.test(txt)
            txt = txt.replace(spacifiedMarker, '')
            const isSubQtyToken = (r.text && r.text.trim() === '<ItemSubQuantity>')
            const runHasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(txt)
            const forceBold =
              (meta.value === '<SubsidiaryChineseName>' && runHasCJK) ||
              (meta.value === '<PresenterWorkType>' && runHasCJK) ||
              (meta.value === '<ItemNotes>' && runHasCJK)
            runs.push({
              text: hasMarker ? spacify(txt) : txt,
              fontFamily: r.fontFamily ?? meta.fontFamily,
              // For the combined "<ItemTitle> <ItemSubQuantity>" cell the sheet
              // visually uses 19pt for the title and 14pt for the sub‑quantity.
              // The scheme only reports 19 as the base; shrink the sub‑quantity
              // run here so we can mirror the design.
              fontSize: isSubQtyToken ? baseFontSize - 5 : (r.fontSize ?? baseFontSize),
              // When mixing logical OR with nullish coalescing, we must group
              // the latter explicitly. We want "forceBold" to win, otherwise
              // prefer the explicit run bold flag, and finally fall back to
              // the cell meta bold value.
              bold: forceBold || (r.bold ?? meta.bold),
              italic: r.italic ?? meta.italic,
            })
          })
        } else {
          let txt = meta.value !== undefined ? replaceTokens(String(meta.value), bindings) : ''
          if (typeof meta.value === 'string' && meta.value.trim() === '<ItemSubQuantity>') {
            const v = bindings.ItemSubQuantity
            if (v !== undefined && v !== null && String(v).trim()) {
              txt = `x${v}`
            } else {
              txt = ''
            }
          }
          if (typeof meta.value === 'string' && meta.value.trim() === '<ItemQuantityUnit>') {
            const v = bindings.ItemQuantityUnit
            if (v !== undefined && v !== null && String(v).trim()) {
              txt = `/${v}`
            } else {
              txt = ''
            }
          }
          const spacifiedMarker = /\(Spacified\)|\*Spacified\*/i
          const hasMarker = spacifiedMarker.test(txt)
          txt = txt.replace(spacifiedMarker, '')
          const runHasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(txt)
          const forceBold =
            (meta.value === '<SubsidiaryChineseName>' && runHasCJK) ||
            (meta.value === '<PresenterWorkType>' && runHasCJK) ||
            (meta.value === '<ItemNotes>' && runHasCJK)
          runs.push({
            text: hasMarker ? spacify(txt) : txt,
            fontFamily: meta.fontFamily,
            fontSize: baseFontSize,
            bold: forceBold || meta.bold,
            italic: meta.italic,
          })
        }
        if (!runs.length) return

        // Special-case font size adjustment for title + sub-quantity:
        // when the Instruction sheet intends <ItemTitle> at 19 and <ItemSubQuantity> at 14,
        // but the scheme only reports 19 as the base size.
        if (
          meta.value === '<ItemTitle> <ItemSubQuantity>' ||
          meta.value === '<ItemTitle> x<ItemSubQuantity>'
        ) {
          const base = meta.fontSize ?? 19
          runs.forEach((ru) => {
            if (ru.text.includes('<ItemSubQuantity>')) {
              ru.fontSize = base - 5
            }
          })
        }

        // Special splitting for PresenterWorkType and ProjectTitle: split into CJK vs Latin to enforce different fonts.
        const expandMixedFonts = (rns: typeof runs) => {
          const out: typeof runs = []
          const targetKey =
            meta.value === '<PresenterWorkType>'
              ? 'work'
              : meta.value === '<ProjectTitle>'
              ? 'title'
              : meta.value === '<InvoiceTotalEnglish>'
              ? 'total'
              : null
          if (!targetKey) return rns
          rns.forEach((ru) => {
            const segments = ru.text.split(/([\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]+)/).filter(Boolean)
            segments.forEach((seg) => {
              const hasCJK = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf\uff00-\uffef]/.test(seg)
              const isTitle = targetKey === 'title'
              const isTotal = targetKey === 'total'
              const isWork = targetKey === 'work'
              out.push({
                ...ru,
                text: seg,
                fontFamily: hasCJK
                  ? (targetKey === 'title' ? CJK_FONT_NAME : IANSUI_FONT_NAME)
                  : isTotal
                  ? FEDERO_FONT_NAME
                  : KARLA_FONT_NAME,
                // Force bold for project title (both CJK and Latin) and for
                // PresenterWorkType CJK segments; InvoiceTotalEnglish is also
                // always bold.
                bold: ru.bold || isTitle || isTotal || (isWork && !hasCJK ? false : isWork && hasCJK) || meta.bold,
              })
            })
          })
          return out
        }
        const effectiveRuns = expandMixedFonts(runs)
        // Hide unit/quantity display when quantity <= 1 or no unit
        if (
          meta.value === '<ItemUnitPrice>' ||
          meta.value === '<ItemQuantityUnit>' ||
          meta.value === 'x<ItemQuantity>' ||
          meta.value === '<ItemSubQuantity>'
        ) {
          const qty = Number(bindings.ItemQuantity ?? 0)
          const unit = bindings.ItemQuantityUnit ? String(bindings.ItemQuantityUnit) : ''
          if (!(qty > 1 && unit.trim())) {
            return
          }
        }

        // Manual rendering for all cells to enforce runs/fonts/line breaks.
        // Build lines from runs, honoring embedded \n at the run level.
        const lines: typeof effectiveRuns[] = []
        let currentLine: typeof effectiveRuns = []
        effectiveRuns.forEach((run) => {
          const parts = run.text.split('\n')
          parts.forEach((part, idx) => {
            if (idx > 0) {
              lines.push(currentLine)
              currentLine = []
            }
            // Keep even empty segments to preserve blank lines.
            currentLine.push({ ...run, text: part })
          })
        })
        lines.push(currentLine)
        if (!lines.length) return

        const lineWidths = lines.map((line) => {
          return line.reduce((sum, run) => {
            const fontToUse = selectFont(run.text, run.fontFamily, run.bold, run.italic)
            doc.font(fontToUse).fontSize(run.fontSize || baseFontSize)
            return sum + doc.widthOfString(run.text)
          }, 0)
        })
        const maxFontInLine = lines.map((line) => Math.max(...line.map((r) => r.fontSize || baseFontSize)))
        // For single-line cells, use natural line height; for multi-line, apply the compact multiplier.
        const isSingle = lines.length === 1
        const singleMult = vAlign === 'middle' ? SINGLE_LINE_HEIGHT_MULT_MIDDLE : SINGLE_LINE_HEIGHT_MULT_OTHER
        const lineHeights =
          isSingle
            ? maxFontInLine.map((fs) => fs * singleMult)
            : maxFontInLine.map((fs) => fs * DEFAULT_LINE_HEIGHT)
        let blockHeight = lineHeights.reduce((s, v) => s + v, 0)

        let cursorY = y + VERTICAL_INSET
        if (vAlign === 'middle') {
          cursorY = y + (h - blockHeight) / 2
        } else if (vAlign === 'bottom') {
          cursorY = y + h - blockHeight - VERTICAL_INSET
        }
        // If block taller than cell, clip by aligning to top/bottom and not offsetting negative
        if (blockHeight > h) {
          if (vAlign === 'middle') cursorY = y
          if (vAlign === 'bottom') cursorY = y + h - blockHeight
          if (cursorY < y) cursorY = y
        }

        lines.forEach((line, idx) => {
          const lh = lineHeights[idx]
          const lw = lineWidths[idx]
          let startX = x
          if (hAlign === 'center') {
            startX = x + (w - lw) / 2
          } else if (hAlign === 'right') {
            startX = x + (w - lw)
          }
          let runX = startX + 1 // small left inset for all aligns
          line.forEach((run, rIdx) => {
            const fontToUse = selectFont(run.text, run.fontFamily, run.bold, run.italic)
            const fs = run.fontSize || baseFontSize
            doc.font(fontToUse).fontSize(fs)
            const isLast = rIdx === line.length - 1
            // Only synthesize bold for CJK fonts (Iansui / Yuji). For serif
            // and Latin faces we rely on real bold cuts to avoid a “double
            // stroke” look.
            const synthBold =
              (fontToUse === IANSUI_FONT_NAME || fontToUse === CJK_FONT_NAME) &&
              (run.bold || (meta.bold && !run.bold))

            if (synthBold) {
              doc.text(run.text, runX, cursorY, { lineBreak: false, continued: !isLast })
              doc.text(run.text, runX + 0.25, cursorY, { lineBreak: false, continued: !isLast })
            } else {
              doc.text(run.text, runX, cursorY, {
                lineBreak: false,
                continued: !isLast,
              })
            }
            runX += doc.widthOfString(run.text)
          })
          cursorY += lh
        })
        doc.font(LATIN_FONT_NAME)
      }

      // Render all cells in rows 1..57 (page 1)
      const cells: Record<string, ClassicInvoiceSchemeCellMeta> = scheme.cells || {}
      for (let r = 1; r <= 57; r += 1) {
        for (let c = 1; c <= colsCount; c += 1) {
          const meta = cells[`${r}:${c}`]
          if (meta) drawCell(r, c, meta)
        }
      }

      // Draw FPS QR if the scheme has a QR cell (we’ll use the cell that contains the FPS placeholder)
      if (qrPayload) {
        // Find the first cell whose value includes '<FPS' to anchor the QR.
        const qrEntry = Object.entries(cells).find(([, m]) => typeof m.value === 'string' && (m.value as string).includes('<FPS'))
        if (qrEntry) {
          const [key, meta] = qrEntry
          const [rStr, cStr] = key.split(':')
          const r = Number(rStr)
          const c = Number(cStr)
          const merge = findMerge(merges, r, c)
          const rowSpan = merge ? (merge.r2 - merge.r1 + 1) : 1
          const colSpan = merge ? (merge.c2 - merge.c1 + 1) : 1
          const x = marginLeft + colLeft(c)
          const y = marginTop + rowTop(r)
          const w = colWidth(c, colSpan)
          const h = rowHeight(r, rowSpan)
          const qrUrl = buildHKFPSQrUrl(qrPayload, 200)
          if (qrUrl) {
            // Keep QR square and centered inside its cell.
            const size = Math.min(w, h)
            const buf = await fetchQrBuffer(qrUrl)
            if (buf) {
              doc.image(buf, x + (w - size) / 2, y + (h - size) / 2, { width: size, height: size })
            }
          }
        }
      }

      doc.end()
    } catch (error) {
      reject(error)
    }
    })()
  })
}
