# ArtifactoftheEstablisher

This project is a Next.js application that integrates with Google Workspace to
generate invoices and manage project data. It exports static files and relies on
Firebase Hosting with Cloud Functions for dynamic API routes.

**Note:** The project is moving to a completely serverless architecture. Future
development happens on the `serverless` branch rather than `main`.

## Prerequisites

- **Node.js 20** – use Node 20 locally to match the Firebase Functions runtime.
- **Firebase CLI** – required for deploying hosting configuration and logging
  in (`npm run login:firebase`).
- **Google Cloud credentials** – a service account with access to Secret
  Manager and the required Google APIs.

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
- Generate static output with **`npm run export`**.
- Deploy Hosting and Functions together with **`npm run deploy`**.

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
