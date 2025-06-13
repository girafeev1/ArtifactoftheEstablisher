# ArtifactoftheEstablisher

This project is a Next.js application that integrates with Google Workspace to
generate invoices and manage project data. The frontend is exported as a static
site served from Firebase Hosting while backend API routes run on Firebase
Functions.

## Prerequisites

- **Node.js 20** – the Firebase Functions runtime uses Node 20, so local
  development should match.
- **Firebase CLI** – required for deploying hosting configuration and logging
  in (`npm run login:firebase`).
- **Google Cloud credentials** – a service account with access to Secret
  Manager, Cloud Functions, and the required Google APIs.

### Environment Variables

Create a `.env` file using `.env.example` as a template and provide the
following values:

```
GOOGLE_PROJECT_ID=<your-gcp-project>
GOOGLE_CLIENT_EMAIL=<service-account-email>
GOOGLE_PRIVATE_KEY=<service-account-private-key>
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<firebase-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<firebase-msg-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<firebase-app-id>
```

Secrets like `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, and `NEXTAUTH_SECRET`
should be stored in Google Secret Manager for production.

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
- Create a production build with **`npm run build`**. The `output: 'export'` setting generates static HTML in the `out` directory so no container is needed for the frontend.
- Deploy the backend logic to Firebase Functions with **`npm run deploy:functions`**.
- Deploy the static site to Firebase Hosting with **`npm run deploy:hosting`** after the API is updated.

After deployment, browse using the Firebase Hosting URL (e.g. `https://<project>.web.app`).
Accessing the Cloud Functions endpoint directly will show a 404 page because it only serves API routes.

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
