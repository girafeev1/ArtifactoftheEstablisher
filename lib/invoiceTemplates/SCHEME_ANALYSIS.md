# Invoice Scheme Analysis

Based on analysis of `tmp/classic-instruction-scheme.json`

**Total:** 202 rows across 4 pages (14 columns)

---

## Page Structure Overview

| Page | Rows | Purpose | Pagination |
|------|------|---------|------------|
| Page 1 | 1-57 | Header + Item Section + Totals + Footer | Variable (first page) |
| Page 2 | 58-110 | Continuation Header + Item Section + Totals + Footer | Variable (continuation) |
| Page 3 | 111-151 | Payment Details (fixed content) | Fixed |
| Page 4 | 152-202 | Payment Instructions (fixed content) | Fixed |

---

## PAGE 1 BREAKDOWN (Rows 1-57)

### SECTION 1: Header (Rows 1-22)

| Rows | Height | Content | Proposed Classification | Removable? |
|------|--------|---------|------------------------|------------|
| **1** | 42px | "E." logo + Subsidiary name (spacified) | **fixed** (logo/title) | ❌ No |
| **2** | 18px | Subsidiary address lines 1-2 | **fixed** (contact info) | ❌ No |
| **3-4** | 18px | [EMPTY ROWS] | **spacer** | ✅ Yes |
| **5** | 16px | Subsidiary email + phone (spacified) | **fixed** (contact info) | ❌ No |
| **6** | 16px | "BILL TO:" | **fixed** (label) | ❌ No |
| **7** | 16px | "Invoice" label | **fixed** (label) | ❌ No |
| **8** | 32px | Client company name | **fixed** (client info) | ❌ No |
| **9** | 19px | Client address line 1 | **compressible** (min: 15px) | ❌ No |
| **10** | 19px | Client address line 2 + "Invoice #:" label | **compressible** (min: 15px) | ❌ No |
| **11** | 19px | Client address line 3 + Invoice number | **compressible** (min: 15px) | ❌ No |
| **12** | 19px | "Issued Date:" label | **fixed** | ❌ No |
| **13** | 21px | "Attn:" + Client representative + Invoice date | **fixed** | ❌ No |
| **14** | 21px | [EMPTY ROW] | **spacer** | ✅ Yes |
| **15** | 22px | "FPS:" label | **fixed** | ❌ No |
| **16** | 21px | FPS QR Code | **fixed** | ❌ No |
| **17** | 17px | Presenter work type | **fixed** | ❌ No |
| **18** | 42px | Project title | **expandable** (max: 60px for long titles) | ❌ No |
| **19** | 17px | Project nature | **fixed** | ❌ No |
| **20-22** | 21px | [EMPTY ROWS] | **spacer** | ✅ Yes (keep 1, remove others) |

**Summary:** 22 rows total
- **Fixed:** 13 rows (critical content)
- **Compressible:** 3 rows (client address - can shrink 19px → 15px)
- **Expandable:** 1 row (project title - can grow 42px → 60px)
- **Spacer:** 5 rows (rows 3-4, 14, 20-22)

---

### SECTION 2: Item Table Header (Row 23)

| Row | Height | Content | Classification |
|-----|--------|---------|----------------|
| **23** | 25px | "DESCRIPTION" + "AMOUNT" column headers | **fixed** (table header) |

---

### SECTION 3: Item Section (Rows 24-40)

**Pattern: Each item occupies ~3-5 rows depending on notes**

#### Current single-item layout:
| Rows | Height | Content | Proposed Classification |
|------|--------|---------|------------------------|
| **24-26** | 21px | [EMPTY ROWS - spacing before item] | **spacer** (pre-item spacing) |
| **27** | 35px | Item title + quantity info + unit price + line total | **fixed** (item row 1) |
| **28** | 24px | Fee type + quantity unit | **fixed** (item row 2) |
| **29** | 21px | Item notes | **expandable** (min: 21px, max: 80px) |
| **30-40** | 21px | [EMPTY ROWS - spacing after item] | **spacer** (post-item spacing) |

**Available space for items:** Rows 24-40 = 17 rows

