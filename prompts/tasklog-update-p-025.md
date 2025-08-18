# Task Log update — reflect P-024 progress and queue P-025 items (one-off)

**Save this prompt file at:** `prompts/tasklog-update-p-025.md`
**Branch:** `codex/docs-task-log-update-p025`
**PR title:** `docs(task-log): reflect P-024 progress; queue P-025 items`
**Labels:** `docs`, `codex`

## Context (facts from PR #213)

* P-024 added **Payment History columns** (`Method`, `Entity`, `Bank Account`, `Reference #`) and safe fallbacks. ([GitHub][1])
* P-024 added **“For Session(s)” truncation with “View all”** in **Payment Detail** and surfaced **Bank Account (identifier)** and **Reference #** in the detail panel. ([GitHub][1])
* P-024 normalized **payment identifier** on save and introduced helpers/tests (`buildIdentifier`, `truncateList`, Jest config). ([GitHub][1])
* P-024 mistakenly created `docs/task-log-vol-1.md`; our canonical log is `docs/Task Log.md`. ([GitHub][1])

## What to change

### 0) Remove the wrong file

* **Delete** `docs/task-log-vol-1.md` from the repo. (We only maintain `docs/Task Log.md`.)

### 1) Update `docs/Task Log.md` — “Latest change summary”

Append a new block of bullets **at the top** (keep existing bullets; this is append-only) summarizing P-024’s actual outcomes:

* Payment History: headers finalized (`Method`, `Entity`, `Bank Account`, `Reference #`). ([GitHub][1])
* Payment Detail: “For Session(s)” truncates to 5 with **View all/Hide**; shows `identifier` and `refNumber` with safe fallback. ([GitHub][1])
* Payments: `identifier` normalized on write; helpers + unit tests added (format & truncate). ([GitHub][1])
* Sticky footer scaffolding landed (needs follow-up to anchor **Back** inside footer).

### 2) Update “Tasks table” rows (edit in place; keep order/style)

* Mark as **✅** (completed by P-024):

  * **T-077** — Payment list: rename columns; add Method & Entity. ([GitHub][1])
  * **T-078** — Payment detail: two-column summary layout (plus fields for identifier/ref #). ([GitHub][1])
  * **T-079** — Tests: formatters & truncate helpers (Jest), plus e2e spec scaffold. ([GitHub][1])

* Keep as **⏳ / 🧭** (not finished by P-024):

  * **T-074** — Sticky dialog footer: **set to ⏳** with note “Back button still attached to scroller; move into footer in P-025.”
  * **T-073** — Payment History “For Session(s)” max 5: **review current behavior**; if not implemented in the list view, leave as 🧭 with note “detail-only; list pending.”

* Leave other rows as-is unless clearly impacted by P-024 (e.g., T-075/T-076 remain 🧭).

> Keep the **emoji states** exactly as the file’s convention: ✅ done, ⏳ in progress, 🧭 planned.

### 3) Add new **P-025** follow-up tasks (new rows)

Add **new** tasks at the end of the “Tasks table — add/update” section using the next available IDs (compute `next = max(existing T-xxx) + 1`, then increment). Use these titles/notes:

```
| T-<next>   | StudentDialog Back button inside sticky footer                | ⏳ | Move Back into footer bar; ensure body has bottom padding |
| T-<next+1> | Payment Detail blink logic: only Remaining blinks             | ⏳ | Payment Amount static; Remaining uses blink class only |
| T-<next+2> | Payment Detail: restore session assignment list & flow        | ⏳ | Keep assignable list visible; selection updates Remaining; persist |
| T-<next+3> | Payment Detail inline editing (Method/Entity/Identifier/Ref) | ⏳ | Editable when empty; read-only after set; normalize identifier |
| T-<next+4> | Base Rate History: inline edit `effectiveDate` when empty     | ⏳ | Editable when missing; read-only after set |
```

### 4) Update “Prompts table — update”

* Ensure **P-024** remains **⏳** (PR #213 open) and links to `prompts/p-024.md`. ([GitHub][1])
* Add a new row for **P-025** with state **🧭** (planned) linking to `prompts/p-025.md` and the summary:

  > Fix sticky Back button; blink logic; session assignment; inline editing in Payment Detail & Base Rate History; remove `docs/task-log-vol-1.md`.

### 5) Preserve formatting, anchors, and headings

* Keep the existing **heading text, casing, and spacing** exactly (“Task Log”, “Latest change summary”, “Tasks table — add/update:”, “Prompts table — update:”).
* Do **not** reorder prior entries or change older statuses unless specified above.
* Add a tiny “Docs housekeeping” note if the file already references the stray log.

## Commit plan (squash allowed)

* `docs(task-log): add P-024 summary; mark T-077/078/079 ✅; queue P-025 tasks`
* `docs: remove docs/task-log-vol-1.md (canonical is docs/Task Log.md)`

## Acceptance

* `docs/task-log-vol-1.md` removed.
* `docs/Task Log.md` shows:

  * New P-024 bullets in **Latest change summary** (as above).
  * `T-077/078/079` = ✅ with brief notes.
  * New T rows for P-025 (five items) with correct next IDs and states.
  * **Prompts** table: P-024 = ⏳ linked; P-025 = 🧭 linked.
* No other sections altered.

**Do not** touch CI or any workflows.

---

**Save this prompt file as-is** at `prompts/tasklog-update-p-025.md`, then open the docs PR.

[1]: https://github.com/Artifact-of-the-Establisher/ArtifactoftheEstablisher/pull/213
