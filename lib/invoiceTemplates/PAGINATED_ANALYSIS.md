# Paginated Invoice Template Analysis

Based on Google Sheets analysis (Rows 1-107 from the Instruction sheet).

---

## Structure Overview

Your design shows **Version B when fully packed with items** and a **continuation page** for pagination:

- **Rows 1-51:** Version B Page 1 (fully packed with 5 items)
- **Rows 52-107:** Continuation page (2 more items + full footer)

---

## KEY FINDINGS

### Page 1 (Rows 1-51): Fully Packed Version B

#### Upper Immovable Section (Rows 1-22):
Same as original analysis - header with logo, subsidiary info, client info, project info, FPS QR.

#### Item Section (Rows 23-49):
```
Row 23: Column headers ("DESCRIPTION" | "AMOUNT")
Row 24: [Spacer - 1 row before first item]

Item 1: Rows 25-27 (3 rows)
  R25: Item title + pricing (35px)
  R26: Fee type (24px)
  R27: Notes (21px)
Row 28-29: [Spacer - 2 rows between items]

Item 2: Rows 30-32 (3 rows)
Row 33-34: [Spacer - 2 rows]

Item 3: Rows 35-37 (3 rows)
Row 38-39: [Spacer - 2 rows]

Item 4: Rows 40-42 (3 rows)
Row 43-44: [Spacer - 2 rows]

Item 5: Rows 45-47 (3 rows)
Row 48-49: [Spacer - 2 rows before footer]
```

**Total capacity:** 5 items with comfortable spacing (2 rows between items)

#### Lower Immovable Section (Rows 50-51):
Simple continuation footer:
- Row 50: Subsidiary name (24px)
- Row 51: Subsidiary address + contact (57px) - SAME as Pages 3 & 4 footer

**No Invoice Total Box on this fully packed page!**

---

### Continuation Page (Rows 52-107)

#### Minimal Header (Rows 52-61):
```
R52: "I n v o i c e" (spacified) + "E." logo
R53-55: [Spacers - 3 rows]
R56: Subsidiary name (spacified)
R57: "Invoice #:" label
R58: Invoice number
R59: "Issued Date:" label
R60: Invoice date
R61: [Spacer - 1 row]
```

**This is a MUCH simpler header than Page 1!**
- No client address section
- No project info section
- No FPS QR code
- Just branding + invoice number + date

#### Item Section (Rows 62-90):
```
Row 62: Column headers ("DESCRIPTION" | "AMOUNT")
Row 63: [Contains backtick character - likely error?]
Row 64-65: [Spacers]

Item 6: Rows 66-68 (3 rows)
Row 69-71: [Spacers - 3 rows]

Item 7: Rows 72-74 (3 rows)
Row 75-90: [Empty rows - space for more items OR space before total box]
```

**Total capacity:** ~8 more items could fit in rows 62-90

#### Invoice Total Box (Rows 91-93):
```
R91: Invoice total (Chinese) - 22px
R92: "INVOICE TOTAL" + (HK) + numeric - 34px
R93: Invoice total (English) - 22px
```

**Appears on continuation page!**

#### Full Footer (Rows 94-107):
```
R94-97: [Spacers - 4 rows]
R98-107: Complete payment footer
  - Cheque payable to
  - Bank details
  - Account numbers (spacified)
  - FPS ID
  - Payment terms
```

**This is the FULL footer from Page 1 rows 48-57!**

---

## Critical Understanding

### Your Spacing Rules (from your description):

| Item Count | Pre-item spacing | Between items | Pre-total box |
|------------|------------------|---------------|---------------|
| 1 item | 3 rows | N/A | 4 rows |
| 2 items | 3 rows | 3 rows | 4 rows |
| 3 items | 2 rows | 2 rows | 3 rows |
| 4 items | 1 row | 2 rows | 2 rows |
| 5+ items | Packed | 2 rows | 2 rows |

### What I See in Schematic (Rows 1-51, 5 items):

| Element | Actual |
|---------|--------|
| Pre-item spacing | 1 row (R24) |
| Between items | 2 rows consistently |
| Before footer | 2 rows (R48-49) |

**Matches your "4+ items" spacing rule!**

### What I See in Continuation Page (Rows 52-107, 2 items):

| Element | Actual |
|---------|--------|
| Pre-item spacing | 2 rows (R64-65) |
| Between items | 3 rows (R69-71) |
| Before total box | Many empty rows (R75-90) |
| Total box to footer | 1 row (R94) |

**Matches your "2 items" spacing rule!**

---

## Architecture Design Decisions

### 1. Two Page Templates

**Page 1 Template (Version B):**
- Full header (rows 1-22)
- Item section (rows 23-49)
- **NO total box** when fully packed
- Simple continuation footer (rows 50-51)

**Continuation Page Template:**
- Minimal header (rows 52-61) - 10 rows
- Item section (rows 62-90)
- Invoice total box (rows 91-93)
- Full footer (rows 94-107)

### 2. Pagination Logic

