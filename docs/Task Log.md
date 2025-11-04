# Task Log

_Status legend:_ ✅ done · ⏳ in progress · 🧭 planned · 🗃 archived

## Current Focus

### In Progress
### T-107
- Title: Invoice detail editing toggle & number editing parity (P-038)
- Branch: main
- PR: —
- Status: ⏳ In Progress
- Outcomes (planned):
  - Add a dedicated “Edit Invoice Details” button beneath the invoice detail divider to control detail editability independent of Manage mode.
  - Allow invoice number edits regardless of invoice count; ensure toggling resets the working draft safely.
  - Relocate the header edit action beside Project Pickup Date and update styling per request.
- Notes:
  - Source: Desktop log “Terminal Saved Output 000.txt” & current session follow-up (2025-10-27).

### T-108
- Title: Invoice item layout polish (Sub-Qty, Notes, widths) (P-039)
- Branch: main
- PR: —
- Status: ⏳ In Progress
- Outcomes (planned):
  - Narrow the “To” column within invoice tables to free space for items.
  - Add a “Sub-Qty” field inline with the item title and persist the value.
  - Support multiline Notes beneath fee type and render stored line breaks in the UI.
- Notes:
  - Source: Desktop log “Terminal Saved Output 000.txt” & current session follow-up (2025-10-27).
 
