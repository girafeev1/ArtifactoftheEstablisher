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

Install dependencies if you haven't already. For a clean, reproducible setup
use **`npm ci`**; for local development you can also use **`npm install`**:

```bash
npm ci
```

## Running Tests

The repository includes a minimal Jest configuration. Run tests with:

```bash
npm test
```

## Configuring Secrets

Provide the following environment variables with your service account credentials.
If you deploy via **Firebase Functions**, set them using `firebase functions:secrets:set`:

```bash
firebase functions:secrets:set GOOGLE_PROJECT_ID
firebase functions:secrets:set GOOGLE_CLIENT_EMAIL
firebase functions:secrets:set GOOGLE_PRIVATE_KEY
```

Otherwise ensure they are available in the Cloud Run service configuration.
The Cloud Run service account must also have the
`roles/secretmanager.secretAccessor` role so the runtime can read your secrets.

Required variables:


- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Ensure these variables are available in your deployment environment so the
application can retrieve additional secrets from Secret Manager. You can provide
them as environment variables or bind them directly from Secret Manager when
deploying the service.

When deploying to **Vercel**, you must also define the NextAuth variables so
authentication can succeed:

- `NEXTAUTH_URL`
- `OAUTH_CLIENT_ID`
- `OAUTH_CLIENT_SECRET`
- `NEXTAUTH_SECRET`

## Development and Deployment

- Start a development server with **`npm run dev`**.
- Create a production build with **`npm run build`**.
- Deploy to Cloud Run manually:

  ```bash
  gcloud builds submit --tag gcr.io/aote-pms/next-app
  gcloud run deploy next-app \
    --image gcr.io/aote-pms/next-app \
    --region us-central1 --platform managed
  ```

- Pull requests automatically build and deploy a preview of the service to
  Cloud Run. The preview URL is posted to the PR.

- Deploy Firebase Hosting and functions with **`npx firebase deploy --only hosting,functions`** when using Cloud Functions. For Cloud Run, deploy Hosting with **`npx firebase deploy --only hosting`** after the service is updated.

- Check logs if the service seems unreachable:

  ```bash
  gcloud run services logs read next-app --region us-central1   # Cloud Run
firebase functions:log                                       # Cloud Functions
  ```

### Static Export

Set `NEXT_PUBLIC_API_BASE_URL` to your backend API and run:

```bash
npm run export
```

Static files will be created in the `out` directory for deployment to any static host.

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
