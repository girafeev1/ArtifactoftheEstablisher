Prompt — Task Log update for P-021
•Append the following to the top of “Tasks table — add/update”:

| ID    | Title                                                                    | State | Notes / Files |
|-------|--------------------------------------------------------------------------|-------|---------------|
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

•In Prompts table — update, append:

| P-021 | Loading UX, due parity, vouchers default, payment blink, base-rate UX/edit, min-width v3, calendar scan reliability | 🧭 | See prompts/P-021.md |

•In Latest change summary, add one bullet:

- Queue P-021: loading UX cleanup, due parity, vouchers default, payment blink, base-rate history editing, min-width v3, calendar scan fixes.

(Keep the file append-only per our CI guard.)
