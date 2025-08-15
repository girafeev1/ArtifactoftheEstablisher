# Task Log — Vol. 1

Single source of truth for tasks tracked outside Canvas.  
Conventions:  
**T-xxx** = Tasks, **P-###** = Prompts.  
State: ✅ done · ⏳ in progress · 🧭 next · 🧪 QA/verify · 🗓️ deferred · 🗑️ removed

⸻

## Latest change summary (this PR / diff you shared)
- Polish: Task Log headings/code fences.
- Add PR Quality Gate (soft): Task ID required; warns for task-log & missing Context Bundle.
- Add CI concurrency/timeout for Context Bundle workflow.
- Fix code-fence formatting in Setup snippets.
- Resizable columns w/ subtle lever + per-user persistence (useColumnWidths), incl. sticky # column.
- Sticky footers with shadow on Student Dialog screens; scrollbars live in footers.
- Infinite/darker yellow “Amount Received” blink in list & detail, with reduced-motion respect.
- Calendar scan wired end-to-end: Apps Script endpoint + Next.js /api/calendar-scan proxy + UI tools (incremental/full, spinner, errors).
- Popovers/menus portal to document.body (no clipping behind dialogs).
- Payment list shows “For Session(s)” by ordinal; Coaching dashboard cards show slow-blink placeholders pre-load.
- Repo doc created: docs/task-log-vol-1.md.

⸻

## Tasks (T-xxx)

| ID    | Title                                                             | State | Notes / Files |
|-------|-------------------------------------------------------------------|:-----:|---------------|
| T-001 | Column resizing (thin lever, hover, big hit area) + per-user persistence | ✅ | `lib/useColumnWidths.ts`, `.col-resizer` in `styles/studentDialog.css`; integrated in Sessions/Retainers/Payments tables |
| T-002 | Sticky footers for Student Dialog screens (with shadow)           | ✅ | `.dialog-footer` + `pb:'64px'` in PaymentDetail, PaymentHistory, RetainerModal, SessionDetail, SessionsTab; CSS shadow |
| T-003 | “Amount Received” blink: infinite + darker yellow (list & detail) | ✅ | `PaymentHistory.tsx`, `PaymentDetail.tsx`, `styles/studentDialog.css` (`.blink-amount`, reduced-motion safe) |
| T-004 | PaymentDetail: robust remaining calculation + sticky Assign       | ✅ | Uses `remainingAmount ?? (amount - appliedAmount)`; Assign button moved to sticky footer; fixed-layout table |
| T-005 | Payment list “For Session(s)” by ordinal                          | ✅ | Maps assigned session IDs to session ordinals via billing rows |
| T-006 | Popover/Menu/Select clipping fix inside dialogs                   | ✅ | ThemeProvider + `lib/theme.ts` sets portal container to `document.body`; applied in `_app.tsx` |
| T-007 | Sticky, resizable ordinal “#” column in Sessions                  | ✅ | Added ordinal column; sticky + resizable; maintained sorting/filters |
| T-008 | Calendar scan integration (UI+API+Apps Script)                     | ✅ | `/api/calendar-scan` proxy; tools menu w/ Incremental/Full + spinner; Apps Script `doPost/syncCalendarChanges` with syncToken |
| T-009 | Configure `CALENDAR_SCAN_URL` in `.env.local`                      | 🧭 | Add: `CALENDAR_SCAN_URL="https://script.google.com/macros/s/…/exec"` then restart. Optional: add to Vercel envs (Production/Preview/Dev). |
| T-010 | Apps Script config: set `COACHING_CALENDAR_ID`, `FIRESTORE_PROJECT_ID`; enable services & scopes | 🧭 | In `apps-script/CONFIG.gs`. Enable Advanced Calendar + OAuth scopes; redeploy web app |
| T-011 | Firestore number encoding: support `doubleValue` for non-integers | 🧭 | `toFirestoreFields()` currently uses `integerValue` for all numbers. Change to `doubleValue` when `!Number.isInteger(val)` |
| T-012 | Calendar incremental sync: auto-recover on stale `syncToken` (HTTP 410) | 🧭 | Catch 410, call `clearSyncToken()`, retry once in `syncCalendarChanges()` |
| T-013 | Add column resizers to PaymentDetail table headers (consistency)  | 🧭 | Bring header resizer rails to the “For session” table in `PaymentDetail.tsx` |
| T-014 | Accessibility polish for loading/blink                            | 🧪 | We already respect `prefers-reduced-motion` for `.blink-amount`. Consider same for `.slow-blink` and `aria-live` for assign results |
| T-015 | Sticky footer regression tour on small viewports                  | 🧪 | Verify scrollbars always accessible; confirm no overlap with bottom OS UI on mobile |
| T-016 | Tests for calendar scan endpoints (proxy & Apps Script)           | 🧭 | Add node-side tests for `/api/calendar-scan` (happy-path + error) |
| T-017 | Canonicalize Task Log + add quick-access entry point              | 🧭 | Keep `docs/task-log-vol-1.md` as source; (optional) add a top-level menu/link or readme pointer |
| T-018 | Remove legacy Batch Rename Payments tool                          | ✅ | `tools/BatchRenamePayments.tsx` removed; confirm no menu entry remains |
| T-019 | Dropdowns covered by dialog (global audit)                        | 🧪 | Theme fix should cover all; quick sweep to confirm no custom popper overrides |
| T-020 | Table perf for large datasets                                     | 🗓️ | Consider virtualization if rows grow large (>500) to keep scroll smooth |
| T-021 | Scan security: restrict `/api/calendar-scan`                      | 🧭 | Add admin check or shared secret header forwarded to Apps Script to avoid public triggering |
| T-022 | Surface scan results/log in UI                                    | 🗓️ | Beyond snackbar, optional “Scan Log” panel with last run & processed count |
| T-023 | Student cards: skeletons instead of blink for placeholders        | 🧭 | Replace `.slow-blink` with MUI Skeletons for sex/total/upcoming/balance |
| T-024 | Consistency pass: horizontal scrollbar always in footer across all tables | 🧪 | Most main tables done; confirm any remaining secondary tables |

⸻

## Prompts (P-###)

| ID   | Title                                          | State | Notes |
|------|------------------------------------------------|:----:|-------|
| P-011| Calendar scan integration (Apps Script)        | ✅ | Added Apps Script sync + Next API proxy + UI tools |
| P-012| Resizable tables + sticky # + blink polish     | ✅ | Implemented thin lever, sticky ordinal, infinite/darker blink |
| P-013| UI polish + scan hardening                     | ⏳ | Tracks T-009/T-010/T-011/T-012/T-021 |

⸻

## Setup snippets

### `.env.local`
```env
CALENDAR_SCAN_URL="https://script.google.com/macros/s/AKfycbzESImrT9yROHCEq0HFM70mGNLd_x-HYT-nJ1E9X_urFxxOPKi3XYqHZW79bGk3tqgFZA/exec"
```

### `Apps Script CONFIG.gs`

```js
var CONFIG = {
  COACHING_CALENDAR_ID: '<<YOUR_CAL_ID>>',
  FIRESTORE_PROJECT_ID: '<<YOUR_PROJECT_ID>>',
  FIRESTORE_DB: '(default)',
  BACKFILL_DAYS: 365,
  TIMEZONE: 'America/New_York',
  SYNC_TOKEN_KEY: 'calendarSyncToken'
};
```

Enable Advanced Calendar service and re-deploy the web app.

⸻

Notes
	•	Keep newest tasks at the top when updating.
	•	For each merged PR, add 1–2 bullets in “Latest change summary” and note key files touched.

