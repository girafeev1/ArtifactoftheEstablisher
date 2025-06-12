# ArtifactoftheEstablisher

This project is a Next.js application that integrates with Google Workspace to
generate invoices and manage project data. The app now exports to static files
and relies on Firebase Functions for dynamic operations.

## Prerequisites

- **Node.js 20** – both the Next.js export and the Cloud Functions use Node 20,
  so local development should match.
- **Firebase CLI** – required for deploying hosting configuration and logging
  in (`npm run login:firebase`).
- **Google Cloud credentials** – a service account with access to Secret
  Manager, Cloud Run, and the required Google APIs.

Install dependencies if you haven't already:

```bash
npm install
```

## Running Tests

The repository includes a minimal Jest configuration. Run tests with:

```bash
npm test
```

## Development and Deployment

- Start a development server with **`npm run dev`**.
- Export static files with **`npm run export`**.
- Build the Cloud Functions and deploy both hosting and functions with
  **`npm run deploy`**.

## Roadmap

- **Invoice API** – located in `pages/api/invoices`, handles invoice creation
  and data retrieval from Google Sheets.
- **Google Sheets integration** – helper utilities in `lib/googleApi.ts` and
  `lib/googleSheetUtils.ts` provide authenticated access to Drive and Sheets.
- **Authentication** – implemented via NextAuth in
  `pages/api/auth/[...nextauth].ts`, using credentials stored in Secret
  Manager.

## Changelog
- Removed leftover `.DS_Store` files and updated `.gitignore` to exclude them.
