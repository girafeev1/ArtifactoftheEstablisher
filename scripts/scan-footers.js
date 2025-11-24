#!/usr/bin/env node
/**
 * Scan footer sections from the Classic Invoice Google Sheet and emit precise geometry
 * (column widths, row heights), merges, and effective formats for each footer block.
 *
 * Usage:
 *   node scripts/scan-footers.js 
 *
 * Requires env in .env.local:
 *   GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY
 */

const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SPREADSHEET_ID = '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0'

// Tabs by gid we care about (two variants/sheets you provided)
const TARGET_GIDS = [598129981, 403093960]

// Footer ranges per page (A..N columns)
const FOOTER_RANGES = {
  page1: 'A48:N57',
  page2: 'A109:N110',
  page3: 'A152:N153',
  page4: 'A205:N206',
}

// Header ranges per page (as specified)
// Note: page1/page3 use only column N band per your guidance; page2/page4 full A..N band
const HEADER_RANGES = {
  page1: 'A1:N6',
  page2: 'A58:N63',
  page3: 'A111:N116',
  page4: 'A154:N159',
}

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  ['https://www.googleapis.com/auth/spreadsheets.readonly'],
)

const sheets = google.sheets({ version: 'v4', auth })

async function getSheetTitlesByGid(spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId })
  const titlesByGid = {}
  const rowCountByGid = {}
  for (const sh of res.data.sheets || []) {
    const sheetId = sh.properties?.sheetId
    const title = sh.properties?.title
    const rows = sh.properties?.gridProperties?.rowCount
    if (typeof sheetId === 'number' && title) {
      titlesByGid[sheetId] = title
      if (typeof rows === 'number') rowCountByGid[sheetId] = rows
    }
  }
  return { titlesByGid, rowCountByGid }
}

function a1ToIndexes(a1) {
  // Simplified: returns { startRow, endRow, startCol, endCol } 0-based
  // Supports ranges like A48:N57
  const m = a1.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/)
  if (!m) return null
  const [, sc, sr, ec, er] = m
  const colToIndex = (letters) => {
    let v = 0
    for (const ch of letters) {
      v = v * 26 + (ch.charCodeAt(0) - 64)
    }
    return v - 1
  }
  return {
    startRow: parseInt(sr, 10) - 1,
    endRow: parseInt(er, 10) - 1,
    startCol: colToIndex(sc),
    endCol: colToIndex(ec),
  }
}

function mergeIntersectsRange(merge, rangeIdx) {
  // merge/end indices are 0-based and exclusive in Google API
  const mStartR = merge.startRowIndex ?? 0
  const mEndR = merge.endRowIndex ?? Number.MAX_SAFE_INTEGER
  const mStartC = merge.startColumnIndex ?? 0
  const mEndC = merge.endColumnIndex ?? Number.MAX_SAFE_INTEGER

  const rStartR = rangeIdx.startRow
  const rEndR = rangeIdx.endRow + 1 // inclusive -> exclusive
  const rStartC = rangeIdx.startCol
  const rEndC = rangeIdx.endCol + 1

  const rowOverlap = mStartR < rEndR && mEndR > rStartR
  const colOverlap = mStartC < rEndC && mEndC > rStartC
  return rowOverlap && colOverlap
}

function simplifyCell(cell) {
  if (!cell) return null
  const valueFormatted = cell.formattedValue ?? null
  const valueRawEntered = cell.userEnteredValue && 'stringValue' in cell.userEnteredValue
    ? cell.userEnteredValue.stringValue
    : (cell.effectiveValue ? Object.values(cell.effectiveValue)[0] : null)
  const fmt = cell.effectiveFormat || {}
  const text = fmt.textFormat || {}
  const borders = fmt.borders || {}
  const numFmt = fmt.numberFormat || null
  const bg = fmt.backgroundColor || null
  const wrapStrategy = fmt.wrapStrategy || null
  const padding = fmt.padding || null
  const textRotation = fmt.textRotation || null
  const textRuns = Array.isArray(cell.textFormatRuns) ? cell.textFormatRuns.map((r) => ({
    startIndex: r.startIndex ?? null,
    format: r.format ? {
      fontFamily: r.format.fontFamily ?? null,
      fontSize: r.format.fontSize ?? null,
      bold: !!r.format.bold,
      italic: !!r.format.italic,
      underline: !!r.format.underline,
      strikethrough: !!r.format.strikethrough,
      foregroundColor: r.format.foregroundColor || null,
    } : null,
  })) : null
  const hyperlink = cell.hyperlink || null

  // Detect spacing usage (e.g., deliberate extra spaces)
  const raw = typeof valueRawEntered === 'string' ? valueRawEntered : (typeof valueFormatted === 'string' ? valueFormatted : '')
  const hasExtraSpaces = / {2,}/.test(raw) || /\s$/.test(raw) || /^\s/.test(raw)
  return {
    valueFormatted,
    valueRaw: valueRawEntered,
    hasExtraSpaces,
    note: cell.note ?? null,
    format: {
      fontFamily: text.fontFamily ?? null,
      fontSize: text.fontSize ?? null,
      bold: !!text.bold,
      italic: !!text.italic,
      underline: !!text.underline,
      strikethrough: !!text.strikethrough,
      horizontalAlignment: fmt.horizontalAlignment ?? null,
      verticalAlignment: fmt.verticalAlignment ?? null,
      numberFormat: numFmt ? { type: numFmt.type || null, pattern: numFmt.pattern || null } : null,
      backgroundColor: bg
        ? { r: bg.red ?? 0, g: bg.green ?? 0, b: bg.blue ?? 0, a: bg.alpha ?? 1 }
        : null,
      wrapStrategy,
      padding,
      textRotation,
      borders: Object.fromEntries(
        ['top', 'bottom', 'left', 'right'].map((side) => [
          side,
          borders[side]
            ? {
                style: borders[side].style || null,
                width: borders[side].width ?? null,
                color: borders[side].color || null,
              }
            : null,
        ]),
      ),
    },
    textFormatRuns: textRuns,
    hyperlink,
  }
}