**Spacing considerations:**
- **Comfortable mode (1-3 items):** Keep rows 24-26 as pre-item spacers, keep many post-item spacers
- **Compact mode (4-6 items):** Remove rows 24-26, reduce post-item spacers to 1-2 rows
- **Dense mode (7+ items):** Remove all spacers, compress notes to minimum

---

### SECTION 4: Totals (Rows 41-47)

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **41** | 22px | Invoice total (Chinese) | **fixed** |
| **42** | 34px | "INVOICE TOTAL" label + (HK) + numeric total | **fixed** |
| **43** | 22px | Invoice total (English) | **fixed** |
| **44-47** | 21px | [EMPTY ROWS] | **spacer** (before footer) |

---

### SECTION 5: Footer (Rows 48-57)

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **48** | 16px | "Cheque Payable To:" + "For the amount of:" | **fixed** |
| **49** | 22px | Subsidiary name + Total (English) | **fixed** |
| **50** | 16px | "Bank:" label + Chinese label | **fixed** |
| **51** | 24px | Bank name + code + Chinese total | **fixed** |
| **52** | 16px | "Branch Code" label | **fixed** |
| **53** | 21px | Bank account part 1 (spacified) | **fixed** |
| **54** | 16px | "Account Number:" + "FPS ID:" labels | **fixed** |
| **55** | 21px | Bank account part 2 + FPS ID (spacified) | **fixed** |
| **56** | 20px | [EMPTY ROW] | **spacer** (minor spacing) |
| **57** | 23px | "PAYMENT TERMS: FULL PAYMENT WITHIN 7 DAYS" | **fixed** |

**Page break after row 57**

---

## PAGE 2 BREAKDOWN (Rows 58-110)

### SECTION 6: Continuation Header (Rows 58-81)

Very similar to Page 1 header but condensed:

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **58** | 21px | "I n v o i c e" (spacified) + "E." logo | **fixed** |
| **59-61** | 21px | [EMPTY ROWS] | **spacer** |
| **62** | 21px | Subsidiary name (spacified) | **fixed** |
| **63** | 21px | "BILL TO:" | **fixed** |
| **64** | 21px | [EMPTY ROW] | **spacer** |
| **65** | 32px | Client company name | **fixed** |
| **66-68** | 19px | Client address + Invoice # + Issued Date | **compressible** |
| **69** | 19px | Invoice date | **fixed** |
| **70** | 21px | "Attn:" + representative | **fixed** |
| **71** | 21px | [EMPTY ROW] | **spacer** |
| **72-73** | 21px | "FPS:" + QR code | **fixed** |
| **74** | 21px | [EMPTY ROW] | **spacer** |
| **75** | 17px | Presenter work type | **fixed** |
| **76** | 42px | Project title | **expandable** |
| **77** | 17px | Project nature | **fixed** |
| **78-81** | 21px | [EMPTY ROWS] | **spacer** |

**Spacers in continuation header:** Rows 59-61, 64, 71, 74, 78-81 (9 rows removable)

---

### SECTION 7: Item Table Header (Row 82)

| Row | Height | Content | Classification |
|-----|--------|---------|----------------|
| **82** | 27px | "DESCRIPTION" + "AMOUNT" | **fixed** |

---

### SECTION 8: Item Section (Rows 83-100)

Same pattern as Page 1:

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **83-85** | 21px | [EMPTY - pre-item spacing] | **spacer** |
| **86** | 35px | Item title + pricing info | **fixed** |
| **87** | 24px | Fee type + quantity unit | **fixed** |
| **88** | 21px | Item notes | **expandable** |
| **89-100** | 21px | [EMPTY - post-item spacing] | **spacer** |

**Available space:** Rows 83-100 = 18 rows

---

### SECTION 9: Totals (Rows 101-108)

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **101** | 22px | "INVOICE TOTAL" + Chinese total | **fixed** |
| **102** | 34px | (HK) + Numeric total | **fixed** |
| **103** | 22px | English total | **fixed** |
| **104-108** | 21px | [EMPTY ROWS] | **spacer** |

---

### SECTION 10: Footer (Rows 109-110)

| Rows | Height | Content | Classification |
|------|--------|---------|----------------|
| **109** | 24px | Subsidiary English name | **fixed** |
| **110** | 57px | Subsidiary address + phone + email (merged cell) | **fixed** |

