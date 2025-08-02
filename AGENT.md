# Agent Guidelines

Any empty strings or missing data fields retrieved from Firestore should never cause the web app to become unresponsive. Empty string values must render as **N/A**, missing values as **404/Not Found**, and retrieval failures as **Error**. When a numeric or date value is unavailable simply display a dash (`-`).

Date fields must be validated before calling `.toLocaleDateString()` or similar methods. Invalid or empty values should be ignored, and the UI should show a placeholder rather than throwing errors or becoming stuck.

## Debug Notes

The student dialog spinner persisted because Vercel served an outdated bundle that lacked the latest loading-flag resets. Redeploying and hard-refreshing the browser resolved the issue. Version logs (`=== StudentDialog loaded version 1.1 ===`) remain temporarily to confirm deployments.

Later we discovered the dialog could still hang when non-active tabs were not mounted. Conditional rendering prevented `PersonalTab`, `SessionsTab`, and `BillingTab` from firing their data-fetch effects, so the parent never cleared its loading flags. Always render all tabs and toggle visibility with CSS so their callbacks run and the spinner disappears.