async function scan() {
  const { titlesByGid, rowCountByGid } = await getSheetTitlesByGid(SPREADSHEET_ID)
  const out = { spreadsheetId: SPREADSHEET_ID, scannedAt: new Date().toISOString(), sheets: {} }

  for (const gid of TARGET_GIDS) {
    const title = titlesByGid[gid]
    if (!title) {
      console.warn(`[scan-footers] No sheet title found for gid=${gid}`)
      continue
    }

    // Build A1 ranges scoped to this sheet title
    const rangesAll = Object.entries(FOOTER_RANGES).map(([page, a1]) => ({ page, a1 }))
    const valid = []
    const rowMax = rowCountByGid[gid] ?? Number.MAX_SAFE_INTEGER
    for (const r of rangesAll) {
      const idx = a1ToIndexes(r.a1)
      if (!idx) { continue }
      if (idx.endRow < rowMax) {
        valid.push({ ...r, range: `'${title}'!${r.a1}` })
      } else {
        console.warn(`[scan-footers] Skipping ${title} ${r.a1} (exceeds rowCount ${rowMax})`)
      }
    }
    if (valid.length === 0) {
      console.warn(`[scan-footers] No valid footer ranges for ${title}`)
      continue
    }

    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: true,
      ranges: valid.map((r) => r.range),
    })

    const sheetPayloads = res.data.sheets || []
    const entries = {}

    for (let i = 0; i < sheetPayloads.length; i += 1) {
      const block = sheetPayloads[i]
      const target = valid[i]
      if (!block || !block.data || !block.data.length) {
        entries[target.page] = { error: 'no data' }
        continue
      }

      const grid = block.data[0]
      const rowMetadata = (grid.rowMetadata || []).map((r) => ({ pixelSize: r.pixelSize ?? null }))
      const columnMetadata = (grid.columnMetadata || []).map((c) => ({ pixelSize: c.pixelSize ?? null }))

      const rangeIdx = a1ToIndexes(target.a1)
      const merges = (block.merges || []).filter((m) => mergeIntersectsRange(m, rangeIdx))

      const rows = (grid.rowData || []).map((row) =>
        (row.values || []).map((cell) => simplifyCell(cell)),
      )

      entries[target.page] = {
        a1: target.a1,
        colWidthsPx: columnMetadata.map((c) => c.pixelSize),
        rowHeightsPx: rowMetadata.map((r) => r.pixelSize),
        merges,
        cells: rows,
      }
    }

    // Also scan headers using HEADER_RANGES
    const headerRangesAll = Object.entries(HEADER_RANGES).map(([page, a1]) => ({ page, a1 }))
    const headerValid = []
    const rowMax2 = rowCountByGid[gid] ?? Number.MAX_SAFE_INTEGER
    for (const r of headerRangesAll) {
      const idx = a1ToIndexes(r.a1)
      if (!idx) { continue }
      if (idx.endRow < rowMax2) {
        headerValid.push({ ...r, range: `'${title}'!${r.a1}` })
      } else {
        console.warn(`[scan-footers] Skipping header ${title} ${r.a1} (exceeds rowCount ${rowMax2})`)
      }
    }

    let headers = {}
    if (headerValid.length) {
      const resHeaders = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        includeGridData: true,
        ranges: headerValid.map((r) => r.range),
      })
      const sheetPayloads2 = resHeaders.data.sheets || []
      headers = {}
      for (let i = 0; i < sheetPayloads2.length; i += 1) {
        const block = sheetPayloads2[i]
        const target = headerValid[i]
        if (!block || !block.data || !block.data.length) {
          headers[target.page] = { error: 'no data' }
          continue
        }
        const grid = block.data[0]
        const rowMetadata = (grid.rowMetadata || []).map((r) => ({ pixelSize: r.pixelSize ?? null }))
        const columnMetadata = (grid.columnMetadata || []).map((c) => ({ pixelSize: c.pixelSize ?? null }))
        const rangeIdx = a1ToIndexes(target.a1)
        const merges = (block.merges || []).filter((m) => mergeIntersectsRange(m, rangeIdx))
        const rows = (grid.rowData || []).map((row) => (row.values || []).map((cell) => simplifyCell(cell)))
        headers[target.page] = {
          a1: target.a1,
          colWidthsPx: columnMetadata.map((c) => c.pixelSize),
          rowHeightsPx: rowMetadata.map((r) => r.pixelSize),
          merges,
          cells: rows,
        }
      }
    }

    out.sheets[gid] = { title, footers: entries, headers }
  }

  const dir = path.resolve(process.cwd(), 'tmp')
  fs.mkdirSync(dir, { recursive: true })
  const dst = path.join(dir, `footers-scan-${Date.now()}.json`)
  fs.writeFileSync(dst, JSON.stringify(out, null, 2), 'utf8')
  console.log(`[scan-footers] Wrote ${dst}`)
}

scan().catch((err) => {
  console.error('[scan-footers] Failed', err)
  process.exit(1)
})
