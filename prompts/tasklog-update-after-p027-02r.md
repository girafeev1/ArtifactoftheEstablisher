Task Log update — reflect PR #225 and queue P-027-03r

Save this prompt at: prompts/tasklog-update-after-p027-02r.md
Branch: codex/docs-task-log-update-after-p027-02r
PR title: docs(task-log): reflect PR #225; queue P-027-03r
Labels: docs, codex

## What to change in docs/Task Log.md

1) Latest change summary — append bullets:
- PaymentDetail: wrapped Remaining in a single element and added zero-state for assignment (foundation for single-blink and persistent shell). [PR #225]
- ERL directory helpers added/rewritten with tests; identifier normalization improved (recompute from bankCode/accountDocId). [PR #225]
- Small CSS tweak toward sticky footer. [PR #225]

2) Tasks table — set realistic statuses:
- Keep **⏳**:
  - Sticky Back inside sticky footer (not verified).
  - Remaining single-element blink (foundation in place; final hookup pending).
  - Session assignment persistent shell + E2E behavior.
  - **Add Payment cascade UI (Entity→Bank→Account)** — still missing visibly.
- Keep **✅**:
  - Payment History list “For Session(s)” column (≤5 + “…” ) and header ellipsis.
- If any rows over-claimed completion for the four items above, change them to **⏳** with a short note “UI not visible yet”.

3) Prompts table:
- Add **P-027-03r** with state **🧭** and summary: “Finish Add Payment cascade UI; sticky Back; single Remaining blink; stable assignment; badge; 3-dots placement.” Link to `prompts/p-027-03r.md`.
- Keep P-027-02r as ⏳ (in progress), and prior rows unchanged.

4) Formatting rules:
- Preserve headings/casing; append-only for historical bullets.
- Do not modify CI/workflows in this prompt.

## Acceptance
- Latest summary updated with PR #225 bullets.
- Tasks state reflects actual app status.
- P-027-03r added to Prompts table.
