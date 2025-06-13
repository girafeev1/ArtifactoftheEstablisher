# ArtifactoftheEstablisher

This project is a Next.js application that integrates with Google Workspace to
generate invoices and manage project data. It is designed to run on
Firebase Hosting backed by Cloud Run.

## Prerequisites

- **Node.js 20** – the Dockerfile and Cloud Run build use Node 20, so local
  development should match.
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
- Create a production build with **`npm run build`**.
- Deploy the container to Cloud Run with **`npm run deploy:run`**. This command
  uses `gcloud` to build the Docker image defined in the `Dockerfile` and deploy
  it.
- Deploy Firebase Hosting rewrites with **`npm run deploy:hosting`** after Cloud
  Run is updated.

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
