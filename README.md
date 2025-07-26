# ArtifactoftheEstablisher

## Deployment Notes

The project expects several environment variables to be present when building or running locally:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `GOOGLE_PROJECT_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- other secrets such as `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` which are typically stored in Google Secret Manager.

GitHub actions found in `.github/workflows` deploy the application to Firebase Hosting and Google Cloud Run. These workflows can be disabled if Vercel is used as the primary deployment target.
 
