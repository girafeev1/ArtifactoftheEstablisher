# Dynamic Invoice Generation System

Complete modular system for generating paginated invoices with dynamic spacing and aesthetic balancing.

---

## Overview

This system replaces the hardcoded 202-row grid with a flexible, section-based architecture that:
- ✅ Automatically paginates invoices based on item count
- ✅ Applies aesthetic spacing rules (more space for fewer items)
- ✅ Balances item distribution across pages (avoids 5+1, prefers 3+3)
- ✅ Uses modular, reusable sections extracted from Google Sheets
- ✅ Maintains pixel-perfect formatting from the original design

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Invoice Data (items, client, project)                 │
│                                                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────┐
│  Pagination Engine (paginationEngine.ts)                │
│  - Calculates pages needed                             │
│  - Applies spacing rules                               │
│  - Distributes items aesthetically                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────┐
│  Layout Composer (layoutComposer.ts)                    │
│  - Loads section JSON files                            │
│  - Assembles pages from sections                       │
│  - Merges cells, borders, formatting                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────┐
│  Rendering (GeneratedInvoice.tsx - to be updated)      │
│  - Renders composed pages as HTML/CSS Grid             │
│  - Exports to PDF via Puppeteer                        │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Spacing Calculator (`spacingCalculator.ts`)

Implements user-defined spacing rules:

| Item Count | Pre-item | Between Items | Before Total |
|------------|----------|---------------|--------------|
| 1 item | 3 rows | - | 4 rows |
| 2 items | 3 rows | 3 rows | 4 rows |
| 3 items | 2 rows | 2 rows | 3 rows |
| 4 items | 1 row | 2 rows | 2 rows |
| 5+ items | 1 row | 2 rows | 2 rows |

**Key Functions:**
- `getSpacingRules(itemCount)` - Returns spacing rules for given item count
- `calculateItemSectionRows(itemCount)` - Calculates total rows needed
- `calculateItemCapacity(availableRows)` - Determines how many items fit
- `distributeItemsAcrossPages(totalItems)` - Balances items across pages

---

### 2. Pagination Engine (`paginationEngine.ts`)

Determines page structure and item distribution.

**Page Types:**
- **Single:** 1-5 items on one page (with total box and full footer)
- **First:** Page 1 of multi-page invoice (no total, simple footer)
- **Continuation:** Continuation pages (minimal header, last page has total + full footer)

**Capacities:**
- **Page 1:** ~5 items (27 rows available)
- **Continuation pages:** ~8 items (33 rows available)

**Key Function:**
```typescript
paginateInvoice(items: InvoiceItem[]): InvoicePaginationResult
```

Returns:
```typescript
{
  pages: PageLayout[],
  totalPages: number,
  itemDistribution: number[],  // e.g., [5, 3] for 8 items
  layoutMode: 'single-page' | 'multi-page'
}
```

---

### 3. Layout Composer (`layoutComposer.ts`)

Assembles extracted sections into complete page layouts.

**Sections Used:**
- `header-versionB-full` - Full header for Page 1
- `header-continuation-minimal` - Minimal header for continuation pages
- `item-table-header` - Column titles (DESCRIPTION | AMOUNT)
- `item-row-template` - Repeatable item template
- `total-box` - Invoice total (3 rows)
- `footer-continuation-simple` - Simple footer (2 rows)
- `footer-full-payment` - Full payment footer (10 rows)

**Key Function:**
```typescript
composeInvoice(pageLayouts: PageLayout[]): ComposedInvoice
```

Returns complete invoice with:
- Absolute cell coordinates
- Merged ranges
- Row heights
- All formatting preserved

---

## Usage Example

```typescript
import { paginateInvoice } from './paginationEngine';
import { composeInvoice } from './layoutComposer';

// Your invoice data
const items: InvoiceItem[] = [
  {
    title: 'Web Development Service',
    feeType: 'Professional Fee',
    unitPrice: 5000,
    quantity: 10,
    quantityUnit: 'hour',
    notes: 'Full-stack development work',
  },
  // ... more items
];

// Step 1: Calculate pagination
const pagination = paginateInvoice(items);

console.log(`Pages: ${pagination.totalPages}`);
console.log(`Distribution: [${pagination.itemDistribution.join(', ')}]`);

// Step 2: Compose full layout
const composed = composeInvoice(
  pagination.pages,
  items.length,
  pagination.layoutMode
);

// Step 3: Render (pass to GeneratedInvoice component)
// ... rendering logic
```

---

## Test Cases

Run tests with Jest:

```bash
npm test lib/invoiceTemplates/__tests__/pagination.test.ts
```

**Test Coverage:**
- ✅ Spacing rules for 1, 2, 3, 4, 5+ items
- ✅ Page capacity calculations
- ✅ Item distribution balancing (avoids orphan pages)
- ✅ Single-page invoices (1, 3, 5 items)
- ✅ Multi-page invoices (7, 10 items)
- ✅ Long notes handling
- ✅ Edge cases (0 items, 50 items)

