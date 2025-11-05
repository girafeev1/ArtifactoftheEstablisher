# Environment Variables

This app centralizes environment configuration in a single canonical template file:

- `.env.example` (committed): master list of required variables with grouping and comments
- `.env.local` (git‑ignored): your local overrides for development
- Vercel Project → Settings → Environment Variables: production/preview values

The legacy files `.env.preview` and `.env.production` were removed to avoid ambiguity.

## How Next.js loads envs

- Local development: values from `.env.local` and `.env` (if present) are loaded automatically.
- Production on Vercel: values come from the Vercel dashboard. Avoid committing secrets.
- Client‑side variables must be prefixed with `NEXT_PUBLIC_`.

## Key groups (see `.env.example` for the full list)

- Client (browser):
  - `NEXT_PUBLIC_FIREBASE_*`
  - Optional Firestore routing IDs
- Server (Node‑only):
  - `FIREBASE_ADMIN_*` (service account)
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
  - `GOOGLE_*` (service account used by server‑side utilities)
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (NextAuth Discord provider)
  - Optional: `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET` (for additional OAuth providers)
  - App‑specific: `SCAN_SECRET`, etc.

## Discord OAuth

- Discord Developer Portal → OAuth2:
  - Add Redirects: `http://localhost:3000/api/auth/callback/discord`, `https://YOUR_DOMAIN/api/auth/callback/discord`
  - Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` accordingly

## CI/CD (Vercel)

- GitHub Actions workflow uses Vercel CLI and requires `VERCEL_TOKEN` as a GitHub Actions secret.
- Project/org IDs are read from `.vercel/project.json` at build time; no secret needed for those values.

## Local quickstart

1. Copy `.env.example` → `.env.local` and fill values (client keys are safe to commit elsewhere; secrets should remain local or in Vercel env).
2. Run `npm run dev`.

If any code path needs an additional variable, add it to `.env.example` under the appropriate section.
Deployer ping: 2025-11-05T12:42:16Z
