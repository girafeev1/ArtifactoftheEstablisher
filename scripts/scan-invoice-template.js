// Scans a Google Sheet containing a "Classic Single-Item Invoice
// (Instruction)" template and converts its geometry, styling, and content to
// a JSON representation that can be used to drive an equivalent HTML render.
//
// This allows the invoice to be styled and laid out from a single source of
// truth (the sheet) without needing to manually sync style properties into
// the codebase.

const fs = require('fs')
const path = require('path')
const { GoogleAuth } = require('google-auth-library')
const { google } = require('googleapis')
const {
  CLASSIC_SCHEME_FILENAME,
  getClassicSchemePath,
} = require('../lib/pdfTemplates/classicInvoiceScheme')

// Match the full A1:N202 range that the old PDF renderer used so we can
// capture all the helper cells, alternate layouts, etc. even if they are
// not part of the main 1-57 row grid for Page 1.
const RANGE = 'A1:N202'

function hexToRgb (hex) {
  if (!hex || typeof hex !== 'string') return null
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
      red: parseInt(result[1], 16) / 255,
      green: parseInt(result[2], 16) / 255,
      blue: parseInt(result[3], 16) / 255,
    }
    : null
}

async function main () {
  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=')
    acc[key.replace(/^--/, '')] = value
    return acc
  }, {})

  if (!args.id || !args.gid) {
    throw new Error('Missing --id=<spreadsheetId> or --gid=<gid> arguments')
  }

  const spreadsheetId = args.id
  const sheetId = parseInt(args.gid, 10)
  if (isNaN(sheetId)) {
    throw new Error('Invalid --gid=<gid> argument; must be a number.')
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY in .env or .env.local')
  }

  console.log(`Authenticating with Google Sheets API...`)
  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  console.log(`Fetching sheet metadata for gid ${sheetId}...`)
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: true,
    ranges: [RANGE],
  })

  const sheet = (spreadsheet.data.sheets || []).find(
    (s) => s.properties?.sheetId === sheetId,
  )
  if (!sheet) {
    throw new Error(`Sheet with gid ${sheetId} not found in spreadsheet ${spreadsheetId}`)
  }

  console.log(`Found sheet: "${sheet.properties.title}"`)
  const gridData = sheet.data?.[0]
  if (!gridData) {
    throw new Error('Sheet contains no grid data in the specified range.')
  }

  // Extract column widths and row heights in pixels
  const columnWidthsPx =
    gridData.columnMetadata?.map((c) => c.pixelSize || 0) || []
  const rowHeightsPx = gridData.rowMetadata?.map((r) => r.pixelSize || 0) || []
  const merges = gridData.merges || []

  const cells = {}
  gridData.rowData?.forEach((row, r) => {
    row.values?.forEach((cell, c) => {
      const key = `${r + 1}:${c + 1}`
      const value = cell.formattedValue || ''

      const ef = cell.effectiveFormat
      if (!ef) {
        cells[key] = { value }
        return
      }

      const fontFamily = ef.textFormat?.fontFamily || null
      const fontSize = ef.textFormat?.fontSize || null
      const bold = ef.textFormat?.bold || false
      const italic = ef.textFormat?.italic || false
      const fgColor = hexToRgb(ef.textFormat?.foregroundColorStyle?.rgbColor?.hex)
      const bgColor = hexToRgb(ef.backgroundColorStyle?.rgbColor?.hex)

      const hAlign = ef.horizontalAlignment || 'LEFT'
      const vAlign = ef.verticalAlignment || 'TOP'
      const wrapStrategy = ef.wrapStrategy || 'OVERFLOW_CELL'
      const border = ef.borders || {}

      cells[key] = {
        value,
        fontFamily,
        fontSize,
        bold,
        italic,
        fgColor,
        bgColor,
        hAlign,
        vAlign,
        wrapStrategy,
        border,
      }
    })
  })

  // Assemble the final JSON structure
  const out = {
    spreadsheetId,
    sheetId,
    sheetTitle: sheet.properties.title,
    scannedAt: new Date().toISOString(),
    columnWidthsPx,
    rowHeightsPx,
    merges: merges.map((m) => ({
      r1: m.startRowIndex + 1,
      c1: m.startColumnIndex + 1,
      r2: (m.startRowIndex || 0) + (m.rowCount || 0),
      c2: (m.startColumnIndex || 0) + (m.columnCount || 0),
    })),
    cells,
  }

  const tmpDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir)
  }

  const outPath = getClassicSchemePath()
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))

  console.log(`\n✅ Success! Scanned ${Object.keys(cells).length} cells.`) 
  console.log(`   Wrote scheme to: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
