# Client Accounts Refine UI Runtime Notes

We chased the 500 errors on `/dashboard/new-ui/client-accounts` back to the server bundle pulling Ant Design's browser-only modules.
The fix was to keep the SSR guard but dynamically import the Refine shell so those heavy packages never touch the server render path.

When touching this page again, double check the following before pushing:

- `pages/dashboard/new-ui/client-accounts.tsx` must keep the dynamic `ssr: false` import.
- All Ant Design styling should live in client components (see `NewUIClientAccountsApp`).
- Run `CI=1 npm run build` locally so we catch any regressions before Vercel does.

If a future build throws a similar 500, confirm these guardrails first. They eliminated the crash this time.
