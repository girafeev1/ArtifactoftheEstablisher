# Agent Guidelines

All field labels must appear on their own line followed by a colon, with the corresponding value rendered on the next line. Field titles use the Newsreader font in Extra Light weight, return strings use Newsreader in Medium weight, and window titles use Cantata One.

All date displays in the web app should use MMM DD, YYYY format unless otherwise specified.

Section headings—including page-dividing titles such as "Personal Information", "Contact Information", "Payment Information", and "Billing Information"—and table headings use the Cantata One font. Table row content uses the Newsreader font at weight 500.

Any empty strings or missing data fields retrieved from Firestore should never cause the web app to become unresponsive. Empty string, `null`, or `undefined` values must render as **N/A**, and retrieval failures as **Error**. When a numeric or date value is unavailable simply display a dash (`-`).

Date fields must be validated before calling `.toLocaleDateString()` or similar methods. Invalid or empty values should be ignored, and the UI should show a placeholder rather than throwing errors or becoming stuck.

## Coaching Sessions Page Fonts

The coaching sessions dashboard (`pages/dashboard/businesses/coaching-sessions.tsx`) and its dialog tabs follow these typography rules:

- Floating window headers in the student dialog use **Cantata One**.
- Field labels across `OverviewTab`, `SessionsTab`, `BillingTab`, `PersonalTab`, and `SessionDetail` render in **Newsreader** at weight 200.
- Corresponding field values in those tabs render in **Newsreader** at weight 500.

## Debug Notes

The student dialog spinner persisted because Vercel served an outdated bundle that lacked the latest loading-flag resets. Redeploying and hard-refreshing the browser resolved the issue. Version logs (`=== StudentDialog loaded version 1.1 ===`) remain temporarily to confirm deployments.

Later we discovered the dialog could still hang when non-active tabs were not mounted. Conditional rendering prevented `PersonalTab`, `SessionsTab`, and `BillingTab` from firing their data-fetch effects, so the parent never cleared its loading flags. Always render all tabs and toggle visibility with CSS so their callbacks run and the spinner disappears.

Another hang arose when the initial spinner replaced the entire tab layout. With the tabs unrendered, their effects never ran and the loading flags stayed `true`. The dialog now overlays the spinner while keeping all tabs mounted so those callbacks always clear the flags.

Continuous reloads later surfaced when `OverviewTab` passed inline callbacks to the child tabs. Each render created new `onPersonal`, `onBilling`, and `onSummary` functions, triggering the children’s `useEffect` hooks repeatedly and re-fetching data in a loop. Memoizing these handlers with `useCallback` stabilised their references and stopped the dialog from constantly refreshing.

The most recent reload loop traced to defining the error boundary inside `OverviewTab`. Because the boundary class was re-created on every render, React unmounted and remounted the entire dialog tree, resetting all loading flags and re-triggering data fetches. Moving the boundary to the module scope keeps its identity stable and prevents the dialog from restarting after each render.

Floating windows later became immovable when a `onMouseDown` handler on the header stopped drag events from reaching `react-rnd`. Removing that handler restored independent window movement.

* All date displays in the web app use MMM DD, YYYY format.
* Section and table headings use Cantata One font; table row content uses Newsreader font at weight 500.
* All modals must provide a Back/Close navigation consistent with the Session Detail modal.
* Tab and sub-tab navigation lives in the dialog sidebar. The Billing parent tab shows the summary; its only child sub-tabs are Retainers and Payment History. Sub-tabs must not appear in top bars or popovers.
* Retainer status colors: green for active, red for expiring/expired, lightBlue for upcoming, and lightGreen when an expired retainer has a future one scheduled.
* Floating window titles use Nunito.
* Selected Payment Detail shows curated labels: Payment Amount, Payment Made On (date only), For session.
* Retainer end date is the day before the same day next month (end at 23:59:59).