**When to paginate Version B:**
```
Page 1 item capacity:
- Rows 24-49 = 26 rows available
- Each item = 3 rows (title + fee type + notes)
- Spacing depends on item count

Calculation:
- 1 item: 1 pre + 3 item + 4 post = 8 rows
- 2 items: 3 pre + (3+3) items + 3 between + 4 post = 16 rows
- 3 items: 2 pre + (3+3+3) items + (2+2) between + 3 post = 18 rows
- 4 items: 1 pre + (3*4) items + (2*3) between + 2 post = 21 rows
- 5 items: 1 pre + (3*5) items + (2*4) between + 2 post = 26 rows ✓ FULL

6+ items → PAGINATE
```

**Continuation page:**
- Minimal header = 10 rows (vs. 22 rows on Page 1)
- More space for items!
- Rows 62-107 = 46 rows total
- Minus header (10) + total box (3) + footer (14) = 19 rows overhead
- Item space: 46 - 19 = 27 rows
- Can fit ~8 items with spacing

### 3. Item Template Structure

**Single Item (3 rows minimum):**
```
Row 1 (35px): <ItemTitle> x<ItemSubQuantity> | <ItemUnitPrice> | x<ItemQuantity> | <ItemLineTotal>
Row 2 (24px): <ItemFeeType> | <ItemQuantityUnit>
Row 3 (21px+): <ItemNotes> [expandable - wraps to new lines]
```

**Notes Expansion:**
- Base height: 21px
- If notes wrap, each new line adds 1 row (21px)
- Example: 3-line notes = rows 27-29 (21px each)

---

## Questions Answered

### Q1: Available space for items?
**Page 1:** Rows 24-49 (26 rows flexible)
**Continuation:** Rows 63-90 (28 rows flexible)

### Q2: Item template?
**Minimum 3 rows** (title + fee type + notes)
**Notes expand** by adding rows when wrapping

### Q3: Total box position?
**Not fixed!**
- Page 1 when fully packed: NO total box
- Last page only: Total box appears with full footer
- Position shifts based on last item

### Q4: Pagination flow?
```
Version B with 7 items:
  Page 1 (fully packed): 5 items + simple footer (no total)
  Page 2 (continuation): 2 items + total box + full footer
```

### Q5: Empty rows are spacing?
**Yes!**
- Pre-item spacing: Rows 24 (Page 1), Rows 64-65 (Continuation)
- Between-item spacing: 2 rows when comfortable, removed when dense
- Pre-footer spacing: 2-4 rows depending on item count

---

## Recommended Implementation

### Section Definitions:

1. **`header-versionB-page1`** (Rows 1-22)
   - Full header with all info

2. **`header-continuation-minimal`** (Rows 52-61)
   - Just branding + invoice metadata

3. **`item-table-header`** (Row 23 or 62)
   - Column titles

4. **`item-row-template`** (3 rows base)
   - Row 1: Title + pricing info
   - Row 2: Fee type + quantity unit
   - Row 3+: Notes (expandable)

5. **`total-box`** (Rows 91-93)
   - 3 rows, appears on last page only

6. **`footer-continuation-minimal`** (Rows 50-51)
   - For fully packed pages
   - Just subsidiary name + contact

7. **`footer-full-payment`** (Rows 98-107)
   - For last page
   - Complete payment details

### Pagination Algorithm:

```typescript
function calculatePagination(items: InvoiceItem[], spacingRules) {
  const pages = [];

  // Page 1 capacity
  const page1Capacity = calculateCapacity(
    availableRows: 26,
    itemCount: items.length,
    spacingRules: spacingRules
  );

  if (items.length <= page1Capacity) {
    // Single page
    pages.push({
      type: 'versionB-single',
      header: 'header-versionB-page1',
      items: items,
      totalBox: true,
      footer: 'footer-full-payment'
    });
  } else {
    // Multi-page
    pages.push({
      type: 'versionB-page1',
      header: 'header-versionB-page1',
      items: items.slice(0, page1Capacity),
      totalBox: false,
      footer: 'footer-continuation-minimal'
    });

    let remaining = items.slice(page1Capacity);
    while (remaining.length > 0) {
      const continuationCapacity = calculateCapacity(
        availableRows: 28,
        itemCount: remaining.length,
        spacingRules: spacingRules
      );

      const isLastPage = remaining.length <= continuationCapacity;

      pages.push({
        type: 'continuation',
        header: 'header-continuation-minimal',
        items: remaining.slice(0, continuationCapacity),
        totalBox: isLastPage,
        footer: isLastPage ? 'footer-full-payment' : 'footer-continuation-minimal'
      });

      remaining = remaining.slice(continuationCapacity);
    }
  }

  return pages;
}
```

---

## Next Steps

1. ✅ Understand your design (DONE - analyzed Google Sheets)
2. Extract sections with actual cell data from scheme
3. Implement spacing calculator based on your rules
4. Build pagination algorithm
5. Test with 1, 3, 5, 7, 10 item invoices

**Ready to proceed with section extraction?**
