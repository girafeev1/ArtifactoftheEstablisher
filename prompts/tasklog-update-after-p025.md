Update Task Log based on P-024 & P-025, and queue P-026

Save this prompt at: prompts/tasklog-update-after-p025.md
Branch: codex/docs-task-log-update-after-p025
PR title: docs(task-log): reflect P-024/P-025 outcomes; queue P-026
Labels: docs, codex

Context (facts to reflect)

P-024 & P-025 merged with substantial Payment UI work; PR #214’s Context Bundle shows the changed files and that both prompts/p-024.md and prompts/p-025.md are present; docs/Task Log.md was updated there. Ensure the canonical log remains docs/Task Log.md (no docs/task-log-vol-1.md).

What to change in docs/Task Log.md

Latest change summary — add new bullets (append-only, keep existing bullets):

Payment History: headers finalized (Method, Entity, Bank Account, Reference #); two-column detail shows identifier & reference with safe fallbacks. 

Payment Detail: “For Session(s)” truncation with View all/Hide; inline edit when empty for metadata; added tests & helpers. 

Sticky footer scaffolding present; Back must be anchored inside footer (queued for P-026).

Remaining blink polish & session assignment table robustness queued for P-026.

Tasks table — add/update

Mark complete (✅) any rows that P-024/P-025 actually delivered (e.g., history columns / detail fields), keep sticky footer as ⏳ with a note (“Back lives in scroller; move into footer in P-026”), and leave history “For Session(s)” column truncation as 🧭 if still pending in list view.

Add new P-026 follow-ups at the end with next T-IDs:

| T-<next>   | StudentDialog Back button inside sticky footer                | ⏳ | Move Back into footer bar; body gets bottom padding |
| T-<next+1> | Payment Detail blink logic: only Remaining blinks             | ⏳ | Remove duplicate span; Payment Amount static |
| T-<next+2> | Payment Detail: session assignment visible & robust           | ⏳ | Zero-state; selection updates Remaining; persist |
| T-<next+3> | Add Payment dialog cascade (Method/Entity/Bank/Account/Ref)   | ⏳ | ERL banks→accounts; identifier build; audit fields |
| T-<next+4> | Payment History: For Session(s) shows ≤5 then … (list view)   | ⏳ | Detail already truncates; list column to match |
| T-<next+5> | Column header width decouple (narrow even when header long)   | ⏳ | th ellipsis; table-layout fixed; cell widths OK |

Prompts table — update

Keep P-024 and P-025 linked to prompts/p-024.md / prompts/p-025.md. 

Add P-026 as 🧭 (planned) linked to prompts/p-026.md with the summary from this prompt.

Formatting rules

Preserve section headings/casing: “Task Log”, “Latest change summary”, “Tasks table — add/update:”, “Prompts table — update:”.

Append-only; don’t rewrite earlier entries.

Ensure docs/task-log-vol-1.md does not exist (delete if present).

Commit plan

docs(task-log): add P-024/P-025 bullets; mark completed; queue P-026 tasks

docs: ensure only docs/Task Log.md is used (remove stray task-log-vol-1.md if present)

Acceptance

docs/Task Log.md updated with the bullets above, statuses adjusted, and P-026 queued.

No other docs or workflows touched.
