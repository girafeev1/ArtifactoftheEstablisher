/*
  Script: scan-invoice-template.js
  Purpose: One-time read-only scan of the shared Google Sheet template to extract
           geometry (row heights, column widths), merge ranges, common formatting,
           and likely anchor labels. Outputs a JSON snapshot to tmp/ for native PDF renderer tuning.

  Usage: from repo root
    cd dev/ArtifactoftheEstablisher && node scripts/scan-invoice-template.js \
      --id 12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0 \
      --gid 598129981
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
      // strip wrapping quotes
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

(async () => {
  try {
    const spreadsheetId = arg('--id', '12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0');
    const gid = arg('--gid', '598129981');
    const envPath = path.join('.env.local');
    if (!fs.existsSync(envPath)) {
      console.error('Missing .env.local in current working directory');
      process.exit(1);
    }
    const env = parseEnvFile(envPath);
    let client_email = null;
    let private_key = null;
    // Prefer explicit service account JSON if it parses cleanly
    const svcJsonRaw = env.ACCOUNT_SERVICE_PRIVATE_KEY;
    if (svcJsonRaw) {
      // Attempt robust extraction without full JSON parse (handles escaped newlines safely)
      const ce = svcJsonRaw.match(/"client_email"\s*:\s*"([^"]+)"/);
      const pk = svcJsonRaw.match(/"private_key"\s*:\s*"([\s\S]*?)"\s*,\n/);
      if (ce && ce[1]) client_email = ce[1];
      if (pk && pk[1]) private_key = pk[1].replace(/\\n/g, '\n');
    }
    if (!client_email || !private_key) {
      // Fall back to FIREBASE_ADMIN_* variables
      const fe = env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const fk = env.FIREBASE_ADMIN_PRIVATE_KEY;
      if (!fe || !fk) {
        console.error('Missing service account credentials in .env.local');
        process.exit(1);
      }
      client_email = fe;
      private_key = fk.replace(/\\n/g, '\n');
    }
    if (!client_email || !private_key) {
      console.error('Invalid service account credentials');
      process.exit(1);
    }

    const jwt = new google.auth.JWT({
      email: client_email,
      key: private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });
    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    // Fetch sheet list and pick the target gid
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,gridProperties),merges)',
    });
    const sheetsList = meta.data.sheets || [];
    let target = sheetsList.find(s => s.properties && String(s.properties.sheetId) === String(gid));
    if (!target && sheetsList.length) target = sheetsList[0];
    if (!target) {
      console.error('No sheets found in spreadsheet.');
      process.exit(1);
    }
    const sheetTitle = target.properties.title;
    const sheetId = target.properties.sheetId;
    const gridProps = target.properties.gridProperties || {};

    // Fetch rich grid data with formatting in a second call
    // Fetch a bounded grid with formatting. Some field filters can cause
    // `invalidArgument` on certain docs, so avoid aggressive field selection
    // and instead limit the range to a sane viewport.
    const boundedRange = `${sheetTitle}!A1:N202`;
    const resp = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [boundedRange],
      includeGridData: true,
    });
    const sh = (resp.data.sheets || [])[0];
    // row/col metadata are not returned in this includeGridData call reliably; second pass below will fetch them
    let rowMeta = [];
    let colMeta = [];
    const merges = (sh.merges || []).map(m => ({ sr: m.startRowIndex, er: m.endRowIndex, sc: m.startColumnIndex, ec: m.endColumnIndex }));

    // Second pass: fetch default row/col sizes and dimension metadata if present
    let defaults = { defaultRowHeight: null, defaultColumnWidth: null };
    try {
      const metaAll = await sheets.spreadsheets.get({ spreadsheetId });
      const allSheets = metaAll.data.sheets || [];
      const me = allSheets.find(s => s.properties && s.properties.sheetId === sheetId);
      if (me && me.properties && me.properties.gridProperties) {
        const gp = me.properties.gridProperties;
        defaults.defaultRowHeight = gp.defaultRowHeight || null;
        defaults.defaultColumnWidth = gp.defaultColumnWidth || null;
      }
      // Populate row/column metadata pixel sizes when available
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
      // Non-fatal; keep defaults/metadata null/empty
    }

    const data = sh.data && sh.data[0];
    const fonts = new Set();
    const alignH = new Set();
    const alignV = new Set();
    let bordersCount = 0;
    const anchors = [];

    // Scan a reasonable region for formatting/anchors
    if (data && data.rowData) {
      const maxRows = Math.min(data.rowData.length, 120);
      for (let r = 0; r < maxRows; r++) {
        const row = data.rowData[r];
        const values = (row && row.values) || [];
        const maxCols = Math.min(values.length, 16);
        for (let c = 0; c < maxCols; c++) {
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
          // Anchor detection
          if (v.userEnteredValue && v.userEnteredValue.stringValue) {
            const text = v.userEnteredValue.stringValue.trim();
            if (!text) continue;
            const lower = text.toLowerCase();
            const anchorKeys = ['invoice', 'total', 'amount', 'to:', 'attn', 'description', 'amount'];
            if (anchorKeys.some(k => lower.includes(k))) {
              anchors.push({ r, c, text });
            }
          }
        }
      }
    }

    // Prepare snapshot
    const out = {
      spreadsheetId,
      sheet: { title: sheetTitle, sheetId, grid: gridProps },
      rowHeights: rowMeta,
      colWidths: colMeta,
      merges,
      defaults,
      formats: {
        fonts: Array.from(fonts),
        horizontalAlignments: Array.from(alignH),
        verticalAlignments: Array.from(alignV),
        bordersCellsSampled: bordersCount,
      },
      anchors,
      scannedAt: new Date().toISOString(),
    };

    const outDir = path.join('tmp');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `sheet_template_snapshot_${sheetId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    // Console summary
    console.log('Sheet:', out.sheet);
    console.log('Row heights (count):', out.rowHeights.length, 'Sample:', out.rowHeights.slice(0, 10));
    console.log('Column widths (count):', out.colWidths.length, 'Sample:', out.colWidths.slice(0, 10));
    console.log('Defaults:', out.defaults);
    console.log('Merges count:', out.merges.length, 'Sample:', out.merges.slice(0, 10));
    console.log('Formats summary:', out.formats);
    console.log('Anchor labels (sample):', out.anchors.slice(0, 12));
    console.log('Saved snapshot to', outPath);
  } catch (e) {
    console.error('Scan error:', e && e.message || e);
    process.exit(1);
  }
})();
