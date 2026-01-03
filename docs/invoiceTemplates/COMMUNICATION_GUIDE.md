# Invoice Template Communication Guide

## How to Work with AI Agents on Invoice Templates

This guide shows you exactly how to communicate with AI agents (like Claude) to create, modify, and manage invoice templates using the new section-based architecture.

---

## Table of Contents

1. [Creating a New Section](#creating-a-new-section)
2. [Creating a New Template](#creating-a-new-template)
3. [Modifying Existing Templates](#modifying-existing-templates)
4. [Adjusting Pagination Rules](#adjusting-pagination-rules)
5. [Common Scenarios](#common-scenarios)

---

## Creating a New Section

### Natural Language Request Format

```
Create a new [section-type] section called "[section-id]":

Structure:
- Row X-Y: [description] (fixed/spacer/compressible/expandable)
- Row Z: [description] (min: Xpx, max: Ypx, removable: yes/no)

Content:
- Contains: [list of fields/tokens]
- Font: [font specifications]
- Colors: [color specifications]

Behavior:
- [Any special layout rules]
```

### Example 1: Create a Minimalist Header

**Your request:**
```
Create a new header section called "header-minimalist-v1":

Structure:
- Row 1-2: Company logo and name (fixed)
- Row 3: Spacer (min: 5px, max: 20px, removable: yes)
- Row 4-5: Invoice number and date in one line (fixed)
- Row 6: Thin divider line (fixed)

Content:
- Logo area: <SubsidiaryEnglishName> in Roboto Mono
- Invoice info: "Invoice #<InvoiceNumber>" and "Date: <InvoiceDate>"

Behavior:
- Spacer row 3 should be removed when in compact mode
- All text left-aligned except invoice number (right-aligned)
```

**AI generates:**
```json
{
  "id": "header-minimalist-v1",
  "name": "Minimalist Header",
  "version": "1.0.0",
  "type": "header",
  "rowCount": 6,
  "rows": [
    { "index": 1, "height": 18, "flexibility": "fixed", "purpose": "logo" },
    { "index": 2, "height": 16, "flexibility": "fixed", "purpose": "title" },
    { "index": 3, "height": 12, "flexibility": "spacer", "minHeight": 5, "maxHeight": 20, "removable": true },
    { "index": 4, "height": 14, "flexibility": "fixed", "purpose": "metadata" },
    { "index": 5, "height": 14, "flexibility": "fixed", "purpose": "metadata" },
    { "index": 6, "height": 2, "flexibility": "fixed", "purpose": "divider" }
  ],
  "cells": { /* ... */ },
  "metadata": { /* ... */ }
}
```

---

### Example 2: Create a Compact Item Row

**Your request:**
```
Create a new item-row section called "item-row-compact-v1":

Structure:
- Row 1: Item title and price on same line (fixed, 14px height)
- Row 2: Notes section (expandable, min: 12px, max: 40px based on content)
- Row 3: Thin divider (fixed, 1px height)

Content:
- Row 1 left side: <ItemTitle> (bold)
- Row 1 right side: $<ItemLineTotal> (right-aligned)
- Row 2: <ItemNotes> (wrapped text, smaller font)

Behavior:
- If notes are empty, collapse row 2 to minimum height
- If notes exceed 100 characters, expand to max height
- This section is repeatable
```

**AI generates:**
```json
{
  "id": "item-row-compact-v1",
  "name": "Compact Item Row",
  "type": "item-row",
  "rowCount": 3,
  "rows": [
    { "index": 1, "height": 14, "flexibility": "fixed", "purpose": "content" },
    { "index": 2, "height": 20, "flexibility": "expandable", "minHeight": 12, "maxHeight": 40, "purpose": "content" },
    { "index": 3, "height": 1, "flexibility": "fixed", "purpose": "divider" }
  ],
  "metadata": {
    "repeatable": true,
    "maxInstancesPerPage": 8
  }
}
```

---

## Creating a New Template

### Natural Language Request Format

```
Create a new template called "[template-id]" using:

Sections:
- Header: [section-id]
- Item row: [section-id]
- Footer: [section-id]

Layout:
- [X] rows per page
- Item section: row [Y] to row [Z]

Pagination rules:
- Comfortable mode: [N] items per page (with spacers)
- Compact mode: [M] items per page (no spacers)
- Switch to compact when: [condition]
- Balancing: [rules]
```

### Example: Create a Simple Receipt Template

**Your request:**
```
Create a new template called "simple-receipt" using:

Sections:
- Header: header-minimalist-v1
- Item row: item-row-compact-v1
- Footer: footer-minimal-v1

Layout:
- 40 rows per page
- Item section: row 8 to row 35

Pagination rules:
- Comfortable mode: 5 items per page (with spacers)
- Compact mode: 8 items per page (no spacers)
- Switch to compact when item count >= 6
- Never put only 1 item on last page - redistribute to at least 2
```

**AI generates:**
```json
{
  "id": "simple-receipt",
  "name": "Simple Receipt Template",
  "version": "1.0.0",
  "sections": {
    "header": "header-minimalist-v1",
    "itemRow": "item-row-compact-v1",
    "footer": "footer-minimal-v1"
  },
  "layout": {
    "rowsPerPage": 40,
    "itemSectionStartRow": 8,
    "itemSectionEndRow": 35,
    "pageSize": "A4",
    "orientation": "portrait"
  },
  "paginationRules": {
    "modes": {
      "comfortable": { "itemsPerPage": 5, "useSpacers": true, "compressRows": false },
      "compact": { "itemsPerPage": 8, "useSpacers": false, "compressRows": true }
    },
    "triggers": {
      "compactWhenItemCount": 6
    },
    "balancing": {
      "minItemsOnLastPage": 2,
      "minItemsPerPage": 1,
      "preferEvenDistribution": true,
      "redistributeThreshold": 0.3
    }
  }
}
```

---

## Modifying Existing Templates

### Natural Language Request Format

```
Modify template "[template-id]":

Change:
- [Specific change 1]
- [Specific change 2]

Keep:
- [Things that should not change]
```

### Example 1: Swap Footer Section

**Your request:**
```
Modify template "standard-invoice":

Change:
- Replace footer with "footer-fps-qr-v2" (includes larger QR code)

Keep:
- All other sections and pagination rules
```

**AI executes:**
```json
{
  "id": "standard-invoice",
  "sections": {
    "header": "header-standard-v1",
    "itemRow": "item-row-standard-v1",
    "footer": "footer-fps-qr-v2"  // Changed
  }
  // ... rest unchanged
}
```

---

### Example 2: Adjust Layout Space

**Your request:**
```
Modify template "standard-invoice":

Change:
- Extend item section end from row 47 to row 50 (add 3 more rows)
- This should allow 1 more item per page in comfortable mode

Update pagination:
- Comfortable mode: 4 items per page (was 3)
```

**AI executes:**
```json
{
  "layout": {
    "itemSectionEndRow": 50  // Was 47
  },
  "paginationRules": {
    "modes": {
      "comfortable": { "itemsPerPage": 4 }  // Was 3
    }
  }
}
```

---

## Adjusting Pagination Rules

### Natural Language Request Format

```
Update pagination rules for "[template-id]":

Triggers:
- [When to switch modes]

Balancing:
- [How to distribute items]

Special cases:
- [Edge case handling]
```

### Example 1: More Aggressive Compression

**Your request:**
```
Update pagination rules for "standard-invoice":

Triggers:
- Use compact mode when item count >= 3 (instead of 4)
- Use compact mode when any note exceeds 60 characters (instead of 80)

Balancing:
- Prefer even distribution more strongly
- Maximum 1 item difference between pages (instead of 2)
```

**AI executes:**
```json
{
  "paginationRules": {
    "triggers": {
      "compactWhenItemCount": 3,  // Was 4
      "compactWhenNoteLengthExceeds": 60  // Was 80
    },
    "balancing": {
      "maxItemCountDifference": 1  // Was 2
    }
  }
}
```

---

### Example 2: Add Dense Mode

**Your request:**
```
Update pagination rules for "standard-invoice":

Add a new "dense" mode:
- Fits 7 items per page
- Removes all spacers
- Compresses all compressible rows to minimum
- Use when item count >= 10

Keep comfortable and compact modes as-is.
```

**AI executes:**
```json
{
  "paginationRules": {
    "modes": {
      "comfortable": { /* unchanged */ },
      "compact": { /* unchanged */ },
      "dense": {  // New
        "name": "dense",
        "itemsPerPage": 7,
        "useSpacers": false,
        "compressRows": true,
        "spacingMultiplier": 0.7
      }
    },
    "triggers": {
      "denseWhenItemCount": 10  // New
    }
  }
}
```

---

## Common Scenarios

### Scenario 1: "I want more breathing room for invoices with few items"

**Say:**
```
Modify template "standard-invoice":

For comfortable mode (1-3 items):
- Increase spacing multiplier to 1.3 (30% more space)
- Use expandable rows at their max height
- Keep all spacer rows
```

---

### Scenario 2: "Last page looks empty with just 1 item"

**Say:**
```
Update pagination rules for "standard-invoice":

Balancing:
- Never allow only 1 item on last page
- If this would happen, redistribute items
- Example: prefer 3+3 over 5+1, or 4+3 over 5+2
```

**AI updates:**
```json
{
  "balancing": {
    "minItemsOnLastPage": 2,
    "preferEvenDistribution": true,
    "redistributeThreshold": 0.5  // More aggressive redistribution
  }
}
```

---

### Scenario 3: "Items with long notes break the layout"

**Say:**
```
Modify section "item-row-standard-v1":

Change row 3 (notes):
- Increase max height from 60px to 100px
- Add page break logic: if a single note exceeds 80px, move entire item to next page
```

---

### Scenario 4: "Create a variant for single-item invoices"

**Say:**
```
Clone template "standard-invoice" as "standard-invoice-single-item":

Changes:
- Use "item-row-featured-v1" (larger, centered layout)
- Use "footer-signature-block-v1" (adds more formal signature area)
- Remove all pagination rules (always 1 page)
```

---

## Quick Reference: Row Flexibility Types

| Type | Behavior | Use Case | Example |
|------|----------|----------|---------|
| **fixed** | Never changes height | Critical content | Logo, titles, metadata |
| **spacer** | Can be removed entirely | Whitespace for aesthetics | Gaps between sections |
| **compressible** | Can shrink to `minHeight` | Content with some flexibility | Address lines, notes |
| **expandable** | Can grow to `maxHeight` | Variable content | Notes, descriptions |

---

## Quick Reference: Pagination Modes

| Mode | Typical Use | Items/Page | Spacers | Compression |
|------|-------------|------------|---------|-------------|
| **comfortable** | 1-3 items | 3 | ✓ | ✗ |
| **compact** | 4-7 items | 5 | ✗ | ✓ |
| **dense** | 8+ items | 7 | ✗ | ✓✓ |

---

## Pro Tips

### 1. **Be Specific About Thresholds**
❌ "Use compact mode when there are many items"
✓ "Use compact mode when item count >= 4"

### 2. **Describe Visual Intent**
❌ "Make the footer smaller"
✓ "Reduce footer height from 10 rows to 7 rows by removing spacer rows 4 and 9"

### 3. **Reference Examples**
✓ "Make it look like the current classic invoice but with a modern sans-serif font"

### 4. **Test Incrementally**
✓ "First, create the header section. Once that looks good, I'll describe the footer."

### 5. **Use Versioning**
✓ "Clone 'header-classic-v1' as 'header-classic-v2' and make these changes..."

---

## Example: Complete Workflow

**Step 1: Extract sections from current design**
```
Extract three sections from tmp/classic-instruction-scheme.json:
1. Header: rows 1-22 → save as "header-standard-v1"
2. Item row: rows 23-27 (one item) → save as "item-row-standard-v1"
3. Footer: rows 48-57 → save as "footer-standard-v1"

For each section, identify:
- Which rows are spacers (can be removed)
- Which rows are compressible (can shrink)
- Purpose of each row
```

**Step 2: Annotate row flexibility**
```
For "header-standard-v1", mark:
- Rows 2, 5, 8, 14, 17 as spacers (removable)
- Rows 11, 12, 13 as compressible (address lines)
- All other rows as fixed
```

**Step 3: Create template**
```
Create template "standard-invoice" using:
- header-standard-v1
- item-row-standard-v1
- footer-standard-v1

With pagination rules matching my description from earlier messages.
```

**Step 4: Test and iterate**
```
Test with:
1. 1-item invoice → should use comfortable mode
2. 5-item invoice → should use compact mode
3. 9-item invoice with long notes → should paginate 5+4, not 6+3

If results don't match expectations, adjust pagination rules.
```

---

## Summary

**To work with AI agents on invoice templates:**

1. **Use natural language** - describe what you want visually
2. **Be specific about numbers** - row counts, heights, thresholds
3. **Reference existing sections/templates** - easier to modify than create from scratch
4. **Describe intent** - "I want more space for low-item invoices"
5. **Iterate** - start simple, refine based on results

The AI will translate your natural language into the JSON schemas and handle the technical details.
