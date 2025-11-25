#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const INPUT_DIR = path.resolve(ROOT, 'public', 'pdf-fonts')
const OUTPUT = path.resolve(ROOT, 'lib', 'pdfTemplates', 'fontData.ts')

const CANDIDATES = [
  'RobotoMono-Regular.ttf',
  'RobotoMono-Bold.ttf',
  'VarelaRound-Regular.ttf',
  'RampartOne-Regular.ttf',
  'Iansui-Regular.ttf',
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

