# Data Access Map

This document maps each major page to the Firestore documents/sub‑collections it reads, how the data is fetched, and how the UI presents it.

## /dashboard/new-ui/projects (Projects List)
- Data source
  - Firestore projects (preferred nested layout): `projects/{year}/projects/{projectId}`
  - Firestore projects (legacy fallback): `{year}/{projectId}`
  - Per‑project invoices (subcollection): `{projectDoc}/invoice`
- How it’s fetched
  - Page uses a Refine data provider that calls `GET /api/projects` with optional `year`, `subsidiary`, `metaOnly` params.
  - API `pages/api/projects/index.ts` uses `lib/projectsDatabase.fetchProjectsFromDatabase()` to read project docs (nested first, legacy fallback). For non‑`metaOnly` requests, it also calls `lib/projectInvoices.fetchInvoicesForProject(year, projectId)` to aggregate invoice summary per project.
- Fields read/use
  - From project doc: `projectNumber`, `projectTitle`, `presenterWorkType`, `projectNature`, `projectDate`, `clientCompany`, `subsidiary`, `paid` (legacy), `amount` (legacy), etc.
  - From invoices subcollection (`invoice`): number of invoices, cleared vs outstanding counts, aggregated totals; last paid date and paidTo if present.
- How UI shows it
  - AntD `Table` columns show Project No., Project info (type/title/nature), Amount (aggregated totals when available), Status chip (Due/Partially Cleared/All Clear), Client, Pickup Date, Subsidiary.
  - Filters: year (required), subsidiary (optional), search token; client‑side sorting (number/title/date/amount/paid/subsidiary).

## /dashboard/new-ui/projects/show/[projectId] (Project Detail)
- Data source
  - Project doc: `projects/{year}/projects/{projectId}` (fallback `{year}/{projectId}`)
  - Invoices subcollection: `{projectDoc}/invoice`
  - Client directory (for company match): separate Firestore DB `epl-directory`, collection `clients` (see Client Accounts page).
- How it’s fetched
  - Page calls `GET /api/projects/by-id/:projectId`.
  - API resolves project by `id` or `projectNumber` via `fetchProjectsFromDatabase()`, then fetches invoices via `fetchInvoicesForProject(year, projectId)`. For `clientCompany`, it loads `fetchClientsDirectory()` and matches by company name or document id.
- Fields read/use
  - Project doc: same as list; used to show header summary and default invoice number fallback.
  - Invoice docs in `invoice`: read `baseInvoiceNumber/invoiceNumber`, client block fields (`companyName`, `addressLine*`, `region`, `representative`), line items (`itemNTitle/FeeType/UnitPrice/Quantity/Discount`), `paymentStatus`, `paidTo`, `paidOn`.
  - Client directory record (if matched): enriches client block defaults in header.
- How UI shows it
  - Header: project number/date, project title/nature/type; status steps; payment chip (color by status); client block with company/address/representative.
  - Invoices list: per invoice number/status/amount; detail rows for items; CTA to create invoice if none exists.
  - Editing actions: PATCH/POST to `/api/projects/by-id/:id/invoices` to create/update invoice docs under `{projectDoc}/invoice`; logs changes in `{invoiceDoc}/updateLogs`.

## /dashboard/new-ui/client-accounts (Client Accounts)
- Data source
  - Firestore DB `epl-directory` (via `getFirestoreForDatabase('epl-directory')`).
  - Collection: `clients` — client directory records.
  - Subcollection per client: `updateLogs` — change audit entries.
  - Cross‑reference (read‑only): projects DB to compute overdue flags (via `fetchProjectsFromDatabase`) where `paid === false`.
- How it’s fetched
  - Component calls `lib/clientDirectory.fetchClientsDirectory()` which runs `getDocs(collection(directoryDb, 'clients'))` and derives overdue set from projects.
- Fields read/use
  - Client doc: `companyName`, `title`, `name`, `nameAddressed`, `emailAddress`, `phone`, `addressLine1..5`, `region`, `createdAt`.
  - Overdue state: computed by matching `clientCompany` of unpaid projects against client names/ids.
- How UI shows it
  - Refine/AntD page renders a gallery/list of client accounts with contact and address details; can be used as a picker/enricher for invoices (in Project Detail).

## API endpoints and their Firestore access
- GET `/api/projects`
  - Reads: all project docs across years (nested `projects/{year}/projects/*`, fallback `{year}/*`).
  - For lists (non‑metaOnly), also reads subcollection `invoice` for each project to compute totals/outstanding and latest paid info.
- POST `/api/projects/:year`
  - Writes: create a new project doc (nested preferred) with initial fields; adds `{projectDoc}/updateLogs` entry `created`.
- GET `/api/projects/by-id/:projectId`
  - Reads: all projects to resolve `id`/`projectNumber` match; reads that project’s `invoice` subcollection; optionally fetches clients from `epl-directory/clients` for match.
- POST `/api/projects/by-id/:projectId/invoices`
  - Writes: creates a new invoice doc under `{projectDoc}/invoice` with normalized client/items/status fields; logs diffs under `{invoiceDoc}/updateLogs`.
- PATCH `/api/projects/by-id/:projectId/invoices`
  - Writes: updates an invoice doc under `{projectDoc}/invoice` (by `collectionId` + `invoiceNumber`); logs diffs under `{invoiceDoc}/updateLogs`.

## Legacy/other data reads (still present in repo)
- Sessions and Students (legacy MUI screens/tools)
  - Collections: `Sessions` and subcollection `appointmentHistory`; `Students`.
  - Used by utilities like `lib/sessions.ts`, `lib/sessionStats.ts` for stats/updates.
- Bank Accounts Directory
  - Collection: `bankAccount` within `epl-directory`; subcollections under each bank for account types; loaded by `lib/bankAccountsDirectory.ts` and used to resolve `paidTo` identifiers in invoices.

## Presentation mapping (quick reference)
- Projects List
  - Aggregated invoice totals → Amount column
  - Cleared vs outstanding counts → Status chip (Due/Partially Cleared/All Clear)
  - Client from first invoice (if any) → Client column
  - Year/Subsidiary filters → query to `/api/projects`
- Project Detail
  - Project + first invoice → header defaults (client, numbers)
  - `invoice` docs → invoice table (items, totals, status); `paidTo` resolves via bank directory util; `paidOn` displayed as date
  - Writes via POST/PATCH `/api/projects/by-id/:id/invoices` update Firestore and refresh page state
- Client Accounts
  - `epl-directory/clients` docs → client cards/rows
  - Overdue highlight derived from projects where `paid === false`

---

Notes
- Projects DB uses two shapes; new nested path is preferred and attempted first, with legacy path as a read/write fallback.
- Invoices are standardized under a unified `invoice` subcollection; legacy `invoice-*`/`Invoice` collections are detected but new writes go to `invoice`.
