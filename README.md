# ArtifactoftheEstablisher

This project is built with [Next.js](https://nextjs.org/) and TypeScript.

## Getting Started

### Prerequisites

- **Node.js** 18 or newer
- **npm** 9 or newer

### Installation

Install all dependencies:

```bash
npm install
```

### Running the Development Server

Start the application in development mode:

```bash
npm run dev
```

## Environment Variables

The app relies on several environment variables for Google APIs and Firebase configuration.  At a minimum you must provide credentials for a Google service account so the code can access Google services and Secret Manager:

```bash
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_CLIENT_EMAIL=service-account-email@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Additional secrets such as `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `PMS_REFERENCE_LOG_ID` and `NEXTAUTH_URL` are expected to be stored in Google Secret Manager for the project defined by `GOOGLE_PROJECT_ID`.

Firebase access also requires the following public values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

These variables can be placed in an `.env.local` file or exported in your shell before running the development server.

