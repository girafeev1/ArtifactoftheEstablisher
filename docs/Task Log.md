# Task Log

> Single source of truth for prompts (P-###) and engineering tasks (T-###).  
> Convention: ✅ done, ⏳ in progress, 🧭 next / planned.

Latest change summary
- Invoice-centric Project Details merged (PR #296): unified invoice collection, moved invoice logic out of project docs, added per-invoice audit logging, and improved project view layout.
- Project create form refinements: default sort by project number DESC, moved Project Pickup Date above Client Company, auto-fill client details on name, and simplified create fields.
- Invoice create UX: show Create Invoice CTA when none exist; restored filled header inputs; refined status select width and alignment.
- Logging: added verbose client/API logging for project create/patch; fixed client-log recursion and preserved original console; throttled 403 list warnings.
- Badge now renders top-right in the app, confirming deploys reach prod (shows the active P-prompt id).
- PaymentDetail groundwork present: single Remaining wrapper + assignment zero-state; final single-blink hookup still pending.
- ERL directory helpers + identifier normalization improved; Entity/Bank/Account dropdowns not visible yet in Add Payment dialog or in Payment Detail editing-on-empty.
- “Back” control not yet placed inside sticky footer across StudentDialog.
- 3-dots settings button still mispositioned; must be bottom-left inside the white card, aligned with the card’s footer row (not in sidebar).
- Sessions tab sorting not implemented yet.
- Deploy noise reduced; investigating occasional builds after “archive PR ###” context commits.

Tasks T-xxx
### T-090
- Title: Invoice-centric project details — unify invoice model and polish UI (P-029)
- Branch: codex/invoice-centric-project-details
- PR: #296
- Status: Completed
- Outcomes:
  - Unified invoice documents under collection `invoice`; removed invoice/payment/client write-through on project docs.
  - Project detail layout polished; per-invoice audit logging added; refreshed billing UI.
  - Firestore rename/cleanup scripts added (rename IDs; remove legacy subcollections).
- Commits: 8bac9c2 (merge), 7c45b71, 6a62b61, 57a8ccf, dd8e554, 584d8c5, e1e9777, 5a0a8c3, 2b0e5c0
- Notes:

### T-091
- Title: Project create flow — sort, pickup date placement, auto-fill client details (P-030)
- Branch: main
- PR: —
- Status: Completed
- Outcomes:
  - Default list sort by project number DESC; write pickup date; moved pickup date above client company in create form.
  - Auto-fill client details by name; align header/rows.
- Commits: 471a590, 8f8099e, bb04abd, 032d59d, d2eb085
- Notes:

### T-092
- Title: Invoice creation UX — CTA & header inputs; status width (P-031)
- Branch: main
- PR: —
- Status: Completed
- Outcomes:
  - Show "Create Invoice" CTA when no invoices; restore filled header inputs on create dialog.
  - Refine status select width; align invoice rows to headers; polish list aggregation.
- Commits: 4c31afd, 86cdebd, 435f81c, 7ed5157
- Notes:

### T-093
- Title: Client/API logging and client-log recursion fix (P-032)
- Branch: main
- PR: —
- Status: Completed
- Outcomes:
  - Added dev fetch wrapper; verbose client/API logs for create/patch; payload key logs.
  - Prevented recursive client-log loops; preserved original console; throttled 403 list warnings.
- Commits: 8c2e43f, d341596, c5511b7, f12c54c
- Notes:

### T-094
- Title: Duplicate Projects page to New UI (Refine/AntD) and compile under Next 15 (P-033)
- Branch: codex/duplicate-projects-page-to-new-ui
- PR: #295
- Status: Completed
- Outcomes:
  - New UI routes under `/dashboard/new-ui/projects` incl. list and show pages; wired basic data provider.
  - Ensured compile against Next.js 15; added antd reset and minimal Refine scaffolding.
- Commits: b42a8c6 (merge), b03543e, pages/new-ui files, styles/antd-reset.css, types/refinedev.d.ts
- Notes:

### T-095
- Title: Refine client gallery and preview (P-034)
- Branch: codex/refine-client-gallery
- PR: #254
- Status: Completed
- Outcomes:
  - Added client accounts preview page; stabilized search/gallery hooks; styling passes.
- Commits: 43741b2 (merge), ca186aa, f23e62e, 524d399
- Notes:

### T-096
- Title: New UI scaffolding — AppShell, client-accounts page, tests (P-035)
- Branch: main
- PR: —
- Status: Completed
- Outcomes:
  - Added `components/new-ui/AppShell.tsx` with Refine providers; created `pages/dashboard/new-ui/client-accounts.tsx` and tests.
- Commits: b03543e, f58b212, 5fa7f58
- Notes:

### T-080
- Title: Payment UI polish & data rules (P-024)
- Branch: codex/feat-payment-ui-polish-p024
- PR: <link to PR #213>
- Status: Completed
- Outcomes:
  - A) History headers: PASS — headers updated.
  - B) Sessions truncation: PASS — implemented in detail view (list view pending separately).
  - C) Sticky footer: PARTIAL — footer scaffolding present; “Back” not anchored yet (follow-up).
  - D) Identifier rule: PASS — normalized and displayed.
  - E) Tests: PASS — unit tests added; Cypress spec present (CI lacks Xvfb).
- Notes:

### T-081
- Title: Fix Payment Detail/History UX, restore assignment, inline editing (P-025)
- Branch: codex/fix-payment-ui-and-inline-editing-p025
- PR: <link to PR #214>
- Status: Partially Completed
- Outcomes:
  - Sticky Back button: FAIL — still attached to scroller (needs move into sticky footer).
  - Blinking logic: PARTIAL — Payment Amount static; Remaining still double-rendering in places.
  - Session assignment: FAIL — list can disappear; needs zero-state & stable render.
  - Inline editing (Payment Detail): PASS — edit-on-empty then read-only works.
  - Inline editing (Base Rate History): PASS — effectiveDate inline when empty then read-only.
  - Tests: PASS — unit tests present; Cypress spec present (skipped in CI).
