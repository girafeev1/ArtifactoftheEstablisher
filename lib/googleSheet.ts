import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import type { ClassicInvoiceScheme } from './pdfTemplates/classicInvoiceScheme';
import { getClassicSchemePath } from './pdfTemplates/classicInvoiceScheme';

const SPREADSHEET_ID = "12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0";
// Instruction sheet tab for the classic single‑item invoice layout.
// Previously this was pointing at the Sample tab (gid 598129981); we now
// treat the Instruction tab (gid 403093960) as the canonical source of
// schematics.
const SHEET_ID = 403093960;
const RANGE = "A1:N202";

// Normalise a Google Sheets color into our 0–1 RGB triple. The API can
// represent colors either as a hex string or as separate red/green/blue
// floats, so we support both. Earlier versions only handled the hex form,
// which meant background fills and text colors that used plain RGB values
// never made it into the scheme.
function toUnitRgb(
  color:
    | { hex?: string | null; red?: number | null; green?: number | null; blue?: number | null }
    | null
    | undefined,
) {
  if (!color) return null;

  // 1) Hex string form (e.g. "#cccccc").
  if (typeof (color as any).hex === "string") {
    const hex = (color as any).hex as string;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    return {
      red: parseInt(result[1], 16) / 255,
      green: parseInt(result[2], 16) / 255,
      blue: parseInt(result[3], 16) / 255,
    };
  }

  // 2) Direct RGB float form (0–1 range).
  const { red, green, blue } = color as any;
  if (
    typeof red === "number" ||
    typeof green === "number" ||
    typeof blue === "number"
  ) {
    return {
      red: red ?? 0,
      green: green ?? 0,
      blue: blue ?? 0,
    };
  }

  return null;
}

export async function fetchClassicScheme(): Promise<ClassicInvoiceScheme | null> {
  // 1) Prefer a locally cached JSON scheme (written to tmp/classic-instruction-scheme.json)
  // so that we are no longer dependent on the live Instruction sheet at runtime.
  const localPath = getClassicSchemePath();
  if (fs.existsSync(localPath)) {
    try {
      const raw = fs.readFileSync(localPath, 'utf8');
      return JSON.parse(raw) as ClassicInvoiceScheme;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[fetchClassicScheme] Failed to read local scheme, falling back to Google Sheets', err);
    }
  }

  // Read credentials from environment variables
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    includeGridData: true,
    // We omit explicit ranges so that grid data is returned for every sheet;
    // we then select the sheet we care about by SHEET_ID. This avoids subtle
    // interactions between the requested ranges and which sheet receives
    // gridData when multiple tabs share the same A1 range.
  });

  const sheetList = spreadsheet.data.sheets || [];
  const sheet = sheetList.find((s) => s.properties?.sheetId === SHEET_ID);
  if (!sheet) {
    // eslint-disable-next-line no-console
    console.error(
      '[fetchClassicScheme] Sheet not found for SHEET_ID',
      SHEET_ID,
      'available:',
      sheetList.map((s) => ({
        id: s.properties?.sheetId,
        title: s.properties?.title,
      })),
    );
    return null;
  }

  const gridData = sheet.data?.[0];
  if (!gridData) {
    // eslint-disable-next-line no-console
    console.error(
      '[fetchClassicScheme] No gridData for SHEET_ID',
      SHEET_ID,
      'title:',
      sheet.properties?.title,
    );
    return null;
  }

  const columnWidthsPx =
    gridData.columnMetadata?.map((c) => c.pixelSize || 0) || [];
  const rowHeightsPx =
    gridData.rowMetadata?.map((r) => r.pixelSize || 0) || [];

  // Merges are defined at the Sheet level, not per‑GridData range. Our
  // earlier implementation mistakenly read `gridData.merges`, which is
  // always empty for the A1:N202 slice we request. As a result the runtime
  // believed there were no merged cells and rendered every cell as a 1×1
  // block, breaking alignment with the Instruction sheet. Use `sheet.merges`
  // instead and normalise into 1‑based r1/c1/r2/c2 coordinates.
  const merges = sheet.merges || [];

  const cells: Record<string, any> = {};
  gridData.rowData?.forEach((row, r) => {
    row.values?.forEach((cell, c) => {
      const key = `${r + 1}:${c + 1}`;
      const value = cell.formattedValue || "";

      const ef = cell.effectiveFormat;
      if (!ef) {
        cells[key] = { value };
        return;
      }

      cells[key] = {
        value,
        fontFamily: ef.textFormat?.fontFamily || null,
        fontSize: ef.textFormat?.fontSize || null,
        bold: ef.textFormat?.bold || false,
        italic: ef.textFormat?.italic || false,
        fgColor: toUnitRgb(ef.textFormat?.foregroundColorStyle?.rgbColor as any),
        bgColor: toUnitRgb(ef.backgroundColorStyle?.rgbColor as any),
        hAlign: ef.horizontalAlignment || "LEFT",
        vAlign: ef.verticalAlignment || "TOP",
        wrapStrategy: ef.wrapStrategy || "OVERFLOW_CELL",
        border: ef.borders || {},
      };
    });
  });

  const scheme: ClassicInvoiceScheme = {
    spreadsheetId: SPREADSHEET_ID,
    sheetId: SHEET_ID,
    sheetTitle: sheet.properties?.title || "",
    scannedAt: new Date().toISOString(),
    columnWidthsPx,
    rowHeightsPx,
    merges: merges.map((m) => {
      const startRow = m.startRowIndex ?? 0;
      const endRow = m.endRowIndex ?? startRow + 1;
      const startCol = m.startColumnIndex ?? 0;
      const endCol = m.endColumnIndex ?? startCol + 1;
      return {
        // Convert 0‑based inclusive/exclusive GridRange into 1‑based
        // inclusive coordinates.
        r1: startRow + 1,
        c1: startCol + 1,
        r2: endRow,
        c2: endCol,
      };
    }),
    cells,
  };

  // Cache the freshly fetched scheme locally so subsequent runs use the
  // stable “golden” snapshot without hitting the Sheets API.
  try {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify(scheme, null, 2), 'utf8');
    // eslint-disable-next-line no-console
    console.log('[fetchClassicScheme] Wrote scheme snapshot to', localPath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[fetchClassicScheme] Failed to write local scheme snapshot', err);
  }

  return scheme;
}
