# Task Log

_Status legend:_ ✅ done · ⏳ in progress · 🧭 planned · 🗃 archived

## Current Focus

### In Progress
### T-107
- Title: Invoice detail editing toggle & number editing parity (P-038)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes (planned):
  - Allow invoice number edits regardless of invoice count; ensure toggling resets the working draft safely.
  - Relocate the header edit action beside Project Pickup Date and update styling per request.
- Progress:
  - Merged “Edit Invoice Details” into a single “Manage Invoices” control; entering Manage also enables detail editing.
  - Pending (unsaved) invoice row uses a Close icon instead of trash; cancel exits detail-edit state.
  - Removed legacy labels; show “Commit Changes” while editing, otherwise “Manage Invoices”.
  - “No changes made” message surfaces when saving without edits; avoids PATCH.
  - “Add additional invoice” row hides correctly after exiting manage mode.
- Notes:
  - Source: Desktop log “Terminal Saved Output 000.txt” & current session follow-up (2025-10-27).

### T-108
- Title: Invoice item layout polish (Sub-Qty, Notes, widths) (P-039)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes (planned):
  - Ensure “Sub-Qty” is inline at the right-end of the Item Title row in both view and edit modes.
  - Show bank name abbreviation only when it has 4+ tokens; otherwise show full name (e.g., “Dah Sing Bank” stays full).
  - Add a quantity unit line beneath Unit Price to capture strings like “/hour” alongside numeric values.
  - Surface per-item discounts beneath each total instead of a dedicated column.
- Progress:
  - Narrowed the “To” column in the invoice table to free space for items. ✅
  - Notes render with preserved line breaks (pre-wrap); table cells allow wrapping. ✅
  - “Sub-Qty” is inline, right-aligned with the Item Title in both view and edit modes. ✅
  - Bank name abbreviation shows only for names with 4+ tokens; 3-token names (e.g., “Dah Sing Bank”) show in full. ✅
  - Item title/fee type/notes weights standardized (Medium/Extra Light/Light) in view and edit modes. ✅
  - Unit Price column now stores & displays `/unit` beneath the amount (editable inline). ✅
  - Discounts captured under the Total column; view mode shows a red “OFF” chip, edit mode offers borderless input. ✅
  - Total row status shows “All Cleared”, “All Due”, or “Partially” based on invoice outcomes. ✅
  - Unit Price, Qty, and Total columns stay right-aligned in both edit and read modes for consistent layout. ✅
  - Sub-Qty placement: inline after title in view mode; a line below the title in edit mode. ✅
  - Update — 2025-11-04:
    - Sub-Qty is italic in view mode and left-aligned when on its own line in edit mode. ✅
    - The “/” unit marker is a prefix on the same line as the unit input in edit mode; view mode shows `/unit` beneath the amount. ✅
    - Discount input is right-aligned in edit mode; a red “OFF” chip renders beneath the row total in view mode when discount > 0. ✅
    - A gray divider appears above the total row; total status reads All Cleared / All Due / Partially. ✅
- Notes:
  - Source: Desktop log “Terminal Saved Output 000.txt” & current session follow-up (2025-10-27).


| ID    | Title                                                | State | Notes |
|-------|------------------------------------------------------|-------|-------|
| P-027-04r | Finish cascade UI (detail), sticky Back, 3-dots placement, single Remaining blink, sessions sorting, badge in card view. | 🧭    | See prompts/p-027-04r.md |
| P-027-03r | Finish Add Payment cascade UI; sticky Back; single Remaining blink; stable assignment; badge; 3-dots placement. | ✅    | See prompts/p-027-03r.md |
| P-027-02r | Ship the actual Add Payment cascade UI + sticky Back + single Remaining blink + stable assignment | ✅    | See prompts/p-027-02r.md |
| P-026 | Finish Payment UX and Add Payment cascade | ⏳    | See prompts/p-026.md (revisions: p-026-01r, p-026-02r, p-026-03r) |
| P-025 | Fix Payment Detail/History UX, restore assignment, inline editing | ⏳    | See prompts/p-025.md |
| P-024 | Payment UI polish & data rules | ✅    | See prompts/p-024.md |

### T-109
- Title: Telegram Bot integration (webhook, ensure endpoint, secret verification)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Added Telegram webhook at `pages/api/telegram/webhook` with secret header verification and non-POST 200 responses to avoid 405s.
  - Added `/api/telegram/ensure` and `/api/telegram/setup` to programmatically set webhook with `TELEGRAM_WEBHOOK_SECRET`.
  - Added `/api/telegram/debug` to confirm env presence.
  - Fixed early response issue (no `res.end()` before async work) to ensure reliable replies on Vercel.
- Notes:
  - Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (Vercel).

### T-110
- Title: Telegram Text UI — Projects/Invoices UX, formatting, and inline editing
- Branch: main
- PR: —
- Status: ⏳ In Progress
- Outcomes (delivered):
  - Edit-in-place flow using `editMessageText` with Back buttons at every step (Years → Projects → Project → Invoice → back).
  - Headings: <b><u>Project Detail</u></b>, <b><u>Invoice Detail</u></b>, <b><u>Client Detail</u></b>; Item headings underlined.
  - Invoice formatting per spec: feeType italic; item calc line "<i>unit x qty/unit</i> = <b>Total</b>" two lines below notes; bottom "<b>Total</b> — <b>To</b> — <i>Status</i>" with bank lookup.
  - Project detail formatting: presenter/worktype, <b>title</b>, <i>nature</i>, blank line, subsidiary (name mapped).
  - Added Edit flows for Project and Invoice fields: field selection → value message → preview → Confirm/Revise/Cancel; writes via Firestore helpers.