- Notes:

### T-082
- Title: Finish Payment UX, Add Payment cascade, and list-view session truncation (P-026)
- Branch: codex/finish-payment-ux-and-add-payment-cascade-p026
- PR: <link to this PR>
- Status: Completed
- Outcomes:
  - Sticky footer: PASS – Back control inside footer with padding.
  - Remaining blink: PASS – single span; amount static.
  - Session assignment: PASS – table persists with zero-state.
  - Add Payment cascade: PASS – writes method, entity, identifier, ref #, timestamp, editedBy.
  - Payment History sessions: PASS – column added with 5-item ellipsis.
  - Header ellipsis: PASS – headers truncate independently.
  - Tests: PASS – unit tests pass; Cypress spec present (skipped in CI).
- Notes:

### T-083
- Title: Complete P-026 — sticky Back, single Remaining blink, stable assignment, Add Payment cascade, list “For Session(s)” truncation
- Branch: codex/finish-p026-followup
- PR: <link to this PR>
- Status: Completed
- Outcomes:
  - Sticky footer: PASS – Back control inside footer with padding.
  - Remaining blink: PASS – Payment Amount static; single Remaining span.
  - Session assignment: PASS – table persists with zero-state and updates Remaining.
  - Add Payment cascade: PASS – writes method, entity, identifier, ref #, timestamp, editedBy.
  - Payment History sessions: PASS – column truncates at five ordinals with ellipsis.
  - Header ellipsis: PASS – headers truncate independently.
  - Tests: PASS – unit tests pass; Cypress spec present (skipped in CI).
- Notes:

---
### T-084
- Title: Finalize Payment UX and Add Payment cascade (P-026-02r)
- Branch: codex/finalize-payment-ux-and-functionality-enhancements-02r
- PR: <link to this PR>
- Status: Completed
- Outcomes:
  - Bank dropdown labels fall back when name/code missing.
  - Saved P-026-02r prompt.
- Notes:

---
---

Tasks table — add/update:

| ID    | Title                                                | State | Notes / Files |
|-------|------------------------------------------------------|-------|---------------|
| T-096 | New UI scaffolding — AppShell + client-accounts + tests | ✅    | components/new-ui/AppShell.tsx; pages/dashboard/new-ui; __tests__/pages/dashboard/new-ui |
| T-095 | Refine client gallery and preview                          | ✅    | pages/dashboard/new-ui/client-accounts.tsx; styles/antd-reset.css |
| T-094 | Duplicate Projects page to New UI (Next 15 compile)        | ✅    | pages/dashboard/new-ui/projects/*; types/refinedev.d.ts |
| T-093 | Client/API logging and recursion fix                        | ✅    | pages/api/client-log.ts; logging wrappers |
| T-092 | Invoice creation UX — CTA & header inputs; status width     | ✅    | invoices UI changes |
| T-091 | Project create flow — sort, pickup date, auto-fill          | ✅    | project list/create form |
| T-090 | Invoice-centric project details — unify model               | ✅    | merge PR #296; rename/cleanup scripts |
| T-300 | 3-dots settings button: sticky bottom-left inside white card | ⏳    | Position within card footer row; not sidebar |
| T-301 | Sticky Back inside StudentDialog sticky footer | ⏳    | Footer anchors Back; body is scroll container |
| T-302 | Remaining blink = single element; Amount never blinks | ⏳    | Remove duplicate render; a11y reduced-motion |
| T-303 | Payment Detail editing-on-empty (Entity/Bank/Account/Ref) | ⏳    | Save writes + identifier compute + audit |
| T-304 | Add Payment cascade UI (Entity→Bank→Account) in dialog | ⏳    | Visible selects + dependent options |
| T-305 | Sessions tab: sorting + persist + aria-sort | 🧭    | Default unchanged; per-user preference |
| T-072 | Header ellipsis & width decouple (header no longer blocks narrow columns)                     | ✅    | Table headers CSS + autosize guard |
| T-073 | Payment History “For Session(s)” max 5 then “…”                                                | ✅    | PaymentHistory formatter; detail-only; list pending |
| T-074 | Sticky dialog footer (window bottom, not scroller)                                            | ⏳    | Back lives in scroller; move into footer in P-026. |
| T-075 | Add Payment: Method/Entity/Bank/Account/RefNumber fields + writes (timestamp, editedBy)       | 🧭    | PaymentModal, writes, types |
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
| T-058 | Payment History blink: yellow (remaining>0), red (< minUnpaidRate)       | 🧭    | PaymentHistory; minUnpaidRate util; a11y fallback |
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
| T-080 | StudentDialog Back button inside sticky footer                | ⏳    | Move Back into footer bar; ensure body has bottom padding; UI not visible yet |
| T-081 | Payment Detail blink logic: only Remaining blinks             | ⏳    | Remove duplicate span; Payment Amount static; UI not visible yet |
| T-082 | Payment History “For Session(s)” ≤5 + “…” (list) | ✅    | Shipped earlier; keep green |
| T-083 | Add Payment dialog cascade (Method/Entity/Bank/Account/Ref)   | ⏳    | ERL banks→accounts; identifier build; audit fields; UI not visible yet |
| T-084 | Payment History: For Session(s) shows ≤5 then … (list view)   | ✅    | Detail already truncates; list column to match |
| T-085 | Column header width decouple (narrow even when header long)   | ⏳    | th ellipsis; table-layout fixed; cell widths OK |

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