| ID    | Title                                                | State | Notes / Files |
|-------|------------------------------------------------------|-------|---------------|
| T-301 | Sticky Back inside StudentDialog sticky footer | Won’t Do | Footer anchors Back; body is scroll container |
| T-302 | Remaining blink = single element; Amount never blinks | Won’t Do | Remove duplicate render; a11y reduced-motion |
| T-303 | Payment Detail editing-on-empty (Entity/Bank/Account/Ref) | Won’t Do | Save writes + identifier compute + audit |
| T-304 | Add Payment cascade UI (Entity→Bank→Account) in dialog | Won’t Do | Visible selects + dependent options |
| T-072 | Header ellipsis & width decouple (header no longer blocks narrow columns)                     | ✅    | Table headers CSS + autosize guard |
| T-073 | Payment History “For Session(s)” max 5 then “…”                                                | ✅    | PaymentHistory formatter; detail-only; list pending |
| T-074 | Sticky dialog footer (window bottom, not scroller)                                            | Won’t Do | Back lives in scroller; move into footer in P-026. |
| T-075 | Add Payment: Method/Entity/Bank/Account/RefNumber fields + writes (timestamp, editedBy)       | Won’t Do | PaymentModal, writes, types |
| T-076 | ERL directory integration (read banks+accounts from `erl-directory`; graceful fallback)       | 🧭    | lib/erlDirectory.ts, firebase init |
| T-077 | Payment list: rename columns; add Method & Entity                                             | ✅    | PaymentHistory.tsx (Method, Entity, Bank Account, Reference #) |
| T-078 | Payment detail: two-column summary layout                                                     | ✅    | PaymentDetail.tsx, styles (identifier & ref #; “For Session(s)” View all/Hide) |
| T-079 | Tests: formatters, identifier write guard, sticky footer, Add Payment flow                    | ✅    | formatters & truncate helpers (Jest); e2e scaffold |
| T-066 | Payment History/Detail: hook up blink classes (yellow when remaining>0; red when < minRate) | ✅    | PaymentHistory.tsx, PaymentDetail.tsx, CSS,
 reduced-motion |
| T-067 | Move Base Rate info icon to Billing tab label; remove from Session Detail | 🧭    | BillingTab.tsx, SessionDetail.tsx |
| T-068 | Calendar scan: toast messages + last-scan status caption | ⏳    | Tools UI; consume /api/calendar-scan messages |
| T-069 | (Optional) ScanLogs storage (last 20 runs) | ✅    | lib/scanLogs.ts; tiny list/read |
| T-070 | Label consistency: “Joined Date” | ✅    | OverviewTab + any references |
| T-071 | Repo hygiene: ensure single prompts/P-021.md (keep the longer version) | 🧭    | Remove duplicate if present |
| T-055 | Loading UX: spinner→blinking “–” in value (respect reduced-motion)       | 🧭    | OverviewTab & other fields; remove label spinners |
| T-056 | Card Due parity & loading fallback                                       | 🧭    | Prefer cached.billingSummary; show “–” while loading |
| T-057 | Sessions: “Session Vouchers” column hidden by default (persist per user) | 🧭    | SessionsTab columns/filters |
| T-058 | Payment History blink: yellow (remaining>0), red (< minUnpaidRate)       | Won’t Do | PaymentHistory; minUnpaidRate util; a11y fallback |
| T-059 | Base Rate info icon relocation (Billing tab Base Rate field)             | 🧭    | Move from Session Detail to Billing tab |
| T-060 | Base Rate History: footer Add, sub-dialog (Rate+Effective Date), editing | 🧭    | Inline fix for missing effectDate; keep tooltips/currency |
| T-061 | Column min-width v3 (~24–26px) + ellipsis + keyboard resize              | 🧭    | useColumnWidths + cell styles |
| T-062 | Calendar scan UX: error surfacing & logs (incremental/full)              | 🧭    | /api/calendar-scan + UI toasts + ScanLogs |
| T-063 | Calendar delete/cancel propagation & 410 full-resync fallback            | 🧭    | GAS sync + session updates |
| T-064 | Scan status caption in Tools menu (last run, result)                      | 🧭    | Small status text; optional link to logs |
| T-065 | Tests: blink logic, base-rate effectDate, min-width keyboard             | 🧭    | Unit + Cypress |
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
| T-085 | Column header width decouple (narrow even when header long)   | ⏳    | th ellipsis; table-layout fixed; cell widths OK |
| T-080 | ✅ | Payment UI polish & data rules (P-024) | Legacy payment UI polish (superseded by invoices). |
| T-081 | ✅ | Fix Payment Detail/History UX (P-025) | Inline editing + history adjustments (legacy). |
| T-082 | ✅ | Finish Payment UX & Add Payment cascade (P-026) | Finalised payment screens before invoice migration. |
| T-083 | ✅ | Complete P-026 follow-up | Sticky footer, session assignment, cascade polish (legacy). |
| T-084 | ✅ | Finalize Payment UX enhancements (P-026-02r) | Bank dropdown fallbacks; archived after invoice rewrite. |
| T-090 | ✅ | Invoice-centric project details (P-029) | Unified invoice model & UI refresh. |
| T-091 | ✅ | Project create flow improvements (P-030) | Sorting, pickup date placement, auto-fill tweaks. |
| T-092 | ✅ | Invoice creation UX polish (P-031) | CTA + header inputs + status width adjustments. |
| T-093 | ✅ | Client/API logging & recursion fix (P-032) | Verbose logging + recursion guard. |
| T-094 | ✅ | Duplicate Projects page to New UI (P-033) | Refine/Next 15 scaffolding. |
| T-095 | ✅ | Refine client gallery & preview (P-034) | Gallery and preview styling. |
| T-096 | ✅ | New UI scaffolding — AppShell & client accounts (P-035) | Providers, page wiring, tests. |
| T-097 | 🗃 | Project header delete action (P-036a) | Superseded by current workflow; original requirement archived. |
| T-098 | 🗃 | Invoice items header gating (P-036b) | Archived legacy request from previous layout. |
| T-099 | 🗃 | Stacked dropdown sizing (~220px) (P-036c) | Archived; revisit if layout requires. |
| T-100 | 🗃 | Company match clear-on-mismatch (P-036d) | Archived legacy auto-fill handling. |
| T-101 | 🗃 | Flash-fill visibility polish (P-036e) | Archived legacy animation task. |
| T-102 | 🗃 | Item description & TextArea styling (P-036f) | Archived legacy styling task. |
| T-103 | 🗃 | Create Project — add `subsidiary` field (P-036g) | Archived legacy create-flow work. |
| T-104 | 🗃 | Tooltip styling for bank info (P-036h) | Archived legacy tooltip polish. |
| T-105 | 🗃 | Client header alignment & cleanup (P-036i) | Archived with legacy client header design. |
| T-106 | 🗃 | Client Accounts payment status (P-037) | Superseded by new invoice-level implementation. |
| T-300 | 🧭 | Three-dot settings button placement | Relocate the settings menu to the bottom-left of the white card footer on the new UI page. |
| T-305 | 🧭 | Sessions tab sorting persistence | Add user-sort persistence and proper `aria-sort` support for the sessions list. |

---

### Archived (superseded by Refine/invoices)

- T-301 — Sticky Back inside StudentDialog sticky footer
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Place Back/Cancel inside page or modal footer using AntD Layout.
    - Avoid legacy dialog scroller; ensure sticky footer across viewport.

- T-074 — Sticky dialog footer (window bottom, not scroller)
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Use AntD PageHeader/Footer and Affix for cross-page sticky actions.
    - Back/Save aligned to footer row; body scrolls independently.

- T-302 — Remaining blink = single element; Amount never blinks
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Replace blink with stable status tags/badges; no animation.
    - Respect prefers-reduced-motion; color-only indicators.

- T-303 — Payment Detail editing-on-empty (Entity/Bank/Account/Ref)
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Invoice detail supports Paid To/On and Ref # with zero-state.
    - Persist editedBy/timestamp; typed fields; audit log.

- T-304 — Add Payment cascade UI (Entity→Bank→Account) in dialog
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - For invoices, cascade selectors for payee (entity→bank→account).
    - Source from erlDirectory; reset dependent selects on change.

- T-075 — Add Payment: Method/Entity/Bank/Account/RefNumber (+ writes)
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Invoice writes: paidTo, paidOn, ref #, editedBy, timestamp.
    - Keep per-invoice audit trail; no legacy payment doc writes.

- T-058 — Payment History blink (yellow/red thresholds)
  - Status: Won’t Do
  - Rescoped for AntD/Invoices:
    - Replace blink thresholds with discrete status icons/colors.
    - Ensure accessibility (contrast, no motion).

---

Prompts table — update:

| ID    | Title                                                | State | Notes |
|-------|------------------------------------------------------|-------|-------|
| P-027-04r | Finish cascade UI (detail), sticky Back, 3-dots placement, single Remaining blink, sessions sorting, badge in card view. | 🧭    | See prompts/p-027-04r.md |
| P-027-03r | Finish Add Payment cascade UI; sticky Back; single Remaining blink; stable assignment; badge; 3-dots placement. | ✅    | See prompts/p-027-03r.md |
| P-027-02r | Ship the actual Add Payment cascade UI + sticky Back + single Remaining blink + stable assignment | ✅    | See prompts/p-027-02r.md |
| P-026 | Finish Payment UX and Add Payment cascade | ⏳    | See prompts/p-026.md (revisions: p-026-01r, p-026-02r, p-026-03r) |
| P-025 | Fix Payment Detail/History UX, restore assignment, inline editing | ⏳    | See prompts/p-025.md |
| P-024 | Payment UI polish & data rules | ✅    | See prompts/p-024.md |

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
