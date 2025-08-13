# Development Guidelines

## Principles
- **Minimal DB caching**: Store only authoritative or user-entered data in Firestore. Derived values stay in code using React Query and compute functions.
- **Single source of truth**: Billing and session values come from `lib/billing/compute.ts` via `useBilling(abbr, account)`. Lists in different tabs must display the same computed data.
- **Live refresh only what changed**: After mutations, patch the relevant React Query cache and write a fresh `billingSummary` from the patched cache.
- **Inline spinners, no overlays**: Each field handles its own loading state with small spinners. Do not block entire dialogs.

## Mutation Pattern
```ts
await firestoreWrite()
patchCache()
await writeSummaryFromCache(qc, abbr, account)
// optional: debounced invalidateBilling(abbr, account, qc)
```
Example from assigning sessions:
```ts
patchBillingAssignedSessions(qc, abbr, account, selected)
await writeSummaryFromCache(qc, abbr, account)
```

## Listener Pattern
- Subscribe to the specific document being edited with `onSnapshot` when a modal opens.
- Unsubscribe on close.
- Do not add broad collection listeners.

Example:
```ts
useEffect(() => {
  const unsub = onSnapshot(doc(db, PATHS.payments(abbr), payment.id), snap => {
    const data = snap.data()
    if (data) {
      setRemaining(data.remainingAmount ?? Number(data.amount) ?? 0)
      payment.assignedSessions = data.assignedSessions
    }
  })
  return () => unsub()
}, [abbr, payment.id])
```

## Single Source of Truth
Always use `useBilling(abbr, account)` for any session or billing display. Patch its cache rather than keeping duplicate state.

## Do Not Persist Derived Data
Only `billingSummary` (balanceDue, voucherBalance, updatedAt) is cached in Firestore. No other derived collections or summaries should be written.

## Student Summary Cache
Selected session fields (`jointDate`, `lastSession`, `totalSessionsExCancelled`, `cancelledCount`) are cached under `Students/{abbr}.cached`.
Use:

```ts
const summary = await computeStudentSummary(abbr, account)
await writeStudentSummary(abbr, summary)
```

Run this after session-affecting mutations and on `SessionsTab` mount so card views stay in sync.

