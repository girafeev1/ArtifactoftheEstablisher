const fs = require('fs');
const path = require('path');

// Load the paginated scheme
const schemePath = path.join(process.cwd(), 'tmp', 'paginated-invoice-scheme.json');
const scheme = JSON.parse(fs.readFileSync(schemePath, 'utf8'));

console.log('Extracting sections from paginated scheme...\n');

/**
 * Extract a section from the scheme
 * @param {string} sectionId - Section identifier
 * @param {number} startRow - Start row (1-based)
 * @param {number} endRow - End row (1-based, inclusive)
 * @param {string} type - Section type
 * @param {string} description - Section description
 */
function extractSection(sectionId, startRow, endRow, type, description) {
  const rowCount = endRow - startRow + 1;

  // Extract row heights for this section
  const rowHeightsPx = [];
  for (let r = startRow; r <= endRow; r++) {
    rowHeightsPx.push(scheme.rowHeightsPx[r - 1] || 0);
  }

  // Extract cells for this section (convert to section-relative coordinates)
  const cells = {};
  for (let r = startRow; r <= endRow; r++) {
    for (let c = 1; c <= 14; c++) {
      const originalKey = `${r}:${c}`;
      if (scheme.cells[originalKey]) {
        const sectionRow = r - startRow + 1;
        const newKey = `${sectionRow}:${c}`;
        cells[newKey] = scheme.cells[originalKey];
      }
    }
  }

  // Extract merges for this section (convert to section-relative coordinates)
  const merges = [];
  scheme.merges.forEach(m => {
    // Check if merge overlaps with this section
    if (m.r1 >= startRow && m.r1 <= endRow) {
      merges.push({
        r1: m.r1 - startRow + 1,
        c1: m.c1,
        r2: Math.min(m.r2, endRow) - startRow + 1,
        c2: m.c2,
      });
    }
  });

  const section = {
    id: sectionId,
    name: sectionId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    version: '1.0.0',
    type,
    rowCount,
    columnWidthsPx: scheme.columnWidthsPx,
    rowHeightsPx,
    cells,
    merges,
    metadata: {
      repeatable: type === 'item-row',
      description,
      extractedFrom: {
        spreadsheetId: scheme.spreadsheetId,
        sheetId: scheme.sheetId,
        rows: `${startRow}-${endRow}`,
        scannedAt: scheme.scannedAt,
      },
    },
  };

  // Save section
  const outputDir = path.join(process.cwd(), 'tmp', 'invoice-sections');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${sectionId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(section, null, 2), 'utf8');

  console.log(`✓ Extracted ${sectionId}`);
  console.log(`  Rows: ${startRow}-${endRow} (${rowCount} rows)`);
  console.log(`  Cells: ${Object.keys(cells).length}`);
  console.log(`  Merges: ${merges.length}`);
  console.log(`  Saved to: ${outputPath}\n`);

  return section;
}

// Extract all sections
extractSection(
  'header-versionB-full',
  1, 22,
  'header',
  'Full header for Version B Page 1 with logo, subsidiary info, client info, invoice metadata, project info, and FPS QR code'
);

extractSection(
  'header-continuation-minimal',
  52, 61,
  'continuation-header',
  'Minimal header for continuation pages with just branding, invoice number, and date'
);

extractSection(
  'item-table-header',
  23, 23,
  'table-header',
  'Column headers for item table (DESCRIPTION | AMOUNT)'
);

extractSection(
  'item-row-template',
  25, 27,
  'item-row',
  'Repeatable item row template with title, fee type, unit price, quantity, and notes'
);

extractSection(
  'total-box',
  91, 93,
  'totals',
  'Invoice total box with Chinese, English, and numeric amounts'
);

extractSection(
  'footer-continuation-simple',
  50, 51,
  'footer',
  'Simple continuation footer with subsidiary name and contact info'
);

extractSection(
  'footer-full-payment',
  98, 107,
  'footer',
  'Full payment footer with bank details, FPS ID, and payment terms'
);

// ============================================
// PAYMENT DETAILS PAGE (Full standalone page)
// ============================================
extractSection(
  'page-payment-details',
  161, 201,
  'standalone-page',
  'Full Payment Details page with beneficiary info, bank details, FPS QR code, and Terms & Conditions'
);

// ============================================
// PAYMENT INSTRUCTIONS PAGE (Full standalone page)
// ============================================
extractSection(
  'page-payment-instructions',
  202, 252,
  'standalone-page',
  'Full Payment Instructions page with cheque and bank transfer payment methods'
);

// ============================================
// ADDITIONAL SECTIONS FOR GRANULAR COMPOSITION
// ============================================

// Payment Details - Header section
extractSection(
  'payment-details-header',
  161, 172,
  'page-header',
  'Payment Details page header with title and subsidiary branding'
);

// Payment Details - Bank info section
extractSection(
  'payment-details-bank-info',
  173, 190,
  'payment-info',
  'Bank details section with beneficiary, bank code, branch, FPS ID, and QR code'
);

// Payment Details - Terms & Conditions
extractSection(
  'payment-details-terms',
  195, 199,
  'terms',
  'Terms & Conditions section in English and Chinese'
);

// Payment Details - Footer
extractSection(
  'payment-details-footer',
  200, 201,
  'page-footer',
  'Payment Details page footer with subsidiary info'
);

// Payment Instructions - Header section
extractSection(
  'payment-instructions-header',
  202, 210,
  'page-header',
  'Payment Instructions page header with title and payment deadline notice'
);

// Payment Instructions - Cheque method
extractSection(
  'payment-instructions-cheque',
  211, 230,
  'payment-method',
  'Payable cheque section with cheque writing guide and amount details'
);

// Payment Instructions - Transfer method
extractSection(
  'payment-instructions-transfer',
  231, 248,
  'payment-method',
  'Bank transfer section with account details, FPS ID, and QR code'
);

// Payment Instructions - Footer
extractSection(
  'payment-instructions-footer',
  251, 252,
  'page-footer',
  'Payment Instructions page footer with subsidiary info'
);

console.log('✓ All sections extracted successfully!');