**Page break after row 110**

---

## PAGES 3 & 4 (Rows 111-202)

These pages contain **fixed content** that doesn't paginate:

### Page 3 (Rows 111-151): Payment Details
- Payment terms and instructions
- Bank details with FPS QR code
- Terms & Conditions (English + Chinese)
- Subsidiary footer

### Page 4 (Rows 152-202): Payment Instructions
- Visual cheque template
- Payment transfer details
- Bank account information
- Subsidiary footer

**These pages are static and should be treated as complete fixed sections.**

---

## PROPOSED SECTION EXTRACTION

Based on the analysis, here's what I propose to extract:

### Core Sections (for dynamic pagination):

1. **`header-page1-v1`** (Rows 1-22)
   - First page header with full company info, client details, project info, FPS QR
   - Contains 5 spacer rows (removable in compact mode)
   - Contains 3 compressible rows (client address)

2. **`header-continuation-v1`** (Rows 58-81)
   - Continuation page header (similar to page 1 but condensed)
   - Contains 9 spacer rows (removable in compact mode)
   - Contains 3 compressible rows

3. **`item-table-header-v1`** (Row 23 or 82)
   - "DESCRIPTION" + "AMOUNT" column headers
   - Fixed, appears before each item section

4. **`item-row-v1`** (Rows 27-29, repeatable)
   - 3 rows: title/pricing + fee type + notes
   - Notes row is expandable (21px → 80px)
   - Pre/post spacers controlled by pagination mode

5. **`totals-section-v1`** (Rows 41-43)
   - Invoice total in Chinese, English, and numeric format
   - Always appears after last item

6. **`footer-page1-v1`** (Rows 48-57)
   - Bank details, payment terms
   - Fixed content, no compression

7. **`footer-continuation-v1`** (Rows 109-110)
   - Minimal footer for continuation pages
   - Just subsidiary name and contact info

8. **`payment-details-page-v1`** (Rows 111-151)
   - Complete static page 3

9. **`payment-instructions-page-v1`** (Rows 152-202)
   - Complete static page 4

---

## QUESTIONS FOR YOU

Before I extract the sections, please confirm:

### 1. Item Section Spacing
Currently rows 24-26 (pre-item) and rows 30-40 (post-item) are empty spacers.

**For comfortable mode (1-3 items):**
- Keep how many pre-item spacer rows? (currently 3)
- Keep how many post-item spacer rows? (currently 11)

**For compact mode (4-6 items):**
- Remove all pre-item spacers? Or keep some?
- Reduce post-item spacers to how many rows? (suggest: 2)

**For dense mode (7+ items):**
- Remove all spacers?
- Compress notes to minimum height?

---

### 2. Header Spacers
Page 1 header has spacer rows at: 3-4, 14, 20-22 (5 total)

**Should we:**
- Remove rows 3-4 in compact mode?
- Remove row 14 in compact mode?
- Keep at least row 22 for separation before table header?

---

### 3. Client Address Compression
Rows 9-11 (client address) are currently 19px each.

**In compact mode, compress to:**
- 15px? (save 12px total)
- 17px? (save 6px total)
- Keep at 19px?

---

### 4. Pages 3 & 4
You mentioned pages 3 & 4 are "fixated" (fixed content).

**Confirm:**
- These pages never change based on item count? ✓
- They always appear after the invoice pages? ✓
- They should be treated as complete static sections? ✓

---

### 5. Continuation Header vs. First Page Header
Page 2 header (rows 58-81) is very similar to Page 1 (rows 1-22).

**Should continuation pages use:**
- Same header as page 1? (easier to maintain)
- Different, more condensed header? (saves space for more items)
- **Current difference:** Page 1 has more subsidiary contact info visible

**Your preference?**

---

## NEXT STEPS

Once you answer these questions, I will:

1. Extract each section into JSON files with proper cell data
2. Annotate each row with the flexibility metadata we discussed
3. Create the `standard-invoice` template with your confirmed pagination rules
4. Build a visual preview showing how 1-item, 3-item, 5-item, and 9-item invoices would look

**Please review and provide your answers to the questions above.**
