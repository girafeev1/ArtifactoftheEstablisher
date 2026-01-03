# Invoice Pagination Algorithm - Visual Examples

This document shows exactly how the pagination algorithm distributes items across pages based on your aesthetic balancing rules.

---

## Template Configuration Used

```json
{
  "modes": {
    "comfortable": { "itemsPerPage": 3 },
    "compact": { "itemsPerPage": 5 }
  },
  "triggers": {
    "compactWhenItemCount": 4
  },
  "balancing": {
    "minItemsPerPage": 2,
    "minItemsOnLastPage": 2,
    "preferEvenDistribution": true,
    "redistributeThreshold": 0.3,
    "maxItemCountDifference": 2
  }
}
```

---

## Example 1: Single Item (Comfortable Mode)

**Input:**
- 1 item
- No long notes

**Algorithm Decision:**
```
Item count: 1
→ Less than compactWhenItemCount (4)
→ Use COMFORTABLE mode (3 items/page max)
→ Single page with maximum spacing
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Comfortable)        │
├─────────────────────────────┤
│ [Header - full spacing]     │
│                             │
│ Item 1: Service Fee         │
│   $500.00                   │
│   Notes: Monthly service    │
│                             │
│   [Large spacer]            │
│                             │
│ [Footer with totals]        │
│ Total: $500.00              │
└─────────────────────────────┘

Mode: Comfortable
Pages: 1
Spacers: All included
Compression: None
```

---

## Example 2: Three Items (Comfortable Mode)

**Input:**
- 3 items
- Standard notes (< 80 chars)

**Algorithm Decision:**
```
Item count: 3
→ Less than compactWhenItemCount (4)
→ Use COMFORTABLE mode
→ All items fit on 1 page (3/3)
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Comfortable)        │
├─────────────────────────────┤
│ [Header]                    │
│                             │
│ Item 1: Consulting          │
│   $1,000.00                 │
│   [spacer]                  │
│                             │
│ Item 2: Design Work         │
│   $800.00                   │
│   [spacer]                  │
│                             │
│ Item 3: Development         │
│   $1,200.00                 │
│   [spacer]                  │
│                             │
│ [Footer]                    │
│ Total: $3,000.00            │
└─────────────────────────────┘

Mode: Comfortable
Pages: 1
Items per page: [3]
```

---

## Example 3: Five Items (Compact, Balanced Distribution)

**Input:**
- 5 items
- Standard notes

**Algorithm Decision:**
```
Item count: 5
→ Exceeds compactWhenItemCount (4)
→ Use COMPACT mode (5 items/page max)

Naive approach: 5 items on page 1
→ All fit on 1 page

BUT: Check note length and spacing...
→ With compact mode, can fit 5 per page
→ Use single page approach
```

**Result (Single Page):**
```
┌─────────────────────────────┐
│ Page 1 (Compact)            │
├─────────────────────────────┤
│ [Header - compressed]       │
│                             │
│ Item 1: Service A  $500     │
│ Item 2: Service B  $600     │
│ Item 3: Service C  $700     │
│ Item 4: Service D  $800     │
│ Item 5: Service E  $900     │
│                             │
│ [Footer]                    │
│ Total: $3,500.00            │
└─────────────────────────────┘

Mode: Compact
Pages: 1
Items per page: [5]
Spacers: Removed
```

---

## Example 4: Five Items with Long Notes (Balanced 3+2)

**Input:**
- 5 items
- Items 1, 3, 4 have notes > 80 characters

**Algorithm Decision:**
```
Item count: 5
→ Use COMPACT mode

Calculate space needed:
→ Item 1: 3 rows (long notes → expand to 40px)
→ Item 2: 2 rows (no notes)
→ Item 3: 3 rows (long notes)
→ Item 4: 3 rows (long notes)
→ Item 5: 2 rows (no notes)
→ Total: 13 rows needed

Item section available: rows 23-47 = 25 rows
→ Can fit ~4 items per page with expanded notes

Distribution options:
A) 4 items page 1, 1 item page 2
   → Violates minItemsOnLastPage (2)
   → Overflow: 1/4 = 0.25 < redistributeThreshold (0.3)
   → REDISTRIBUTE!

B) 3 items page 1, 2 items page 2
   → Meets minItemsOnLastPage ✓
   → More balanced ✓
   → SELECT THIS
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Compact)            │
├─────────────────────────────┤
│ [Header]                    │
│                             │
│ Item 1: Consulting          │
│   $1,000.00                 │
│   Notes: Long description   │
│   spanning multiple lines   │
│   with details...           │
│                             │
│ Item 2: Design              │
│   $800.00                   │
│                             │
│ Item 3: Development         │
│   $1,200.00                 │
│   Notes: Another long...    │
│                             │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Page 2 (Compact)            │
├─────────────────────────────┤
│ [Continuation Header]       │
│                             │
│ Item 4: Testing             │
│   $600.00                   │
│   Notes: Extensive testing  │
│   requirements...           │
│                             │
│ Item 5: Deployment          │
│   $400.00                   │
│                             │
│ [Footer]                    │
│ Total: $4,000.00            │
└─────────────────────────────┘

Mode: Compact
Pages: 2
Items per page: [3, 2]
Balancing: Applied (avoided 4+1)
```

---

## Example 5: Nine Items (Dense Mode, Even Distribution)

**Input:**
- 9 items
- Mix of note lengths

