/*
  Script: scan-spreadsheet-all.js
  Purpose: Read ALL sheets in a Google Spreadsheet and write a JSON snapshot per sheet
           (anchors, merges, grid props, defaults, sample formats) to tmp/ for renderer work.

  Usage: from repo root
    cd dev/ArtifactoftheEstablisher && node scripts/scan-spreadsheet-all.js \
      --id 12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0
*/

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

function arg(key, def) {
  const idx = process.argv.indexOf(key);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function indexToLetters(index) {
  // 1-based column index to letters (A=1)
  let value = index;
  let result = '';
  while (value > 0) {
    const rem = (value - 1) % 26;
    result = alphabet[rem] + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

(async () => {
  try {
    const spreadsheetId = arg('--id', '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0');
    const envPath = path.join('.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('Missing .env.local in current working directory');
      process.exit(1);
    }
    const env = parseEnvFile(envPath);
    let client_email = null;
    let private_key = null;

    const svcJsonRaw = env.ACCOUNT_SERVICE_PRIVATE_KEY;
    if (svcJsonRaw) {
      const ce = svcJsonRaw.match(/"client_email"\s*:\s*"([^"]+)"/);
      const pk = svcJsonRaw.match(/"private_key"\s*:\s*"([\s\S]*?)"\s*,\n/);
      if (ce && ce[1]) client_email = ce[1];
      if (pk && pk[1]) private_key = pk[1].replace(/\\n/g, '\n');
    }
    if (!client_email || !private_key) {
      const fe = env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const fk = env.FIREBASE_ADMIN_PRIVATE_KEY;
      if (!fe || !fk) {
        console.error('Missing service account credentials in .env.local');
        process.exit(1);
      }
      client_email = fe;
      private_key = fk.replace(/\\n/g, '\n');
    }

    const jwt = new google.auth.JWT({
      email: client_email,
      key: private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    // Get all sheets with properties
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,gridProperties))',
    });
    const sheetsList = meta.data.sheets || [];
    if (sheetsList.length === 0) {
      console.error('No sheets found.');
      process.exit(1);
    }

    const outDir = path.join('tmp');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const index = [];

    for (const s of sheetsList) {
      const props = s.properties || {};
      const title = props.title;
      const sheetId = props.sheetId;
      const gridProps = props.gridProperties || {};
      const rowCount = gridProps.rowCount || 200;
      const colCount = gridProps.columnCount || 14;
      const endColLetters = indexToLetters(colCount);
      // Bound the range to sheet size (safe upper bound)
      const boundedRange = `${title}!A1:${endColLetters}${rowCount}`;

      const resp = await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [boundedRange],
        includeGridData: true,
      });
      const sh = (resp.data.sheets || [])[0];
      const merges = (sh.merges || []).map(m => ({ sr: m.startRowIndex, er: m.endRowIndex, sc: m.startColumnIndex, ec: m.endColumnIndex }));
      const data = sh.data && sh.data[0];
      const fonts = new Set();
      const alignH = new Set();
      const alignV = new Set();
      let bordersCount = 0;
      const anchors = [];
      let textRunsCount = 0;
      const textRunsSample = [];

      if (data && data.rowData) {
        const maxRows = Math.min(data.rowData.length, rowCount);
        const sampleCols = Math.min(colCount, 32);
        for (let r = 0; r < maxRows; r++) {
          const row = data.rowData[r];
          const values = (row && row.values) || [];
          for (let c = 0; c < Math.min(values.length, sampleCols); c++) {
            const v = values[c];
            if (!v) continue;
            if (v.userEnteredFormat) {
              const f = v.userEnteredFormat;
              if (f.textFormat) {
                const fam = f.textFormat.fontFamily || 'default';
                fonts.add(fam);
              }
              if (f.horizontalAlignment) alignH.add(f.horizontalAlignment);
              if (f.verticalAlignment) alignV.add(f.verticalAlignment);
              if (f.borders) bordersCount++;
            }
            if (Array.isArray(v.textFormatRuns) && v.textFormatRuns.length > 0) {
              textRunsCount += 1;
              if (textRunsSample.length < 50) {
                const text = v.userEnteredValue && v.userEnteredValue.stringValue ? v.userEnteredValue.stringValue : '';
                textRunsSample.push({ r, c, text, runs: v.textFormatRuns });
              }
            }
            if (v.userEnteredValue && v.userEnteredValue.stringValue) {
              const text = v.userEnteredValue.stringValue.trim();
              if (!text) continue;
              const lower = text.toLowerCase();
              const keys = ['invoice', 'invoice #', 'bill to', 'attn', 'description', 'amount', 'total', 'for the amount'];
              if (keys.some(k => lower.includes(k))) {
                anchors.push({ r, c, text });
              }
            }
          }
        }
      }

      // Second pass for defaults and dimension metadata
      let defaults = { defaultRowHeight: null, defaultColumnWidth: null };
      let rowMeta = [];
      let colMeta = [];
      try {
        const metaAll = await sheets.spreadsheets.get({ spreadsheetId });
        const allSheets = metaAll.data.sheets || [];
        const me = allSheets.find(x => x.properties && x.properties.sheetId === sheetId);
        if (me && me.properties && me.properties.gridProperties) {
          const gp = me.properties.gridProperties;
          defaults.defaultRowHeight = gp.defaultRowHeight || null;
          defaults.defaultColumnWidth = gp.defaultColumnWidth || null;
        }
        if (me && Array.isArray(me.rowMetadata)) {
          rowMeta = me.rowMetadata
            .map((r, i) => ({ index: i, px: r && typeof r.pixelSize === 'number' ? r.pixelSize : null }))
            .filter(r => typeof r.px === 'number');
        }
        if (me && Array.isArray(me.columnMetadata)) {
          colMeta = me.columnMetadata
            .map((c, i) => ({ index: i, px: c && typeof c.pixelSize === 'number' ? c.pixelSize : null }))
            .filter(c => typeof c.px === 'number');
        }
      } catch (e) {
        // non-fatal
      }

      const out = {
        spreadsheetId,
        sheet: { title, sheetId, grid: gridProps },
        rowHeights: rowMeta,
        colWidths: colMeta,
        defaults,
        merges,
        formats: {
          fonts: Array.from(fonts),
          horizontalAlignments: Array.from(alignH),
          verticalAlignments: Array.from(alignV),
          bordersCellsSampled: bordersCount,
        },
        anchors,
        textRuns: { count: textRunsCount, sample: textRunsSample },
        scannedAt: new Date().toISOString(),
      };

      const outPath = path.join(outDir, `sheet_template_snapshot_${sheetId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
      index.push({ title, sheetId, path: outPath });

      console.log(`Saved snapshot for [${title}] (${sheetId}) to ${outPath}`);
    }

    const indexPath = path.join(outDir, `sheet_template_index.json`);
    fs.writeFileSync(indexPath, JSON.stringify({ spreadsheetId, sheets: index }, null, 2), 'utf8');
    console.log('Wrote index:', indexPath);
  } catch (e) {
    console.error('Scan error:', e && e.message || e);
    process.exit(1);
  }
})();
