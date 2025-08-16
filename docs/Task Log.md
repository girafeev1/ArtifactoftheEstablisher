# Task Log

> Single source of truth for prompts (P-###) and engineering tasks (T-###).
> Convention: ✅ done, ⏳ in progress, 🧭 next / planned.

| ID    | Title                                    | State | Notes |
|-------|------------------------------------------|-------|-------|
| P-016 | Autosize cols; sessions total parity; balance due source; modal stacking; base rate audit; GAS TZ/secret | 🧭    | See `prompts/p-016.md` for scope and acceptance criteria. Includes tasks T-090..T-095. |
| P-015 | UI polish + scan hardening               | ✅    | Sticky dialog footers; thinner resize lever; per-user column widths; sticky ordinal #; infinite/darker blink on “Amount Received” (list & detail); “For Session(s)” mapping in Payment History; `/api/calendar-scan` bridged to GAS with incremental/full; spinner & toasts; removed BatchRenamePayments; Theme Popper/Menu containers pinned to `document.body`. |
| P-014 | (reserved)                               | —     | – |
| P-013 | UI polish + scan hardening               | ✅    | Resizable tables, sticky #, sticky dialog footers, infinite blink for Amount Received, menu container to body, scan proxy. |
| P-012 | Resizable tables + sticky # + basic blink| ✅    | Initial column resize & sticky ordinal column. |
| P-011 | Calendar scan integration (Apps Script)  | ✅    | Sync token, backfill, Firestore write helpers, `/api/calendar-scan`. |

### Changes — P-015

- `lib/useColumnWidths.ts`
- `styles/studentDialog.css`
- `pages/api/calendar-scan.ts`
- `apps-script/*`
- `pages/dashboard/businesses/coaching-sessions.tsx`

## Backlog/Tasks

- T-095 — GAS timezone + shared secret; document `.env.local`.
- T-094 — Base Rate history (view/add with `editedBy`).
- T-093 — Modal stacking audit and fixes (dialogs always on top).
- T-092 — Balance Due single source of truth (align card & dialog).
- T-091 — Total Sessions includes cancelled/proceeded; optional breakdown.
- T-090 — Column autosize on double-click (persisted, min/max, padding).
