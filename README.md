# ArtifactoftheEstablisher

This project is a Next.js application used for managing projects with Google Sheets as the primary data store.

## Requirements
- Node.js 18 or newer
- npm 9 or newer

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   The application runs at `http://localhost:3000`.
3. To run a production build use:
   ```bash
   npm run build
   npm start
   ```
4. Execute the test suite with:
   ```bash
   npm test
   ```

## Configuration
Create a `.env` file in the project root providing the following variables:

```bash
GOOGLE_PROJECT_ID=<your-google-project-id>
GOOGLE_CLIENT_EMAIL=<service-account-email>
GOOGLE_PRIVATE_KEY=<service-account-private-key>
NEXT_PUBLIC_FIREBASE_API_KEY=<firebase-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<firebase-project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<firebase-messaging-sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<firebase-app-id>
```

These values are required to access Google APIs and Firebase services used by the application.
