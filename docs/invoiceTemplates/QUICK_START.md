# Quick Start Guide - Dynamic Invoice System

## For Developers: Testing the New System

### 1. Access the Enhanced Preview Page

Navigate to any invoice and modify the URL:

**From:**
```
/dashboard/new-ui/projects/show/ABC123/invoice/INV-001/preview
```

**To:**
```
/dashboard/new-ui/projects/show/ABC123/invoice/INV-001/preview-enhanced
```

### 2. Toggle Between Renderers

You'll see a new control panel at the top:

```
┌─────────────────────────────────────────┐
│ Rendering Engine:                       │
│                                          │
│ ○ Classic (Hardcoded Grid)              │
│ ● Dynamic (Modular Pagination)          │
│                                          │
│ ✓ Dynamic layout ready: 2 page(s),      │
│   multi-page                             │
└─────────────────────────────────────────┘
```

### 3. Compare Side-by-Side

1. **Classic Mode:** Original hardcoded 202-row grid
2. **Dynamic Mode:** New modular section-based system

Both should look identical visually.

---

## For System Administrators: Updating Invoice Templates

### Option 1: Update Sections in Google Sheets (Recommended)

1. Open the Google Sheets template:
   ```
   https://docs.google.com/spreadsheets/d/12QpO_T2EV6Zke4DmNg4in2zYtGlh0q4daNI2eeiAdU0
   ```

2. Make your changes (e.g., update footer text, change fonts, modify layout)

3. Run the extraction script:
   ```bash
   node scripts/fetch-paginated-scheme.js
   node scripts/extract-sections.js
   ```

4. Sections are automatically updated in `tmp/invoice-sections/*.json`

5. Test the changes:
   ```bash
   npx tsx scripts/test-dynamic-pagination.js
   ```

6. No code changes needed - sections are loaded dynamically!

### Option 2: Create New Section Variants

To create a new footer variant (e.g., "footer-minimal"):

1. Design the footer in Google Sheets (e.g., rows 120-125)

2. Add to `scripts/extract-sections.js`:
   ```javascript
   extractSection('footer-minimal', 120, 125, 'footer', 'Minimal footer variant');
   ```

3. Re-run extraction:
   ```bash
   node scripts/extract-sections.js
   ```

4. Reference in pagination engine:
   ```typescript
   footer: 'footer-minimal'  // instead of 'footer-full-payment'
   ```

---

## For Product Managers: Feature Testing Checklist

### Test Cases to Validate

- [ ] **1 item invoice** - Should use single-page layout with generous spacing
- [ ] **3 item invoice** - Should use single-page layout with moderate spacing
- [ ] **5 item invoice** - Should use single-page layout with compact spacing
- [ ] **7 item invoice** - Should use 2-page layout (5 items on page 1, 2 on page 2)
- [ ] **10 item invoice** - Should use 2-page layout with balanced distribution (5+5)
- [ ] **20 item invoice** - Should use 3-4 page layout with continuation pages

### Visual Checks

- [ ] Client company name displays correctly
- [ ] Invoice number shows on all pages
- [ ] Total box appears only on last page
- [ ] Footer shows full payment instructions on last page
- [ ] Footer shows "continued..." on intermediate pages
- [ ] FPS QR code displays (if bank info provided)
- [ ] All fonts render correctly (Roboto Mono, Karla, EB Garamond)
- [ ] Grid overlay works (toggle switch)

### Functional Checks

- [ ] PDF export works with dynamic renderer
- [ ] Page breaks occur at correct positions
- [ ] Token replacements work (`<ClientCompanyName>` → actual value)
- [ ] Multi-page invoices don't orphan single items
- [ ] Spacing adjusts based on item count

---

## For AI Agents: Common Tasks

### Task: "Add a new header variant"

```
1. Design new header in Google Sheets (e.g., rows 150-170)
2. Extract section:
   extractSection('header-versionC-full', 150, 170, 'header', 'Version C header');
3. Update paginationEngine.ts to reference 'header-versionC-full'
4. Test with: npx tsx scripts/test-dynamic-pagination.js
```

### Task: "Change spacing rules for 4-item invoices"

```
1. Edit lib/invoiceTemplates/spacingCalculator.ts
2. Modify getSpacingRules() for itemCount === 4:
   if (itemCount === 4) return { preItemSpacing: 2, betweenItemSpacing: 3, beforeTotalSpacing: 3 };
3. Run tests: npx jest lib/invoiceTemplates/__tests__/pagination.test.ts
4. Verify visually in preview-enhanced.tsx
```

### Task: "Create invoice variant without FPS QR code"

```
1. Create new footer section without QR code placeholder
2. Add condition in DynamicInvoice.tsx:
   if (displayValue.includes('<FPS QR Code>')) return null; // hide QR
3. Reference new footer section ID in paginationEngine.ts
```