- Planned:
  - List projects as individual message bubbles (Open/Edit per project) with paginated footer and Back to Years.

### T-111
- Title: Remove Slack/Discord integrations and secrets
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Removed Slack routes (`pages/api/slack/*`) and Discord route (`pages/api/discord/interactions.ts`).
  - Removed CLI script `scripts/discord-register-commands.js` and DiscordProvider from NextAuth.
  - Dropped `tweetnacl` and its type stub; cleaned package.json.
  - Ensured `.env.local` contains no Slack/Discord secrets.

### T-112
- Title: Firestore Admin — non-default database fix
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Switched server-side reads to explicit `@google-cloud/firestore` client with `databaseId` (e.g., `tebs-erl`) instead of mutating private `_settings`.
  - Resolved hanging/non-returning queries during Telegram callbacks.

### T-115
- Title: Telegram — list projects as individual bubbles, no deletion, footer Back
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - After selecting a year, post one message per project as a two-line summary bubble with [Select] and [Edit] buttons.
  - Do not delete prior bubbles; retain history for responsiveness. Edit the selected bubble in place for details.
  - Remove the "Projects in YYYY:" header message; add a footer Back-to-Years bubble after listing.

### T-118
- Title: Telegram — show subsidiary full name (not identifier)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Resolve `project.subsidiary` via admin Firestore (`aote-ref/Subsidiaries`) and display the English name in Project Detail.

### T-119
- Title: Telegram — bank name abbreviation logic for invoice “To” line
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - For long bank names (≥ 4 tokens), show an acronym of capitalized tokens; otherwise show full name. Mirrors web app behavior.

### T-120
- Title: Telegram — Back button dedupe guard and layout sanity
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Ensure exactly one Back row per screen. Removed legacy branches that produced duplicate Back rows.

### T-121
- Title: Docs — Task Log maintenance for Telegram phases
- Branch: main
- PR: —
- Status: ⏳ In Progress
- Outcomes:
  - Append T-115/T-118/T-119/T-120 and keep Task Log synchronized as Telegram UI evolves.

### T-122
- Title: Telegram — Year/Projects navigation cleanup (vanish year list; Back clears project bubbles)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - When selecting a year, the year list (welcome + year keyboard) is removed to keep the chat focused on the project list.
  - Project listing footer includes [➕ Add New Project] and [⬅ Back to Years].
  - Selecting a project prunes other project bubbles so only the selected project remains visible.
  - Selecting [⬅ Back to Years] removes all project bubbles and re‑shows the year list.
  - Added a heading bubble at the top of the list: “Projects of <year>”.

### T-117
- Title: Telegram — Expand invoice editing coverage
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Added Client Company Name to editable invoice fields.
  - Added invoice number rename (safe rekey) with immediate refresh.
  - Added item-level edits (Title, Sub‑Qty, FeeType, Notes, Unit Price, Quantity, Quantity Unit, Discount) with preview/confirm.

### T-123
- Title: Telegram — Create New Invoice (suggested number + guided fields)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Suggest base invoice number derived from project number + pickup date; user can accept or enter a custom number.
  - Guided capture of client fields; preview and Confirm/Cancel; writes via createInvoiceForProject.
  - After creation, shows Invoice Detail as multi-bubble view.

### T-124
- Title: Telegram — Create New Project (suggested number + guided fields)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Suggest next sequential project number for the chosen year (same rules as web app UI).
  - Guided capture of key project fields; preview and Confirm/Cancel; writes via createProjectInDatabase.
  - After creation, post a choice bubble to continue (Create New Invoice / Back to Projects) without erasing prior chat history.

### T-127
- Title: Telegram — Project listing UX polish (top heading + footer back)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Add “Projects of <year>” heading bubble at the top of the project list.
  - Ensure footer with [➕ Add New Project] and [⬅ Back to Years] is always present and visible.

### T-128
- Title: Telegram — Creation flows robustness (suggested buttons + fresh-chat safety)
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Fixed “Use suggested” for Project Number (NPC:NUMOK) to advance the flow.
  - Switched invoice/project creation prompts to new messages while user is typing to avoid fresh-chat deletions.
  - Subsidiary preview resolves identifiers to full English name; falls back to user input if unrecognized.

### T-125
- Title: Telegram — Invoice Detail as multi-bubble sections
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Controller message shows “Invoice: #…”.
  - Client bubble headed “Client Detail”.
  - “Invoice Detail” heading bubble above the first item, then one bubble per item.
  - Totals/To/Status as a dedicated bubble; Back appears after this bubble.

### T-126
- Title: Telegram — Project Detail UI polish for invoices
- Branch: main
- PR: —
- Status: ✅ Done
- Outcomes:
  - Invoices sorted earliest → latest.
  - “➕ Create New Invoice” placed below the invoice list.
  - Renamed “Edit” to “Edit Project Detail”.

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
