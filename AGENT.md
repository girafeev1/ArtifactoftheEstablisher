# Agent Guidelines

Any empty strings or missing data fields retrieved from Firestore should never cause the web app to become unresponsive. Empty string values must render as **N/A**, missing values as **404/Not Found**, and retrieval failures as **Error**. When a numeric or date value is unavailable simply display a dash (`-`).

Date fields must be validated before calling `.toLocaleDateString()` or similar methods. Invalid or empty values should be ignored, and the UI should show a placeholder rather than throwing errors or becoming stuck.