**Algorithm Decision:**
```
Item count: 9
→ Exceeds denseWhenItemCount (8)
→ Use DENSE mode (7 items/page max)

Distribution:
→ Naive: 7 items page 1, 2 items page 2
→ Check: minItemsOnLastPage = 2 ✓
→ Check: difference = |7-2| = 5 > maxItemCountDifference (2)
→ REDISTRIBUTE!

Better distribution:
→ 9 items / 2 pages = 4.5 items/page
→ Options: 5+4 or 4+5
→ Select: 5+4 (frontload slightly)
→ Difference: |5-4| = 1 ✓
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Dense)              │
├─────────────────────────────┤
│ [Header - minimal]          │
│ Item 1  $500                │
│ Item 2  $600                │
│ Item 3  $700                │
│ Item 4  $800                │
│ Item 5  $900                │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Page 2 (Dense)              │
├─────────────────────────────┤
│ [Continuation Header]       │
│ Item 6  $1,000              │
│ Item 7  $1,100              │
│ Item 8  $1,200              │
│ Item 9  $1,300              │
│                             │
│ [Footer]                    │
│ Total: $8,100.00            │
└─────────────────────────────┘

Mode: Dense
Pages: 2
Items per page: [5, 4]
Balancing: Applied (avoided 7+2)
All spacers: Removed
All compressible rows: At minimum height
```

---

## Example 6: Thirteen Items (Three Pages, Balanced)

**Input:**
- 13 items
- Standard layout

**Algorithm Decision:**
```
Item count: 13
→ Use DENSE mode (7 items/page)

Naive distribution:
→ Page 1: 7 items
→ Page 2: 6 items
→ Page 3: 0 items
→ Wait, only need 2 pages!

Let me recalculate:
→ 13 items / 7 per page = 1.86 pages
→ Need 2 pages
→ Distribution: 7 + 6

Check balancing:
→ Difference: |7-6| = 1 ✓
→ Last page: 6 > minItemsOnLastPage (2) ✓
→ Difference < maxItemCountDifference (2) ✓
→ ACCEPTABLE - no redistribution needed
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Dense)              │
├─────────────────────────────┤
│ [Header]                    │
│ Items 1-7 (compact)         │
│ ...                         │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Page 2 (Dense)              │
├─────────────────────────────┤
│ [Continuation Header]       │
│ Items 8-13 (compact)        │
│ ...                         │
│ [Footer]                    │
└─────────────────────────────┘

Pages: 2
Items per page: [7, 6]
```

---

## Example 7: Edge Case - Exactly 4 Items (Mode Switch)

**Input:**
- 4 items (exactly at threshold)
- Standard notes

**Algorithm Decision:**
```
Item count: 4
→ Equals compactWhenItemCount (4)
→ Use COMPACT mode (5 items/page)
→ All fit on 1 page
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Compact)            │
├─────────────────────────────┤
│ [Header - compressed]       │
│                             │
│ Item 1: Service A           │
│ Item 2: Service B           │
│ Item 3: Service C           │
│ Item 4: Service D           │
│                             │
│ [Footer]                    │
└─────────────────────────────┘

Mode: Compact (triggered)
Pages: 1
Spacers: Removed
```

---

## Example 8: Six Items (3+3 Perfect Balance)

**Input:**
- 6 items
- Standard notes

**Algorithm Decision:**
```
Item count: 6
→ Use COMPACT mode (5 items/page)

Distribution:
→ Naive: 5 + 1
→ Check: Last page has 1 < minItemsOnLastPage (2)
→ MUST REDISTRIBUTE

→ Balanced: 3 + 3
→ Difference: |3-3| = 0 ✓
→ Both pages > minItemsPerPage (2) ✓
→ Perfect balance!
```

**Result:**
```
┌─────────────────────────────┐
│ Page 1 (Compact)            │
├─────────────────────────────┤
│ [Header]                    │
│ Item 1: Service A           │
│ Item 2: Service B           │
│ Item 3: Service C           │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Page 2 (Compact)            │
├─────────────────────────────┤
│ [Continuation Header]       │
│ Item 4: Service D           │
│ Item 5: Service E           │
│ Item 6: Service F           │
│                             │
│ [Footer]                    │
└─────────────────────────────┘

Mode: Compact
Pages: 2
Items per page: [3, 3]
Balancing: Applied (avoided 5+1)
```

---

## Summary Table

| Items | Mode | Naive | Balanced | Reason |
|-------|------|-------|----------|--------|
| 1 | Comfortable | [1] | [1] | Single page, max spacing |
| 3 | Comfortable | [3] | [3] | Fits perfectly |
| 4 | Compact | [4] | [4] | Mode switch, fits on 1 page |
| 5 | Compact | [5] | [3,2] | Avoid 4+1 orphan |
| 6 | Compact | [5,1] | [3,3] | Perfect balance |
| 8 | Dense | [7,1] | [4,4] | Avoid orphan |
| 9 | Dense | [7,2] | [5,4] | Within maxDifference |
| 13 | Dense | [7,6] | [7,6] | Already balanced |

---

## Key Takeaways

1. **Mode switching** is automatic based on item count and note length
2. **Balancing** prevents orphan pages (single item alone)
3. **Distribution** prefers even splits when possible (3+3 over 5+1)
4. **Thresholds** are configurable - you can adjust when modes trigger
5. **Spacers** are removed progressively (comfortable → compact → dense)

---

## How to Adjust

If the results don't match your aesthetic preferences, adjust these values:

```javascript
// Want less aggressive compression?
triggers: {
  compactWhenItemCount: 5  // Instead of 4
}

// Want perfectly even distribution always?
balancing: {
  preferEvenDistribution: true,
  maxItemCountDifference: 1  // Instead of 2
}

// Want to allow 1-item pages sometimes?
balancing: {
  minItemsOnLastPage: 1  // Instead of 2
}
```

The algorithm follows your rules deterministically - no guesswork!
