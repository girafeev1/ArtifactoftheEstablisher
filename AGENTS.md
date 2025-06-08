# AGENT Guidelines

This repository uses JavaScript/TypeScript with Next.js and Firebase.

* **Path annotations**: Every `.ts`, `.tsx`, `.js`, or `.jsx` file must begin with a single-line comment containing its relative file path from the repository root.
* **Testing**: Run `npm test` before committing. Tests may fail if `jest` is missing, but the command must still be executed.
* **Firestore**: Subsidiary, bank account, and client data should be fetched from Firestore collections (`Subsidiaries`, `BankAccounts`, `Clients`) rather than Google Sheets. Helpers live in `lib/`.
* **Authentication**: The app signs users in with Google OAuth and then into Firebase using the resulting token. Firestore security rules rely on the authenticated user's email.
* **Server credentials**: For server-side Firestore access, set the environment variables `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` with a service account.

