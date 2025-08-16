Goal: Rename the task log and update entries to reflect current state.

Do the following changes:

Task log lives at `docs/Task Log.md`.

Replace its contents with the markdown below (keep newest on top):

# Task Log

> Single source of truth for prompts (P-###) and engineering tasks (T-###).  
> Convention: ✅ done, ⏳ in progress, 🧭 next / planned.

| ID    | Title                                                | State | Notes |
|-------|------------------------------------------------------|-------|------|
| P-015 | Sessions counts, auto-fit, balance due, dialogs, base rate audit, scan secret, numeric types | ⏳    | This prompt (see `prompts/P-015.md`). |
| P-014 | (reserved)                                           | —     | – |
| P-013 | UI polish + scan hardening                           | ✅    | Resizable tables, sticky #, sticky dialog footers, infinite blink for Amount Received, menu container to body, scan proxy. |
| P-012 | Resizable tables + sticky # + basic blink            | ✅    | Initial column resize & sticky ordinal column. |
| P-011 | Calendar scan integration (Apps Script)              | ✅    | Sync token, backfill, Firestore write helpers, `/api/calendar-scan`. |

## Notes
- From P-015 onward, all column headers/cells carry `data-col` to support auto-fit.
- Balance Due is authoritative in `Students/{abbr}.billingSummary.balanceDue`; all mutations trigger a recompute via `writeSummaryFromCache`.
- Apps Script scan endpoint now requires `SCAN_SECRET`.

Commit both file rename and content update in one PR titled:
“Docs: rename Task Log and record P-015”.
