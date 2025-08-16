# Task Log

> Single source of truth for prompts (P-###) and engineering tasks (T-###).  
> Convention: ✅ done, ⏳ in progress, 🧭 next / planned.

Latest change summary
- Enforced append-only Task Log with CI guard.
- Add continuous Context Bundle for branch pushes (Issue per branch).
- Reverted Total Sessions to include cancelled/proceeded like before.
- Added double-click to auto-size columns to widest visible content; persisted per-user.
- Unified Balance Due source-of-truth: compute via useBilling, write to billingSummary.balanceDue, card view uses computed value with skeleton fallback.
- Hardened dialog stacking/portals: "Add Payment" and similar modals always topmost.
- Added Base Rate History (info icon) with rate, timestamp, editedBy and add-entry flow.
- Added PR Context Bundle automation, PaymentModal summary write, overlay test, and README Task Log link fix.
- Replaced dayjs timezone dependency with built-in plugin to fix install failures.

---

Tasks table — add/update:

| ID    | Title                                                | State | Notes / Files |
|-------|------------------------------------------------------|-------|---------------|
| T-045 | Base rate SSOT: derive by `effectDate` (HK midnight) for sessions     |       | Apply when computing/reading Base Rate across UI & billing; fallback: if missing, treat `effectDate = startOfDay(timestamp, HK)`; add migration util |
| T-046 | Base Rate History: edit existing entries (rate & effectDate) + audit  |       | BaseRateHistoryDialog: inline edit w/ validation; write `editedBy`; keep `timestamp` as entry time; no “Edited By” column (show in tooltip) |
| T-047 | Base Rate History: “transit line” visualization (toggle view)         |       | Dialog toggle between table and timeline; responsive; keyboard accessible |
| T-048 | Sessions summary naming/layout: label “Total Sessions”, value layout  |       | Revert label; move values off title line; Show `Total Sessions: N (❌ C)`; no value embedded in label |
| T-049 | Sessions summary hover swap → show ✔︎ proceeded on hover (no tooltip) |       | Replace tooltip with on-hover value swap to ✔︎ (N−C); revert on mouseout; reduced-motion safe |
| T-050 | Card view “Total” = proceeded (total − cancelled)                      |       | Dashboard cards: display proceeded count; upcoming arrow unchanged; align with Sessions summary |
| T-051 | Column min-width squeeze v2 (~28–32px) + ellipsis + a11y tooltip       |       | `lib/useColumnWidths.ts`, table cell styles; ensure keyboard resizing; sticky ordinal width review |
| T-052 | billingSummary → cached.billingSummary (double-write + migration)     |       | Writers update both; readers prefer cached; add backfill script and deprecation note |
| T-053 | Payment History blink logic QA/tests                                   |       | Ensure yellow blink when remaining>0; red blink when remaining<min unpaid; cypress + reduced-motion |
| T-054 | Base Rate “Rate (HKD)” label + currency rendering (finalize)          |       | Keep explicit in dialog columns; format as $X,XXX; cover edge cases |
| T-031 | Column min-width squeeze & ellipsis | 🧭    | lib/useColumnWidths.ts; components |
| T-032 | Sessions summary tooltip format | 🧭    | SessionsTab.tsx, OverviewTab.tsx |
| T-033 | Payment History blink logic | 🧭    | PaymentHistory.tsx, styles |
| T-034 | Base Rate history redesign & timezone | 🧭    | BaseRateHistoryDialog.tsx, BillingTab.tsx, SessionDetail.tsx |
| T-035 | Blink animation tokens & reduced motion | 🧭    | studentDialog.css, PaymentDetail.tsx |
| T-036 | Cypress tests for width/blink/base rate | 🧭    | cypress/e2e |
| T-037 | Reduce table column min width to ~36px with ellipsis + hover tooltip; keep auto-fit       | 🧭    | lib/useColumnWidths.ts, table cell styles |
| T-038 | Sessions summary format (fix legacy T-217): Total {all} (❌ {cancelled}); tooltip ✔️ {…}   | 🧭    | SessionsTab + mirror in Personal tab |
| T-039 | Payment History: yellow blink when remaining > 0                                          | 🧭    | PaymentHistory; CSS blink class |
| T-040 | Payment History: red blink when remaining < min unpaid session amount                     | 🧭    | PaymentHistory; useBilling analysis; CSS |
| T-041 | Move Base Rate info button from Session Detail to Billing tab title                       | 🧭    | Remove from SessionDetail; add to Billing tab |
| T-042 | Base Rate History redesign: Add modal, Effective Date (HK midnight) as `effectDate`, UI   | 🧭    | BaseRateHistoryDialog; dayjs tz; tooltips; inline edit for missing dates |
| T-043 | Add dayjs + timezone; normalize HK date handling for base rate history                    | 🧭    | deps + utils |
| T-044 | Cypress: blink logic tests; Base Rate effective date default & tooltip checks             | 🧭    | cypress/e2e/*.cy.js |
| T-030 | Task Log guardrails CI & append-only rule | ✅    | docs/Task Log.md, CONTRIBUTING.md, .github/workflows/task-log-guard.yml |
| T-001 | Column resizing (thin lever, hover, big hit area) + per-user persistence | ✅    | lib/useColumnWidths.ts, .col-resizer |
| T-002 | Sticky footers for Student Dialog screens (with shadow) | ✅    | .dialog-footer + padding in detail views |
| T-003 | "Amount Received" blink: infinite + darker yellow (list & detail) | ✅    | .blink-amount |
| T-004 | PaymentDetail: robust remaining calculation + sticky Assign | ✅    | Remaining = remainingAmount ?? (amount - appliedAmount) |
| T-005 | Payment list "For Session(s)" by ordinal | ✅    | Uses billing rows to map ordinals |
| T-006 | Popover/Menu/Select clipping fix inside dialogs | ✅    | Theme defaults to body |
| T-007 | Sticky, resizable ordinal "#" column in Sessions | ✅    | Sticky first column + resizer |
| T-008 | Calendar scan integration (UI+API+Apps Script) | ✅    | /api/calendar-scan, tools menu |
| T-009 | Configure CALENDAR_SCAN_URL in .env.local | 🧭    | Set and restart; add to Vercel envs |
| T-010 | Apps Script config IDs + services & scopes | 🧭    | COACHING_CALENDAR_ID, FIRESTORE_PROJECT_ID |
| T-025 | Revert Total Sessions to include cancelled/proceeded | ✅    | SessionsTab summary + card view; ordinal mapping stable |
| T-026 | Double-click to auto-size column to widest visible content | ✅    | useColumnWidths autoSize() + data-col=... + persisted |
| T-027 | Balance-due unification and cache write-back | ✅    | Card uses useBilling; writeSummaryFromCache audited |
| T-028 | Dialog/overlay z-index & portal audit (Add Payment on top) | ✅    | Theme MuiDialog container; remove conflicting z-index |
| T-029 | Base Rate history modal + add entry (editedBy) | ✅    | Info icon in SessionDetail; new BaseRateHistoryModal |
| T-011 | Firestore number encoding: doubleValue for non-integers | 🧭    | Update toFirestoreFields |
| T-012 | Calendar sync 410 recovery (stale syncToken) | 🧭    | Retry full on 410 |
| T-013 | Add resizers to PaymentDetail headers | 🧭    | Consistency |
| T-014 | A11y polish for loading/blink | 🧪    | Reduced motion for all blinks |
| T-015 | Sticky footer regression tour on small viewports | 🧪    | Visual QA |
| T-016 | Tests for calendar scan endpoints | 🧭    | Node tests |
| T-017 | Canonicalize Task Log + quick-access link | 🧭    | Readme/menu |
| T-018 | Remove legacy Batch Rename Payments tool | ✅    | File removed |
| T-019 | Dropdowns covered by dialog (global audit) | 🧪    | Confirm after theme fix |
| T-020 | Table perf for large datasets | 🗓️    | Virtualization later |
| T-021 | Secure /api/calendar-scan | 🧭    | Admin check/secret header |
| T-022 | Surface scan results/log in UI | 🗓️    | Optional log panel |
| T-023 | Replace slow-blink placeholders with Skeletons | 🧭    | Card metrics |
| T-024 | Make scrollbar-in-footer consistent across all tables | 🧪    | Quick sweep |

---

Prompts table — update:

| ID    | Title                                                | State | Notes |
|-------|------------------------------------------------------|-------|-------|
| P-020 | Base Rate effectDate SSOT, summary naming/hover, card Total, min-width v2, cached.billingSummary, tests |        | Will implement T-045..T-054 |
| P-019 | Min-width squeeze, T-217 display, payment blink logic, Base Rate history redesign         | 🧭    | This change |
| P-018 | Context Bundle automation, payment summary write, overlay test hardening, README link fix | ✅    | This change |
| P-017 | Task Log guardrails + finish P-016 acceptance | ✅    | This change |
| P-016 | Autosize cols; sessions total parity; balance due source; modal stacking; base rate audit; GAS TZ/secret | 🧭    | See `prompts/p-016.md` for scope and acceptance criteria. Includes tasks T-090..T-095. |
| P-015 | UI polish + scan hardening               | ✅    | Sticky dialog footers; thinner resize lever; per-user column widths; sticky ordinal #; infinite/darker blink on “Amount Received” (list & detail); “For Session(s)” mapping in Payment History; `/api/calendar-scan` bridged to GAS with incremental/full; spinner & toasts; removed BatchRenamePayments; Theme Popper/Menu containers pinned to `document.body`. |
| P-011 | Calendar scan integration (Apps Script)              | ✅    | Shipped |
| P-012 | Resizable tables + sticky # + blink polish           | ✅    | Shipped |
| P-014 | Session totals revert, auto-size, due unification, dialog audit, base-rate history | ✅    | This change |


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