---

## Files Structure

```
lib/invoiceTemplates/
├── schema.ts                    # TypeScript type definitions
├── spacingCalculator.ts         # Spacing rules implementation
├── paginationEngine.ts          # Page layout calculator
├── layoutComposer.ts            # Section assembly logic
├── __tests__/
│   └── pagination.test.ts       # Test suite
├── examples/                    # Example section JSON files
├── COMMUNICATION_GUIDE.md       # How to work with AI agents
├── PAGINATION_EXAMPLES.md       # Visual pagination examples
├── PAGINATED_ANALYSIS.md        # Analysis of Google Sheets template
└── README.md                    # This file

tmp/
├── paginated-invoice-scheme.json  # Full scheme from Google Sheets
└── invoice-sections/              # Extracted sections
    ├── header-versionB-full.json
    ├── header-continuation-minimal.json
    ├── item-table-header.json
    ├── item-row-template.json
    ├── total-box.json
    ├── footer-continuation-simple.json
    ├── footer-full-payment.json
    └── README.md

scripts/
├── fetch-paginated-scheme.js    # Fetch scheme from Google Sheets
└── extract-sections.js          # Extract sections from scheme
```

---

## Pagination Examples

### Example 1: 3 Items (Single Page)

```
┌─ Page 1 (single) ─────────────┐
│ Header (22 rows)              │
│ Table Header (1 row)          │
│ [2 rows spacing]              │
│ Item 1 (3 rows)               │
│ [2 rows spacing]              │
│ Item 2 (3 rows)               │
│ [2 rows spacing]              │
│ Item 3 (3 rows)               │
│ [3 rows spacing]              │
│ Total Box (3 rows)            │
│ [4 rows spacing]              │
│ Full Footer (10 rows)         │
└───────────────────────────────┘
Total: ~36 rows
```

### Example 2: 8 Items (Multi-Page)

```
┌─ Page 1 (first) ──────────────┐
│ Header (22 rows)              │
│ Table Header (1 row)          │
│ [1 row spacing]               │
│ Items 1-5 (15 rows)           │
│ [8 rows between items]        │
│ [2 rows spacing]              │
│ Simple Footer (2 rows)        │
└───────────────────────────────┘

┌─ Page 2 (continuation) ───────┐
│ Minimal Header (10 rows)      │
│ Table Header (1 row)          │
│ [2 rows spacing]              │
│ Items 6-8 (9 rows)            │
│ [4 rows between items]        │
│ [3 rows spacing]              │
│ Total Box (3 rows)            │
│ [4 rows spacing]              │
│ Full Footer (10 rows)         │
└───────────────────────────────┘
```

---

## Next Steps

1. ✅ Sections extracted from Google Sheets
2. ✅ Spacing calculator implemented
3. ✅ Pagination engine built
4. ✅ Layout composer created
5. ✅ Test suite written
6. ⏳ **Update GeneratedInvoice.tsx to use new system**
7. ⏳ **Test with real invoice data**
8. ⏳ **Verify PDF export works correctly**

---

## How to Add New Invoice Variants

### Option 1: Create New Sections

1. Design new section in Google Sheets
2. Run `node scripts/fetch-paginated-scheme.js`
3. Extract section: Add to `scripts/extract-sections.js`
4. Reference section ID in pagination engine

### Option 2: Modify Existing Sections

1. Update Google Sheets template
2. Re-fetch scheme
3. Re-extract sections (overwrites JSON files)
4. No code changes needed (sections auto-loaded)

---

## Communication with AI Agents

See `COMMUNICATION_GUIDE.md` for examples of how to request changes:

**Example:**
```
Create a new invoice variant using:
- Header: "header-versionB-full"
- Item section: "item-row-compact-v1" (create new - 2 rows per item)
- Footer: "footer-minimal-v1"

Pagination:
- 8 items per page in compact mode
- Remove all spacer rows
```

The AI will create the new sections and update the pagination logic accordingly.

---

## Benefits of This Architecture

✅ **Modular** - Sections are reusable and independently updatable
✅ **Maintainable** - Change footer = swap 1 section ID, not 202 rows
✅ **Testable** - Each component has isolated unit tests
✅ **Flexible** - Easy to create new invoice variants
✅ **AI-Friendly** - Clear schema for communicating with agents
✅ **Scalable** - Handles 1 to 100+ items with same code
✅ **Preserves Design** - Exact formatting from Google Sheets

---

## Questions?

See the documentation files:
- `COMMUNICATION_GUIDE.md` - How to work with AI agents
- `PAGINATION_EXAMPLES.md` - Visual examples
- `PAGINATED_ANALYSIS.md` - Design analysis
- `tmp/invoice-sections/README.md` - Section details
