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

---

Tasks table — add/update:

| ID    | Title                                                | State | Notes / Files |
|-------|------------------------------------------------------|-------|---------------|
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
| P-017 | Task Log guardrails + finish P-016 acceptance | ✅    | This change |
| P-011 | Calendar scan integration (Apps Script)              | ✅    | Shipped |
| P-012 | Resizable tables + sticky # + blink polish           | ✅    | Shipped |
| P-014 | Session totals revert, auto-size, due unification, dialog audit, base-rate history | ✅    | This change |