---

## Troubleshooting

### Issue: "Section not found" error

**Cause:** Section JSON file missing from `tmp/invoice-sections/`

**Fix:**
```bash
node scripts/fetch-paginated-scheme.js
node scripts/extract-sections.js
```

### Issue: Dynamic renderer shows blank page

**Cause:** Missing invoice data or composedLayout

**Fix:**
1. Check browser console for errors
2. Verify API endpoint returns composedLayout:
   ```bash
   curl http://localhost:3000/api/invoices/2024/PROJECT123/INV-001/dynamic
   ```
3. Check that paginationEngine doesn't throw errors

### Issue: Spacing looks wrong

**Cause:** Spacing rules not matching expectations

**Fix:**
1. Check spacing rules in `spacingCalculator.ts`
2. Run visual test:
   ```bash
   npx tsx scripts/test-dynamic-pagination.js
   ```
3. Compare output with expected values in README.md

### Issue: Tests failing

**Cause:** Capacity calculations changed

**Fix:**
1. Update test expectations in `__tests__/pagination.test.ts`
2. Or adjust spacing rules to meet original capacity
3. Run tests: `npx jest lib/invoiceTemplates/__tests__/pagination.test.ts`

---

## Performance Tips

### For Large Invoices (50+ items)

The dynamic system handles large invoices efficiently:
- Section loading: O(1) - sections loaded once, cached in memory
- Pagination calculation: O(n) - linear with item count
- Composition: O(n × sections) - scales linearly

**Optimization:**
- Pre-compose layouts server-side (API endpoint does this)
- Cache composed layouts in Redis/memory cache
- Use React.memo() for DynamicInvoice component

### For Frequent Template Updates

If you update templates often:
1. Store sections in database instead of JSON files
2. Add versioning to sections (v1, v2, etc.)
3. Cache compiled layouts by invoice ID
4. Invalidate cache when sections update

---

## API Reference

### Endpoint: GET `/api/invoices/[year]/[projectId]/[invoiceNumber]/dynamic`

**Response:**
```json
{
  "invoice": { /* ProjectInvoiceRecord */ },
  "composedLayout": {
    "pages": [
      {
        "pageNumber": 1,
        "totalRows": 58,
        "columnWidthsPx": [100, 150, ...],
        "rowHeightsPx": [21, 21, ...],
        "cells": {
          "1:1": { "value": "Logo", "fontFamily": "Roboto Mono", ... },
          ...
        },
        "merges": [
          { "r1": 1, "c1": 1, "r2": 4, "c2": 3 }
        ],
        "sections": [...]
      }
    ],
    "totalPages": 2,
    "metadata": {
      "composedAt": "2025-12-13T10:28:53.686Z",
      "itemCount": 10,
      "layoutMode": "multi-page"
    }
  },
  "paginationResult": {
    "totalPages": 2,
    "itemDistribution": [5, 5],
    "layoutMode": "multi-page"
  }
}
```

---

## File Structure Reference

```
lib/invoiceTemplates/
├── schema.ts                    # TypeScript types
├── spacingCalculator.ts         # Spacing rules
├── paginationEngine.ts          # Page layout calculator
├── layoutComposer.ts            # Section assembly
├── __tests__/
│   └── pagination.test.ts       # Test suite
├── QUICK_START.md              # This file
├── README.md                   # System overview
├── IMPLEMENTATION_SUMMARY.md   # Implementation details
└── ...

tmp/invoice-sections/
├── header-versionB-full.json
├── header-continuation-minimal.json
├── item-table-header.json
├── item-row-template.json
├── total-box.json
├── footer-continuation-simple.json
├── footer-full-payment.json
└── README.md

components/projects/
├── GeneratedInvoice.tsx        # Classic renderer (existing)
└── DynamicInvoice.tsx          # Dynamic renderer (NEW)

pages/api/invoices/[...]/
├── index.ts                    # Classic endpoint (existing)
└── dynamic.ts                  # Dynamic endpoint (NEW)

pages/dashboard/.../invoice/[...]/
├── preview.tsx                 # Classic preview (existing)
└── preview-enhanced.tsx        # Toggle preview (NEW)

scripts/
├── fetch-paginated-scheme.js   # Fetch from Google Sheets
├── extract-sections.js         # Extract sections
└── test-dynamic-pagination.js  # Integration test
```

---

## Contact & Support

For questions or issues:
1. Check documentation in `lib/invoiceTemplates/`
2. Run tests: `npx jest lib/invoiceTemplates/__tests__/pagination.test.ts`
3. Review implementation summary: `IMPLEMENTATION_SUMMARY.md`
4. Check GitHub issues: [Add your repo URL]

---

**Remember:** This system runs in parallel with the existing classic renderer. You can always fall back to the classic mode by toggling the radio button!
