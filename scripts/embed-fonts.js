#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const INPUT_DIR = path.resolve(ROOT, 'public', 'pdf-fonts')
const OUTPUT = path.resolve(ROOT, 'lib', 'pdfTemplates', 'fontData.ts')

// Only include files that are known to be real TTF binaries in this repo.
// Some of the other filenames that exist under public/pdf-fonts are actually
// HTML "download" pages, which would cause "Unknown font format" errors if
// embedded. If you add more fonts, make sure `file` reports them as a real
// font before adding their names here.
const CANDIDATES = [
  // Latin mono + bold for body copy and numbers
  'RobotoMono-Regular.ttf',
  'RobotoMono-Bold.ttf',

  // Display / UI fonts
  'VarelaRound-Regular.ttf',
  'RampartOne-Regular.ttf',

  // Karla family for headings / labels
  'Karla-Regular.ttf',
  'Karla-Bold.ttf',
  'Karla-Italic.ttf',
  'Karla-BoldItalic.ttf',

  // Serif families for headers
  'CormorantInfant-Regular.ttf',
  'CormorantInfant-Bold.ttf',
  'EBGaramond-Regular.ttf',
  'EBGaramond-Bold.ttf',

  // CJK + mixed CJK/Latin display
  'Iansui-Regular.ttf',
  'YujiMai-Regular.ttf',

  // Display font for InvoiceTotalEnglish
  'Federo-Regular.ttf',
]

function b64(file) {
  const p = path.join(INPUT_DIR, file)
  if (!fs.existsSync(p)) return null
  const buf = fs.readFileSync(p)
  return buf.toString('base64')
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[embed-fonts] Missing input dir: ${INPUT_DIR}`)
    process.exit(1)
  }
  const out = {}
  for (const name of CANDIDATES) {
    const data = b64(name)
    if (data) out[name] = data
    else console.warn(`[embed-fonts] Skipped missing ${name}`)
  }

  const header = `// Auto-generated base64 font data\nexport const FONT_DATA = ${JSON.stringify(out, null, 2)} as const\n`
  fs.writeFileSync(OUTPUT, header, 'utf8')
  console.log(`[embed-fonts] Wrote ${OUTPUT} with ${Object.keys(out).length} font(s).`)
}

main()
