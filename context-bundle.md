# PR #251 — Diff Summary

- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
- **Head (source)**: `f7850e302284d9f84e1c837ff979a538ccf9b14f`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
M	components/StudentDialog/PaymentHistory.test.tsx
M	components/StudentDialog/PaymentModal.test.tsx
A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
M	context-bundle.md
M	cypress/e2e/add_payment_cascade.cy.tsx
A	docs/context/PR-251.md
M	jest.config.cjs
M	lib/erlDirectory.test.ts
M	pages/dashboard/businesses/projects-database/[groupId].tsx
```

## Stats

```txt
 .../businesses/coaching-sessions.test.tsx          |   35 +-
 components/StudentDialog/PaymentHistory.test.tsx   |    8 +-
 components/StudentDialog/PaymentModal.test.tsx     |   21 +-
 .../projectdialog/ProjectDatabaseDetailDialog.tsx  |  113 ++
 context-bundle.md                                  | 1232 ++++++++------------
 cypress/e2e/add_payment_cascade.cy.tsx             |   70 +-
 docs/context/PR-251.md                             |  558 +++++++++
 jest.config.cjs                                    |    2 +
 lib/erlDirectory.test.ts                           |    4 +-
 .../businesses/projects-database/[groupId].tsx     |   29 +-
 10 files changed, 1269 insertions(+), 803 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
index 75ef22c..8ec8b9e 100644
--- a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+++ b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
@@ -19,15 +19,37 @@ jest.mock('firebase/firestore', () => ({
 }))
 jest.mock('../../../../lib/firebase', () => ({ db: {} }))
 jest.mock('../../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
-jest.mock('../../../../components/StudentDialog/OverviewTab', () => () => null)
-jest.mock('../../../../components/StudentDialog/SessionDetail', () => () => null)
-jest.mock('../../../../components/StudentDialog/FloatingWindow', () => ({ children }: any) => (
-  <div>{children}</div>
-))
+jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
+  function OverviewTabMock() {
+    return null
+  }
+  OverviewTabMock.displayName = 'OverviewTabMock'
+  return OverviewTabMock
+})
+jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
+  function SessionDetailMock() {
+    return null
+  }
+  SessionDetailMock.displayName = 'SessionDetailMock'
+  return SessionDetailMock
+})
+jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
+  function FloatingWindowMock({ children }: any) {
+    return <div>{children}</div>
+  }
+  FloatingWindowMock.displayName = 'FloatingWindowMock'
+  return FloatingWindowMock
+})
 jest.mock('../../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
 jest.mock('../../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
 jest.mock('../../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
-jest.mock('../../../../components/LoadingDash', () => () => null)
+jest.mock('../../../../components/LoadingDash', () => {
+  function LoadingDashMock() {
+    return null
+  }
+  LoadingDashMock.displayName = 'LoadingDashMock'
+  return LoadingDashMock
+})
 jest.mock('../../../../lib/scanLogs', () => ({
   readScanLogs: jest.fn(async () => null),
   writeScanLog: jest.fn(),
@@ -51,4 +73,3 @@ describe('coaching sessions card view', () => {
     expect(screen.queryByTestId('pprompt-badge')).toBeNull()
   })
 })
-
diff --git a/components/StudentDialog/PaymentHistory.test.tsx b/components/StudentDialog/PaymentHistory.test.tsx
index e850e7a..e2560e9 100644
--- a/components/StudentDialog/PaymentHistory.test.tsx
+++ b/components/StudentDialog/PaymentHistory.test.tsx
@@ -6,7 +6,13 @@ import '@testing-library/jest-dom'
 import { render, screen, waitFor } from '@testing-library/react'
 import PaymentHistory from './PaymentHistory'
 
-jest.mock('./PaymentModal', () => () => <div />)
+jest.mock('./PaymentModal', () => {
+  function PaymentModalMock() {
+    return <div />
+  }
+  PaymentModalMock.displayName = 'PaymentModalMock'
+  return PaymentModalMock
+})
 
 jest.mock('firebase/firestore', () => ({
   collection: jest.fn(),
diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
index 3d4b44f..ac1f927 100644
--- a/components/StudentDialog/PaymentModal.test.tsx
+++ b/components/StudentDialog/PaymentModal.test.tsx
@@ -6,6 +6,8 @@ import '@testing-library/jest-dom'
 import { render, fireEvent, waitFor, screen } from '@testing-library/react'
 import PaymentModal from './PaymentModal'
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
+import * as firestore from 'firebase/firestore'
+import * as erlDirectory from '../../lib/erlDirectory'
 
 jest.mock('../../lib/erlDirectory', () => ({
   listBanks: jest
@@ -46,6 +48,9 @@ jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))
 
 const noop = () => {}
 
+const mockedErlDirectory = jest.mocked(erlDirectory, true)
+const mockedFirestore = jest.mocked(firestore, true)
+
 describe('PaymentModal ERL cascade', () => {
   test('populates banks/accounts and submits identifier with audit fields', async () => {
     const qc = new QueryClient()
@@ -65,14 +70,10 @@ describe('PaymentModal ERL cascade', () => {
     const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
     fireEvent.change(accountSelect, { target: { value: 'a1' } })
     await waitFor(() =>
-      expect(
-        require('../../lib/erlDirectory').buildAccountLabel,
-      ).toHaveBeenCalled(),
+      expect(mockedErlDirectory.buildAccountLabel).toHaveBeenCalled(),
     )
-    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
-    expect(
-      require('../../lib/erlDirectory').listAccounts,
-    ).toHaveBeenCalledWith({
+    expect(mockedErlDirectory.listBanks).toHaveBeenCalled()
+    expect(mockedErlDirectory.listAccounts).toHaveBeenCalledWith({
       bankCode: '001',
       bankName: 'Bank',
       rawCodeSegment: '(001)',
@@ -83,10 +84,10 @@ describe('PaymentModal ERL cascade', () => {
     fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
     fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })
 
-    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
+    expect(mockedFirestore.addDoc).not.toHaveBeenCalled()
     fireEvent.click(getByTestId('submit-payment'))
-    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
-    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
+    await waitFor(() => expect(mockedFirestore.addDoc).toHaveBeenCalled())
+    const data = (mockedFirestore.addDoc as jest.Mock).mock.calls[0][1]
     expect(data.identifier).toBe('a1')
     expect(data.bankCode).toBeUndefined()
     expect(data.accountDocId).toBeUndefined()
diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
new file mode 100644
index 0000000..3bc18b4
--- /dev/null
+++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
@@ -0,0 +1,113 @@
+// components/projectdialog/ProjectDatabaseDetailDialog.tsx
+
+import React from 'react'
+import {
+  Box,
+  Button,
+  Checkbox,
+  Dialog,
+  DialogActions,
+  DialogContent,
+  Divider,
+  Typography,
+} from '@mui/material'
+import CloseIcon from '@mui/icons-material/Close'
+import CheckIcon from '@mui/icons-material/Check'
+
+import type { ProjectRecord } from '../../lib/projectsDatabase'
+
+interface ProjectDatabaseDetailDialogProps {
+  open: boolean
+  onClose: () => void
+  project: ProjectRecord | null
+}
+
+const textOrNA = (value: string | null | undefined) =>
+  value && value.trim().length > 0 ? value : 'N/A'
+
+const formatAmount = (value: number | null | undefined) => {
+  if (typeof value !== 'number' || Number.isNaN(value)) {
+    return 'HK$0'
+  }
+  return `HK$${value.toLocaleString('en-US', {
+    minimumFractionDigits: 0,
+    maximumFractionDigits: 2,
+  })}`
+}
+
+export default function ProjectDatabaseDetailDialog({
+  open,
+  onClose,
+  project,
+}: ProjectDatabaseDetailDialogProps) {
+  if (!project) {
+    return null
+  }
+
+  const paid = project.paid === true
+  const paidOnText = paid ? project.onDateDisplay || '-' : undefined
+
+  return (
+    <Dialog open={open} onClose={onClose} fullWidth>
+      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
+        <Typography variant="subtitle1">
+          {textOrNA(project.projectNumber)}
+        </Typography>
+        <Typography variant="subtitle1">
+          {textOrNA(project.clientCompany)}
+        </Typography>
+        <Typography variant="h4">{textOrNA(project.projectTitle)}</Typography>
+        <Typography variant="body2"> - {textOrNA(project.projectNature)}</Typography>
+        <Divider />
+        <Typography variant="body2">
+          <strong>Project Pickup Date:</strong>{' '}
+          {project.projectDateDisplay ?? 'Not set'}
+        </Typography>
+        <Typography variant="body2">
+          <strong>Amount:</strong> {formatAmount(project.amount)}
+        </Typography>
+        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
+          <strong>Paid:</strong>
+          <Checkbox
+            checked={paid}
+            icon={<CloseIcon />}
+            checkedIcon={<CheckIcon />}
+            disableRipple
+            sx={{ p: 0 }}
+            disabled
+          />
+        </Typography>
+        {paidOnText && (
+          <Typography variant="body2">
+            <strong>Paid On:</strong> {paidOnText}
+          </Typography>
+        )}
+        {project.paidTo && (
+          <Typography variant="body2">
+            <strong>Pay to:</strong> {textOrNA(project.paidTo)}
+          </Typography>
+        )}
+        {project.presenterWorkType && (
+          <Typography variant="body2">
+            <strong>Presenter Work Type:</strong> {textOrNA(project.presenterWorkType)}
+          </Typography>
+        )}
+        {project.subsidiary && (
+          <Typography variant="body2">
+            <strong>Subsidiary:</strong> {textOrNA(project.subsidiary)}
+          </Typography>
+        )}
+        <Divider />
+        <Box sx={{ mt: 1 }}>
+          <Typography variant="body2">
+            <strong>Invoice:</strong> {textOrNA(project.invoice)}
+          </Typography>
+        </Box>
+      </DialogContent>
+      <DialogActions>
+        <Button onClick={onClose}>Close</Button>
+      </DialogActions>
+    </Dialog>
+  )
+}
+
diff --git a/context-bundle.md b/context-bundle.md
index 8756e36..81ef4ef 100644
--- a/context-bundle.md
+++ b/context-bundle.md
@@ -1,810 +1,558 @@
-# PR #249 — Diff Summary
+# PR #251 — Diff Summary
 
-- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
-- **Head (source)**: `8073fcbf79fae18bc77fc3ba6aff45ef1c2659b1`
+- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
+- **Head (source)**: `c08d615458e64086f577db3d49f2e1a3b84f2195`
 - **Repo**: `girafeev1/ArtifactoftheEstablisher`
 
 ## Changed Files
 
 ```txt
-M	components/SidebarLayout.tsx
-M	lib/firebase.ts
-A	lib/projectsDatabase.ts
-M	pages/dashboard/businesses/index.tsx
-A	pages/dashboard/businesses/projects-database/[groupId].tsx
-A	pages/dashboard/businesses/projects-database/index.tsx
+M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+M	components/StudentDialog/PaymentHistory.test.tsx
+M	components/StudentDialog/PaymentModal.test.tsx
+A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
+M	cypress/e2e/add_payment_cascade.cy.tsx
+A	docs/context/PR-251.md
+M	jest.config.cjs
+M	lib/erlDirectory.test.ts
+M	pages/dashboard/businesses/projects-database/[groupId].tsx
 ```
 
 ## Stats
 
 ```txt
- components/SidebarLayout.tsx                       |   7 +
- lib/firebase.ts                                    |  12 +-
- lib/projectsDatabase.ts                            | 220 ++++++++++++
- pages/dashboard/businesses/index.tsx               |  43 +--
- .../businesses/projects-database/[groupId].tsx     | 400 +++++++++++++++++++++
- .../businesses/projects-database/index.tsx         |  14 +
- 6 files changed, 666 insertions(+), 30 deletions(-)
+ .../businesses/coaching-sessions.test.tsx          |  35 +++++--
+ components/StudentDialog/PaymentHistory.test.tsx   |   8 +-
+ components/StudentDialog/PaymentModal.test.tsx     |  21 ++--
+ .../projectdialog/ProjectDatabaseDetailDialog.tsx  | 113 +++++++++++++++++++++
+ cypress/e2e/add_payment_cascade.cy.tsx             |  69 ++++++-------
+ docs/context/PR-251.md                             |   1 +
+ jest.config.cjs                                    |   2 +
+ lib/erlDirectory.test.ts                           |   4 +-
+ .../businesses/projects-database/[groupId].tsx     |  29 +++++-
+ 9 files changed, 221 insertions(+), 61 deletions(-)
 ```
 
 ## Unified Diff (truncated to first 4000 lines)
 
 ```diff
-diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
-index 9b9a192..3ba283a 100644
---- a/components/SidebarLayout.tsx
-+++ b/components/SidebarLayout.tsx
-@@ -62,6 +62,13 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
-                 </Button>
-               </Link>
-             </MenuItem>
-+            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
-+              <Link href="/dashboard/businesses/projects-database/select" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
-+                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
-+                  Projects (Database)
-+                </Button>
-+              </Link>
-+            </MenuItem>
-             <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
-               <Link href="/dashboard/businesses/coaching-sessions" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
-                 <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
-diff --git a/lib/firebase.ts b/lib/firebase.ts
-index 5fe04d2..35c04e9 100644
---- a/lib/firebase.ts
-+++ b/lib/firebase.ts
-@@ -17,13 +17,19 @@ Object.entries(firebaseConfig).forEach(([k, v]) => {
-   console.log(`   ${k}: ${v}`)
- })
- 
--const databaseId = 'mel-sessions'
--console.log('📚 Firestore database ID:', databaseId)
-+const DEFAULT_DATABASE_ID = 'mel-sessions'
-+const PROJECTS_DATABASE_ID = 'epl-projects'
-+
-+console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
-+console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
- 
- export const app = !getApps().length
-   ? initializeApp(firebaseConfig)
-   : getApp()
--export const db = getFirestore(app, databaseId)
-+export const db = getFirestore(app, DEFAULT_DATABASE_ID)
-+export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
-+export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
-+export const getFirestoreForDatabase = (databaseId: string) => getFirestore(app, databaseId)
- // after you create/export `db`...
- if (typeof window !== 'undefined') {
-   // @ts-expect-error attach for debugging
-diff --git a/lib/projectsDatabase.ts b/lib/projectsDatabase.ts
-new file mode 100644
-index 0000000..4c054ce
---- /dev/null
-+++ b/lib/projectsDatabase.ts
-@@ -0,0 +1,220 @@
-+// lib/projectsDatabase.ts
-+
-+import { collection, getDocs, Timestamp } from 'firebase/firestore'
-+
-+import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from './firebase'
-+
-+const YEAR_ID_PATTERN = /^\d{4}$/
-+const FALLBACK_YEAR_IDS = ['2025', '2024', '2023', '2022', '2021']
-+
-+interface ListCollectionIdsResponse {
-+  collectionIds?: string[]
-+  error?: { message?: string }
-+}
-+
-+export interface ProjectRecord {
-+  id: string
-+  year: string
-+  amount: number | null
-+  clientCompany: string | null
-+  invoice: string | null
-+  onDateDisplay: string | null
-+  onDateIso: string | null
-+  paid: boolean | null
-+  paidTo: string | null
-+  presenterWorkType: string | null
-+  projectDateDisplay: string | null
-+  projectDateIso: string | null
-+  projectNature: string | null
-+  projectNumber: string
-+  projectTitle: string | null
-+  subsidiary: string | null
-+}
-+
-+export interface ProjectsDatabaseResult {
-+  projects: ProjectRecord[]
-+  years: string[]
-+}
-+
-+const toTimestamp = (value: unknown): Timestamp | null => {
-+  if (value instanceof Timestamp) {
-+    return value
-+  }
-+  if (
-+    value &&
-+    typeof value === 'object' &&
-+    'seconds' in value &&
-+    'nanoseconds' in value &&
-+    typeof (value as any).seconds === 'number' &&
-+    typeof (value as any).nanoseconds === 'number'
-+  ) {
-+    return new Timestamp((value as any).seconds, (value as any).nanoseconds)
-+  }
-+  return null
-+}
-+
-+const toDate = (value: unknown): Date | null => {
-+  const ts = toTimestamp(value)
-+  if (ts) {
-+    const date = ts.toDate()
-+    return isNaN(date.getTime()) ? null : date
-+  }
-+  if (typeof value === 'string' || value instanceof String) {
-+    const parsed = new Date(value as string)
-+    return isNaN(parsed.getTime()) ? null : parsed
-+  }
-+  if (value instanceof Date) {
-+    return isNaN(value.getTime()) ? null : value
-+  }
-+  return null
-+}
-+
-+const formatDisplayDate = (value: unknown): string | null => {
-+  const date = toDate(value)
-+  if (!date) return null
-+  return date.toLocaleDateString('en-US', {
-+    month: 'short',
-+    day: '2-digit',
-+    year: 'numeric',
-+  })
-+}
-+
-+const toIsoDate = (value: unknown): string | null => {
-+  const date = toDate(value)
-+  if (!date) return null
-+  return date.toISOString()
-+}
-+
-+const toStringValue = (value: unknown): string | null => {
-+  if (typeof value === 'string') {
-+    return value.trim() || null
-+  }
-+  if (value instanceof String) {
-+    const trimmed = value.toString().trim()
-+    return trimmed || null
-+  }
-+  return null
-+}
-+
-+const toNumberValue = (value: unknown): number | null => {
-+  if (typeof value === 'number' && !Number.isNaN(value)) {
-+    return value
-+  }
-+  if (typeof value === 'string') {
-+    const parsed = Number(value)
-+    return Number.isNaN(parsed) ? null : parsed
+diff --git a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+index 75ef22c..8ec8b9e 100644
+--- a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
++++ b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+@@ -19,15 +19,37 @@ jest.mock('firebase/firestore', () => ({
+ }))
+ jest.mock('../../../../lib/firebase', () => ({ db: {} }))
+ jest.mock('../../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
+-jest.mock('../../../../components/StudentDialog/OverviewTab', () => () => null)
+-jest.mock('../../../../components/StudentDialog/SessionDetail', () => () => null)
+-jest.mock('../../../../components/StudentDialog/FloatingWindow', () => ({ children }: any) => (
+-  <div>{children}</div>
+-))
++jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
++  function OverviewTabMock() {
++    return null
 +  }
-+  return null
-+}
-+
-+const toBooleanValue = (value: unknown): boolean | null => {
-+  if (typeof value === 'boolean') {
-+    return value
++  OverviewTabMock.displayName = 'OverviewTabMock'
++  return OverviewTabMock
++})
++jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
++  function SessionDetailMock() {
++    return null
 +  }
-+  return null
-+}
-+
-+const uniqueSortedYears = (values: Iterable<string>) =>
-+  Array.from(new Set(values)).sort((a, b) =>
-+    b.localeCompare(a, undefined, { numeric: true })
-+  )
-+
-+const listYearCollections = async (): Promise<string[]> => {
-+  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
-+  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
-+
-+  if (!apiKey || !projectId) {
-+    console.warn('[projectsDatabase] Missing Firebase configuration, falling back to defaults')
-+    return [...FALLBACK_YEAR_IDS]
++  SessionDetailMock.displayName = 'SessionDetailMock'
++  return SessionDetailMock
++})
++jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
++  function FloatingWindowMock({ children }: any) {
++    return <div>{children}</div>
 +  }
-+
-+  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents:listCollectionIds?key=${apiKey}`
-+
-+  try {
-+    const response = await fetch(url, {
-+      method: 'POST',
-+      headers: { 'Content-Type': 'application/json' },
-+      body: JSON.stringify({
-+        parent: `projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents`,
-+        pageSize: 200,
-+      }),
-+    })
-+
-+    if (!response.ok) {
-+      console.warn('[projectsDatabase] Failed to list collection IDs:', response.status, response.statusText)
-+      return [...FALLBACK_YEAR_IDS]
-+    }
-+
-+    const json = (await response.json()) as ListCollectionIdsResponse
-+    if (json.error) {
-+      console.warn('[projectsDatabase] Firestore responded with error:', json.error.message)
-+      return [...FALLBACK_YEAR_IDS]
-+    }
-+
-+    const ids = json.collectionIds?.filter((id) => YEAR_ID_PATTERN.test(id)) ?? []
-+    if (ids.length === 0) {
-+      console.warn('[projectsDatabase] No year collections found, falling back to defaults')
-+      return [...FALLBACK_YEAR_IDS]
-+    }
-+    return uniqueSortedYears(ids)
-+  } catch (err) {
-+    console.warn('[projectsDatabase] listYearCollections failed:', err)
-+    return [...FALLBACK_YEAR_IDS]
++  FloatingWindowMock.displayName = 'FloatingWindowMock'
++  return FloatingWindowMock
++})
+ jest.mock('../../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
+ jest.mock('../../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
+ jest.mock('../../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
+-jest.mock('../../../../components/LoadingDash', () => () => null)
++jest.mock('../../../../components/LoadingDash', () => {
++  function LoadingDashMock() {
++    return null
 +  }
-+}
-+
-+export const fetchProjectsFromDatabase = async (): Promise<ProjectsDatabaseResult> => {
-+  const yearIds = await listYearCollections()
-+  const projects: ProjectRecord[] = []
-+  const yearsWithData = new Set<string>()
-+
-+  await Promise.all(
-+    yearIds.map(async (year) => {
-+      const snapshot = await getDocs(collection(projectsDb, year))
-+      snapshot.forEach((doc) => {
-+        const data = doc.data() as Record<string, unknown>
-+        const projectNumber = toStringValue(data.projectNumber) ?? doc.id
-+
-+        const amount = toNumberValue(data.amount)
-+        const projectDateIso = toIsoDate(data.projectDate)
-+        const projectDateDisplay = formatDisplayDate(data.projectDate)
-+        const onDateIso = toIsoDate(data.onDate)
-+        const onDateDisplay = formatDisplayDate(data.onDate)
-+
-+        projects.push({
-+          id: doc.id,
-+          year,
-+          amount,
-+          clientCompany: toStringValue(data.clientCompany),
-+          invoice: toStringValue(data.invoice),
-+          onDateDisplay,
-+          onDateIso,
-+          paid: toBooleanValue(data.paid),
-+          paidTo: toStringValue(data.paidTo),
-+          presenterWorkType: toStringValue(data.presenterWorkType),
-+          projectDateDisplay,
-+          projectDateIso,
-+          projectNature: toStringValue(data.projectNature),
-+          projectNumber,
-+          projectTitle: toStringValue(data.projectTitle),
-+          subsidiary: toStringValue(data.subsidiary),
-+        })
-+
-+        yearsWithData.add(year)
-+      })
-+    })
-+  )
-+
-+  projects.sort((a, b) => {
-+    if (a.year !== b.year) {
-+      return b.year.localeCompare(a.year, undefined, { numeric: true })
-+    }
-+    return a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true })
-+  })
-+
-+  return {
-+    projects,
-+    years: uniqueSortedYears(yearsWithData),
++  LoadingDashMock.displayName = 'LoadingDashMock'
++  return LoadingDashMock
++})
+ jest.mock('../../../../lib/scanLogs', () => ({
+   readScanLogs: jest.fn(async () => null),
+   writeScanLog: jest.fn(),
+@@ -51,4 +73,3 @@ describe('coaching sessions card view', () => {
+     expect(screen.queryByTestId('pprompt-badge')).toBeNull()
+   })
+ })
+-
+diff --git a/components/StudentDialog/PaymentHistory.test.tsx b/components/StudentDialog/PaymentHistory.test.tsx
+index e850e7a..e2560e9 100644
+--- a/components/StudentDialog/PaymentHistory.test.tsx
++++ b/components/StudentDialog/PaymentHistory.test.tsx
+@@ -6,7 +6,13 @@ import '@testing-library/jest-dom'
+ import { render, screen, waitFor } from '@testing-library/react'
+ import PaymentHistory from './PaymentHistory'
+ 
+-jest.mock('./PaymentModal', () => () => <div />)
++jest.mock('./PaymentModal', () => {
++  function PaymentModalMock() {
++    return <div />
 +  }
-+}
-+
-diff --git a/pages/dashboard/businesses/index.tsx b/pages/dashboard/businesses/index.tsx
-index 505c235..135484d 100644
---- a/pages/dashboard/businesses/index.tsx
-+++ b/pages/dashboard/businesses/index.tsx
-@@ -3,33 +3,22 @@
- import { GetServerSideProps } from 'next';
- import { getSession } from 'next-auth/react';
- import SidebarLayout from '../../../components/SidebarLayout';
--import { initializeApis } from '../../../lib/googleApi';
--import { listProjectOverviewFiles } from '../../../lib/projectOverview';
- import { useRouter } from 'next/router';
- import { Box, Typography, List, ListItemButton, ListItemText, Button } from '@mui/material';
--import { drive_v3 } from 'googleapis';
++  PaymentModalMock.displayName = 'PaymentModalMock'
++  return PaymentModalMock
++})
  
--interface BusinessFile {
--  companyIdentifier: string;
--  fullCompanyName: string;
--  file: drive_v3.Schema$File;
-+interface BusinessLink {
-+  title: string;
-+  description: string;
-+  href: string;
- }
+ jest.mock('firebase/firestore', () => ({
+   collection: jest.fn(),
+diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
+index 3d4b44f..ac1f927 100644
+--- a/components/StudentDialog/PaymentModal.test.tsx
++++ b/components/StudentDialog/PaymentModal.test.tsx
+@@ -6,6 +6,8 @@ import '@testing-library/jest-dom'
+ import { render, fireEvent, waitFor, screen } from '@testing-library/react'
+ import PaymentModal from './PaymentModal'
+ import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
++import * as firestore from 'firebase/firestore'
++import * as erlDirectory from '../../lib/erlDirectory'
  
- interface BusinessesPageProps {
--  projectsByCategory: Record<string, BusinessFile[]>;
-+  businessLinks: BusinessLink[];
- }
+ jest.mock('../../lib/erlDirectory', () => ({
+   listBanks: jest
+@@ -46,6 +48,9 @@ jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))
  
--export default function BusinessesPage({ projectsByCategory }: BusinessesPageProps) {
-+export default function BusinessesPage({ businessLinks }: BusinessesPageProps) {
-   const router = useRouter();
+ const noop = () => {}
  
--  // Flatten the grouped projects into a single array.
--  // (The original code grouped them by subsidiary code; now we sort them alphabetically by fullCompanyName.)
--  const files: BusinessFile[] = [];
--  for (const key in projectsByCategory) {
--    projectsByCategory[key].forEach((file) => files.push(file));
--  }
--  files.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));
--
-   return (
-     <SidebarLayout>
-       <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
-@@ -43,12 +32,9 @@ export default function BusinessesPage({ projectsByCategory }: BusinessesPagePro
-         Select a project overview file:
-       </Typography>
-       <List>
--        {files.map((file) => (
--          <ListItemButton
--            key={file.file.id}
--            onClick={() => router.push(`/dashboard/businesses/${file.file.id}`)}
--          >
--            <ListItemText primary={file.fullCompanyName} secondary={file.file.name} />
-+        {businessLinks.map((link) => (
-+          <ListItemButton key={link.href} onClick={() => router.push(link.href)}>
-+            <ListItemText primary={link.title} secondary={link.description} />
-           </ListItemButton>
-         ))}
-       </List>
-@@ -61,12 +47,15 @@ export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async
-   if (!session?.accessToken) {
-     return { redirect: { destination: '/api/auth/signin', permanent: false } };
-   }
--  const { drive } = initializeApis('user', { accessToken: session.accessToken as string });
--  // Get the grouped project files using your existing sorting utility
--  const projectsByCategory = await listProjectOverviewFiles(drive, []);
-   return {
-     props: {
--      projectsByCategory,
-+      businessLinks: [
-+        {
-+          title: 'Establish Productions Limited',
-+          description: 'Projects (Database)',
-+          href: '/dashboard/businesses/projects-database/select',
-+        },
-+      ],
-     },
-   };
- };
-diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
++const mockedErlDirectory = jest.mocked(erlDirectory, true)
++const mockedFirestore = jest.mocked(firestore, true)
++
+ describe('PaymentModal ERL cascade', () => {
+   test('populates banks/accounts and submits identifier with audit fields', async () => {
+     const qc = new QueryClient()
+@@ -65,14 +70,10 @@ describe('PaymentModal ERL cascade', () => {
+     const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
+     fireEvent.change(accountSelect, { target: { value: 'a1' } })
+     await waitFor(() =>
+-      expect(
+-        require('../../lib/erlDirectory').buildAccountLabel,
+-      ).toHaveBeenCalled(),
++      expect(mockedErlDirectory.buildAccountLabel).toHaveBeenCalled(),
+     )
+-    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
+-    expect(
+-      require('../../lib/erlDirectory').listAccounts,
+-    ).toHaveBeenCalledWith({
++    expect(mockedErlDirectory.listBanks).toHaveBeenCalled()
++    expect(mockedErlDirectory.listAccounts).toHaveBeenCalledWith({
+       bankCode: '001',
+       bankName: 'Bank',
+       rawCodeSegment: '(001)',
+@@ -83,10 +84,10 @@ describe('PaymentModal ERL cascade', () => {
+     fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
+     fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })
+ 
+-    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
++    expect(mockedFirestore.addDoc).not.toHaveBeenCalled()
+     fireEvent.click(getByTestId('submit-payment'))
+-    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
+-    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
++    await waitFor(() => expect(mockedFirestore.addDoc).toHaveBeenCalled())
++    const data = (mockedFirestore.addDoc as jest.Mock).mock.calls[0][1]
+     expect(data.identifier).toBe('a1')
+     expect(data.bankCode).toBeUndefined()
+     expect(data.accountDocId).toBeUndefined()
+diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
 new file mode 100644
-index 0000000..3823567
+index 0000000..3bc18b4
 --- /dev/null
-+++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
-@@ -0,0 +1,400 @@
-+import { GetServerSideProps } from 'next'
-+import { getSession } from 'next-auth/react'
-+import { useRouter } from 'next/router'
-+import { useEffect, useState } from 'react'
-+
-+import SidebarLayout from '../../../../components/SidebarLayout'
-+import {
-+  fetchProjectsFromDatabase,
-+  ProjectRecord,
-+} from '../../../../lib/projectsDatabase'
++++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
+@@ -0,0 +1,113 @@
++// components/projectdialog/ProjectDatabaseDetailDialog.tsx
 +
++import React from 'react'
 +import {
 +  Box,
 +  Button,
-+  Card,
-+  CardContent,
-+  FormControl,
-+  Grid,
-+  IconButton,
-+  InputLabel,
-+  List,
-+  ListItem,
-+  ListItemText,
-+  MenuItem,
-+  Select,
-+  ToggleButton,
-+  ToggleButtonGroup,
++  Checkbox,
++  Dialog,
++  DialogActions,
++  DialogContent,
++  Divider,
 +  Typography,
 +} from '@mui/material'
-+import type { SelectChangeEvent } from '@mui/material/Select'
-+import ArrowBackIcon from '@mui/icons-material/ArrowBack'
-+
-+const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
-+const headingSx = { fontFamily: 'Cantata One' }
-+
-+type SortMethod = 'year' | 'subsidiary'
-+
-+type Mode = 'select' | 'detail'
++import CloseIcon from '@mui/icons-material/Close'
++import CheckIcon from '@mui/icons-material/Check'
 +
-+interface DetailSelection {
-+  type: SortMethod
-+  year: string
-+}
-+
-+interface ProjectsDatabasePageProps {
-+  mode: Mode
-+  years: string[]
-+  error?: string
-+  detailSelection?: DetailSelection
-+  projects?: ProjectRecord[]
-+}
-+
-+const encodeSelectionId = (type: SortMethod, year: string) => {
-+  const yearPart = encodeURIComponent(year)
-+  return `${type}--${yearPart}`
-+}
-+
-+const decodeSelectionId = (value: string): DetailSelection | null => {
-+  const [typePart, yearPart] = value.split('--')
-+  if (!typePart || !yearPart) {
-+    return null
-+  }
-+
-+  if (typePart !== 'year' && typePart !== 'subsidiary') {
-+    return null
-+  }
++import type { ProjectRecord } from '../../lib/projectsDatabase'
 +
-+  try {
-+    return { type: typePart, year: decodeURIComponent(yearPart) }
-+  } catch (err) {
-+    console.warn('[projects-database] Failed to decode selection id', err)
-+    return null
-+  }
++interface ProjectDatabaseDetailDialogProps {
++  open: boolean
++  onClose: () => void
++  project: ProjectRecord | null
 +}
 +
-+const stringOrNA = (value: string | null | undefined) =>
++const textOrNA = (value: string | null | undefined) =>
 +  value && value.trim().length > 0 ? value : 'N/A'
 +
-+const amountText = (value: number | null | undefined) => {
-+  if (value === null || value === undefined) {
-+    return '-'
++const formatAmount = (value: number | null | undefined) => {
++  if (typeof value !== 'number' || Number.isNaN(value)) {
++    return 'HK$0'
 +  }
-+
 +  return `HK$${value.toLocaleString('en-US', {
 +    minimumFractionDigits: 0,
 +    maximumFractionDigits: 2,
 +  })}`
 +}
 +
-+const paidStatusText = (value: boolean | null | undefined) => {
-+  if (value === null || value === undefined) {
-+    return 'N/A'
-+  }
-+  return value ? 'Paid' : 'Unpaid'
-+}
-+
-+const paidDateText = (
-+  paid: boolean | null | undefined,
-+  date: string | null | undefined
-+) => {
-+  if (!paid) {
++export default function ProjectDatabaseDetailDialog({
++  open,
++  onClose,
++  project,
++}: ProjectDatabaseDetailDialogProps) {
++  if (!project) {
 +    return null
 +  }
 +
-+  return date && date.trim().length > 0 ? date : '-'
-+}
-+
-+export default function ProjectsDatabasePage({
-+  mode,
-+  years,
-+  error,
-+  detailSelection,
-+  projects = [],
-+}: ProjectsDatabasePageProps) {
-+  const router = useRouter()
-+
-+  const [sortMethod, setSortMethod] = useState<SortMethod>(
-+    detailSelection?.type ?? 'year'
-+  )
-+  const [selectedYear, setSelectedYear] = useState<string>(
-+    detailSelection?.year ?? years[0] ?? ''
-+  )
++  const paid = project.paid === true
++  const paidOnText = paid ? project.onDateDisplay || '-' : undefined
 +
-+  const handleYearChange = (event: SelectChangeEvent<string>) => {
-+    setSelectedYear(event.target.value)
-+  }
-+
-+  useEffect(() => {
-+    if (!selectedYear && years.length > 0) {
-+      setSelectedYear(years[0])
-+    }
-+  }, [years, selectedYear])
-+
-+  useEffect(() => {
-+    if (detailSelection) {
-+      setSortMethod(detailSelection.type)
-+      setSelectedYear(detailSelection.year)
-+    }
-+  }, [detailSelection])
-+
-+  const handleNavigate = (type: SortMethod, year: string) => {
-+    if (!year) {
-+      return
-+    }
-+
-+    router.push(
-+      `/dashboard/businesses/projects-database/${encodeSelectionId(type, year)}`
-+    )
-+  }
-+
-+  if (mode === 'select') {
-+    return (
-+      <SidebarLayout>
-+        <Box sx={{ mb: 3 }}>
-+          <Typography variant="h4" sx={headingSx} gutterBottom>
-+            Projects (Database)
++  return (
++    <Dialog open={open} onClose={onClose} fullWidth>
++      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
++        <Typography variant="subtitle1">
++          {textOrNA(project.projectNumber)}
++        </Typography>
++        <Typography variant="subtitle1">
++          {textOrNA(project.clientCompany)}
++        </Typography>
++        <Typography variant="h4">{textOrNA(project.projectTitle)}</Typography>
++        <Typography variant="body2"> - {textOrNA(project.projectNature)}</Typography>
++        <Divider />
++        <Typography variant="body2">
++          <strong>Project Pickup Date:</strong>{' '}
++          {project.projectDateDisplay ?? 'Not set'}
++        </Typography>
++        <Typography variant="body2">
++          <strong>Amount:</strong> {formatAmount(project.amount)}
++        </Typography>
++        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
++          <strong>Paid:</strong>
++          <Checkbox
++            checked={paid}
++            icon={<CloseIcon />}
++            checkedIcon={<CheckIcon />}
++            disableRipple
++            sx={{ p: 0 }}
++            disabled
++          />
++        </Typography>
++        {paidOnText && (
++          <Typography variant="body2">
++            <strong>Paid On:</strong> {paidOnText}
 +          </Typography>
-+          <Typography variant="h6" sx={{ ...headingSx, mt: 2 }}>
-+            Establish Productions Limited
++        )}
++        {project.paidTo && (
++          <Typography variant="body2">
++            <strong>Pay to:</strong> {textOrNA(project.paidTo)}
 +          </Typography>
-+        </Box>
-+        {error && (
-+          <Typography color="error" sx={{ mb: 2 }}>
-+            {error}
++        )}
++        {project.presenterWorkType && (
++          <Typography variant="body2">
++            <strong>Presenter Work Type:</strong> {textOrNA(project.presenterWorkType)}
 +          </Typography>
 +        )}
-+        <Box
-+          sx={{
-+            display: 'flex',
-+            flexWrap: 'wrap',
-+            gap: 2,
-+            alignItems: 'center',
-+            mb: 3,
-+          }}
-+        >
-+          <ToggleButtonGroup
-+            value={sortMethod}
-+            exclusive
-+            onChange={(event, value: SortMethod | null) => {
-+              if (value) {
-+                setSortMethod(value)
-+              }
-+            }}
-+            size="small"
-+          >
-+            <ToggleButton value="year">By Year</ToggleButton>
-+            <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
-+          </ToggleButtonGroup>
-+          {sortMethod === 'year' && years.length > 0 && (
-+            <FormControl sx={{ minWidth: 160 }}>
-+              <InputLabel>Year</InputLabel>
-+              <Select
-+                value={selectedYear}
-+                label="Year"
-+                onChange={handleYearChange}
-+              >
-+                {years.map((year) => (
-+                  <MenuItem key={year} value={year}>
-+                    {year}
-+                  </MenuItem>
-+                ))}
-+              </Select>
-+            </FormControl>
-+          )}
-+        </Box>
-+        {sortMethod === 'year' ? (
-+          years.length === 0 ? (
-+            <Typography>No project collections available.</Typography>
-+          ) : selectedYear ? (
-+            <Grid container spacing={2}>
-+              <Grid item xs={12} sm={6} md={4}>
-+                <Card
-+                  sx={{ cursor: 'pointer', height: '100%' }}
-+                  onClick={() => handleNavigate('year', selectedYear)}
-+                >
-+                  <CardContent>
-+                    <Typography variant="h6" sx={headingSx} gutterBottom>
-+                      Establish Productions Limited
-+                    </Typography>
-+                    <Typography sx={valueSx}>{selectedYear} Projects</Typography>
-+                  </CardContent>
-+                </Card>
-+              </Grid>
-+            </Grid>
-+          ) : (
-+            <Typography>Please choose a year to continue.</Typography>
-+          )
-+        ) : years.length === 0 ? (
-+          <Typography>No project collections available.</Typography>
-+        ) : (
-+          <Grid container spacing={2}>
-+            {years.map((year) => (
-+              <Grid item xs={12} sm={6} md={4} key={year}>
-+                <Card
-+                  sx={{ cursor: 'pointer', height: '100%' }}
-+                  onClick={() => handleNavigate('subsidiary', year)}
-+                >
-+                  <CardContent>
-+                    <Typography variant="h6" sx={headingSx} gutterBottom>
-+                      {year}
-+                    </Typography>
-+                    <Typography sx={valueSx}>Project Collection</Typography>
-+                  </CardContent>
-+                </Card>
-+              </Grid>
-+            ))}
-+          </Grid>
++        {project.subsidiary && (
++          <Typography variant="body2">
++            <strong>Subsidiary:</strong> {textOrNA(project.subsidiary)}
++          </Typography>
 +        )}
-+      </SidebarLayout>
-+    )
-+  }
-+
-+  const handleBack = () => {
-+    router.push('/dashboard/businesses/projects-database/select')
-+  }
-+
-+  const headerLabel = detailSelection
-+    ? detailSelection.type === 'year'
-+      ? `Establish Productions Limited — ${detailSelection.year}`
-+      : `${detailSelection.year} Projects`
-+    : 'Projects'
-+
-+  return (
-+    <SidebarLayout>
-+      <Box
-+        sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
-+      >
-+        <IconButton onClick={handleBack}>
-+          <ArrowBackIcon />
-+        </IconButton>
-+        <Box sx={{ textAlign: 'center' }}>
-+          <Typography variant="h5" sx={headingSx}>
-+            {headerLabel}
++        <Divider />
++        <Box sx={{ mt: 1 }}>
++          <Typography variant="body2">
++            <strong>Invoice:</strong> {textOrNA(project.invoice)}
 +          </Typography>
-+          <Typography sx={valueSx}>Project Overview</Typography>
 +        </Box>
-+        <Button
-+          variant="contained"
-+          onClick={() => router.push('/dashboard/businesses/new')}
-+        >
-+          New Project
-+        </Button>
-+      </Box>
-+      {error && (
-+        <Typography color="error" sx={{ mb: 2 }}>
-+          {error}
-+        </Typography>
-+      )}
-+      <Card>
-+        <CardContent>
-+          <Typography variant="h6" sx={headingSx} gutterBottom>
-+            Project List
-+          </Typography>
-+          {projects.length === 0 ? (
-+            <Typography>No project records available.</Typography>
-+          ) : (
-+            <List>
-+              {projects.map((project) => {
-+                const primary = `${stringOrNA(project.projectNumber)} — ${stringOrNA(
-+                  project.projectTitle
-+                )}`
-+                const segments = [
-+                  amountText(project.amount),
-+                  paidStatusText(project.paid),
-+                ]
-+                const paidDate = paidDateText(project.paid, project.onDateDisplay)
-+                if (paidDate) {
-+                  segments.push(paidDate)
-+                }
-+
-+                return (
-+                  <ListItem
-+                    key={`${project.year}-${project.projectNumber}`}
-+                    alignItems="flex-start"
-+                    sx={{ cursor: 'default' }}
-+                  >
-+                    <ListItemText
-+                      primary={primary}
-+                      primaryTypographyProps={{ sx: valueSx }}
-+                      secondary={segments.join(' | ')}
-+                      secondaryTypographyProps={{ sx: valueSx }}
-+                    />
-+                  </ListItem>
-+                )
-+              })}
-+            </List>
-+          )}
-+        </CardContent>
-+      </Card>
-+    </SidebarLayout>
++      </DialogContent>
++      <DialogActions>
++        <Button onClick={onClose}>Close</Button>
++      </DialogActions>
++    </Dialog>
 +  )
 +}
 +
-+export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
-+  ctx
-+) => {
-+  const session = await getSession(ctx)
-+  if (!session?.accessToken) {
-+    return { redirect: { destination: '/api/auth/signin', permanent: false } }
-+  }
-+
-+  const groupParam = ctx.params?.groupId as string | undefined
-+
-+  try {
-+    const { projects, years } = await fetchProjectsFromDatabase()
-+
-+    if (!groupParam || groupParam === 'select') {
-+      return {
-+        props: {
-+          mode: 'select',
-+          years,
-+        },
-+      }
-+    }
-+
-+    const selection = decodeSelectionId(groupParam)
-+    if (!selection) {
-+      return {
-+        props: {
-+          mode: 'select',
-+          years,
-+          error: 'Invalid project selection, please choose again.',
-+        },
-+      }
-+    }
-+
-+    if (!years.includes(selection.year)) {
-+      return {
-+        props: {
-+          mode: 'select',
-+          years,
-+          error: 'Project collection not found, please choose again.',
-+        },
-+      }
-+    }
-+
-+    const matchingProjects = projects.filter(
-+      (project) => project.year === selection.year
-+    )
-+
-+    return {
-+      props: {
-+        mode: 'detail',
-+        years,
-+        detailSelection: selection,
-+        projects: matchingProjects,
-+      },
+diff --git a/cypress/e2e/add_payment_cascade.cy.tsx b/cypress/e2e/add_payment_cascade.cy.tsx
+index 83606c4..ced2188 100644
+--- a/cypress/e2e/add_payment_cascade.cy.tsx
++++ b/cypress/e2e/add_payment_cascade.cy.tsx
+@@ -8,9 +8,10 @@ import * as erlDir from '../../lib/erlDirectory'
+ import * as firestore from 'firebase/firestore'
+ import { Box, IconButton, Button } from '@mui/material'
+ import MoreVertIcon from '@mui/icons-material/MoreVert'
+-declare const expect: any
++import PaymentModal from '../../components/StudentDialog/PaymentModal'
+ 
+-declare const Cypress: any
++const getCypressInstance = () =>
++  (globalThis as typeof globalThis & { Cypress?: Cypress.Cypress }).Cypress
+ 
+ function mountModal(Component: any) {
+   cy.visit('about:blank')
+@@ -28,7 +29,10 @@ function mountModal(Component: any) {
+ 
+ describe('Add Payment cascade', () => {
+   beforeEach(function () {
+-    if (Cypress?.env('CI')) this.skip()
++    const cypressInstance = getCypressInstance()
++    if (cypressInstance?.env('CI')) {
++      this.skip()
 +    }
-+  } catch (err) {
-+    console.error('[projects-database] Failed to load projects:', err)
-+    return {
-+      props: {
-+        mode: 'select',
-+        years: [],
-+        error:
-+          err instanceof Error ? err.message : 'Error retrieving project records',
-+      },
+   })
+ 
+   it('shows cascade selects', () => {
+@@ -39,17 +43,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    ;(cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
++    cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').should('exist')
+@@ -70,17 +71,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').parent().click()
+@@ -96,16 +94,16 @@ describe('Add Payment cascade', () => {
+ 
+     cy.wrap(addDocStub).should('have.been.called')
+     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
+-      ;(expect as any)(data).to.include({
++      expect(data).to.include({
+         method: 'FPS',
+         entity: 'Music Establish (ERL)',
+         bankCode: '001',
+         accountDocId: 'a1',
+         refNumber: '123',
+       })
+-      ;(expect as any)(data.identifier).to.eq('001/a1')
+-      ;(expect as any)(data.timestamp).to.be.ok
+-      ;(expect as any)(data.editedBy).to.be.a('string')
++      expect(data.identifier).to.equal('001/a1')
++      expect(Boolean(data.timestamp)).to.equal(true)
++      expect(data.editedBy).to.be.a('string')
+     })
+   })
+ 
+@@ -117,17 +115,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').parent().click()
+@@ -144,17 +139,20 @@ describe('Add Payment cascade', () => {
+     cy.get('[data-testid="submit-payment"]').click()
+ 
+     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
+-      ;(expect as any)(data).to.include({ method: 'Cheque', entity: 'Personal' })
+-      ;(expect as any)(data.bankCode).to.be.undefined
+-      ;(expect as any)(data.accountDocId).to.be.undefined
+-      ;(expect as any)(data.identifier).to.be.undefined
++      expect(data).to.include({ method: 'Cheque', entity: 'Personal' })
++      expect(data.bankCode).to.equal(undefined)
++      expect(data.accountDocId).to.equal(undefined)
++      expect(data.identifier).to.equal(undefined)
+     })
+   })
+ })
+ 
+ describe('Card footer alignment', () => {
+   beforeEach(function () {
+-    if (Cypress?.env('CI')) this.skip()
++    const cypressInstance = getCypressInstance()
++    if (cypressInstance?.env('CI')) {
++      this.skip()
 +    }
-+  }
-+}
-diff --git a/pages/dashboard/businesses/projects-database/index.tsx b/pages/dashboard/businesses/projects-database/index.tsx
+   })
+ 
+   function mountFooter() {
+@@ -196,13 +194,12 @@ describe('Card footer alignment', () => {
+       const dotRect = $dots[0].getBoundingClientRect()
+       cy.get('[data-testid="service-mode-btn"]').then(($btn) => {
+         const btnRect = $btn[0].getBoundingClientRect()
+-        ;(expect as any)(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
++        expect(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
+         cy.get('[data-testid="card-footer-row"]').then(($row) => {
+           const rowRect = $row[0].getBoundingClientRect()
+-          ;(expect as any)(dotRect.left).to.be.gte(rowRect.left)
++          expect(dotRect.left).to.be.gte(rowRect.left)
+         })
+       })
+     })
+   })
+ })
+-
+diff --git a/docs/context/PR-251.md b/docs/context/PR-251.md
 new file mode 100644
-index 0000000..51c3a8a
+index 0000000..64e5546
 --- /dev/null
-+++ b/pages/dashboard/businesses/projects-database/index.tsx
-@@ -0,0 +1,14 @@
-+import { GetServerSideProps } from 'next'
-+
-+const ProjectsDatabaseIndex = () => null
++++ b/docs/context/PR-251.md
+@@ -0,0 +1 @@
++# Context for PR #251
+diff --git a/jest.config.cjs b/jest.config.cjs
+index cacf9c9..3674d3c 100644
+--- a/jest.config.cjs
++++ b/jest.config.cjs
+@@ -1,3 +1,5 @@
++/* eslint-env node */
++/* global module */
+ /** @type {import('jest').Config} */
+ module.exports = {
+   testEnvironment: 'node',
+diff --git a/lib/erlDirectory.test.ts b/lib/erlDirectory.test.ts
+index bb36046..0092dbc 100644
+--- a/lib/erlDirectory.test.ts
++++ b/lib/erlDirectory.test.ts
+@@ -29,7 +29,8 @@ test('buildBankLabel formats bank name and code', () => {
+ })
+ 
+ test('listBanks expands multiple codes', async () => {
+-  ;(getDocs as jest.Mock).mockResolvedValueOnce({
++  const getDocsMock = getDocs as jest.Mock
++  getDocsMock.mockResolvedValueOnce({
+     docs: [
+       { id: 'b1', data: () => ({ name: 'Bank1', code: [40, 152] }) },
+     ],
+@@ -57,4 +58,3 @@ test('buildAccountLabel masks and falls back', () => {
+     }),
+   ).toBe('Savings · ••••4321')
+ })
+-
+diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
+index 3823567..4dee9fb 100644
+--- a/pages/dashboard/businesses/projects-database/[groupId].tsx
++++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
+@@ -29,6 +29,7 @@ import {
+ } from '@mui/material'
+ import type { SelectChangeEvent } from '@mui/material/Select'
+ import ArrowBackIcon from '@mui/icons-material/ArrowBack'
++import ProjectDatabaseDetailDialog from '../../../../components/projectdialog/ProjectDatabaseDetailDialog'
+ 
+ const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
+ const headingSx = { fontFamily: 'Cantata One' }
+@@ -77,8 +78,8 @@ const stringOrNA = (value: string | null | undefined) =>
+   value && value.trim().length > 0 ? value : 'N/A'
+ 
+ const amountText = (value: number | null | undefined) => {
+-  if (value === null || value === undefined) {
+-    return '-'
++  if (typeof value !== 'number' || Number.isNaN(value)) {
++    return 'HK$0'
+   }
+ 
+   return `HK$${value.toLocaleString('en-US', {
+@@ -120,6 +121,10 @@ export default function ProjectsDatabasePage({
+   const [selectedYear, setSelectedYear] = useState<string>(
+     detailSelection?.year ?? years[0] ?? ''
+   )
++  const [dialogOpen, setDialogOpen] = useState(false)
++  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(
++    null
++  )
+ 
+   const handleYearChange = (event: SelectChangeEvent<string>) => {
+     setSelectedYear(event.target.value)
+@@ -148,6 +153,16 @@ export default function ProjectsDatabasePage({
+     )
+   }
+ 
++  const handleProjectClick = (project: ProjectRecord) => {
++    setSelectedProject(project)
++    setDialogOpen(true)
++  }
 +
-+export const getServerSideProps: GetServerSideProps = async () => {
-+  return {
-+    redirect: {
-+      destination: '/dashboard/businesses/projects-database/select',
-+      permanent: false,
-+    },
++  const handleCloseDialog = () => {
++    setDialogOpen(false)
++    setSelectedProject(null)
 +  }
-+}
 +
-+export default ProjectsDatabaseIndex
+   if (mode === 'select') {
+     return (
+       <SidebarLayout>
+@@ -312,13 +327,12 @@ export default function ProjectsDatabasePage({
+                   <ListItem
+                     key={`${project.year}-${project.projectNumber}`}
+                     alignItems="flex-start"
+-                    sx={{ cursor: 'default' }}
++                    sx={{ cursor: 'pointer' }}
++                    onClick={() => handleProjectClick(project)}
+                   >
+                     <ListItemText
+                       primary={primary}
+-                      primaryTypographyProps={{ sx: valueSx }}
+                       secondary={segments.join(' | ')}
+-                      secondaryTypographyProps={{ sx: valueSx }}
+                     />
+                   </ListItem>
+                 )
+@@ -327,6 +341,11 @@ export default function ProjectsDatabasePage({
+           )}
+         </CardContent>
+       </Card>
++      <ProjectDatabaseDetailDialog
++        open={dialogOpen}
++        onClose={handleCloseDialog}
++        project={selectedProject}
++      />
+     </SidebarLayout>
+   )
+ }
 ```
diff --git a/cypress/e2e/add_payment_cascade.cy.tsx b/cypress/e2e/add_payment_cascade.cy.tsx
index 83606c4..3657057 100644
--- a/cypress/e2e/add_payment_cascade.cy.tsx
+++ b/cypress/e2e/add_payment_cascade.cy.tsx
@@ -8,9 +8,11 @@ import * as erlDir from '../../lib/erlDirectory'
 import * as firestore from 'firebase/firestore'
 import { Box, IconButton, Button } from '@mui/material'
 import MoreVertIcon from '@mui/icons-material/MoreVert'
-declare const expect: any
+import PaymentModal from '../../components/StudentDialog/PaymentModal'
 
-declare const Cypress: any
+const getCypressInstance = () =>
+  (globalThis as typeof globalThis & { Cypress?: { env: (name: string) => any } })
+    .Cypress
 
 function mountModal(Component: any) {
   cy.visit('about:blank')
@@ -28,7 +30,10 @@ function mountModal(Component: any) {
 
 describe('Add Payment cascade', () => {
   beforeEach(function () {
-    if (Cypress?.env('CI')) this.skip()
+    const cypressInstance = getCypressInstance()
+    if (cypressInstance?.env('CI')) {
+      this.skip()
+    }
   })
 
   it('shows cascade selects', () => {
@@ -39,17 +44,14 @@ describe('Add Payment cascade', () => {
     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
 
-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
+    cy.stub(erlDir, 'listBanks').resolves([
       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
     ])
-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
+    cy.stub(erlDir, 'listAccounts').resolves([
       { accountDocId: 'a1', accountType: 'Savings' },
     ])
-    ;(cy as any).stub(firestore, 'addDoc').resolves()
-    ;(cy as any).stub(firestore, 'collection').returns({})
-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
-      .default
+    cy.stub(firestore, 'addDoc').resolves()
+    cy.stub(firestore, 'collection').returns({})
     mountModal(PaymentModal)
 
     cy.get('[data-testid="method-select"]').should('exist')
@@ -70,17 +72,14 @@ describe('Add Payment cascade', () => {
     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
 
-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
-    ;(cy as any).stub(firestore, 'collection').returns({})
-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
+    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
+    cy.stub(firestore, 'collection').returns({})
+    cy.stub(erlDir, 'listBanks').resolves([
       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
     ])
-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
+    cy.stub(erlDir, 'listAccounts').resolves([
       { accountDocId: 'a1', accountType: 'Savings' },
     ])
-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
-      .default
     mountModal(PaymentModal)
 
     cy.get('[data-testid="method-select"]').parent().click()
@@ -96,16 +95,16 @@ describe('Add Payment cascade', () => {
 
     cy.wrap(addDocStub).should('have.been.called')
     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
-      ;(expect as any)(data).to.include({
+      expect(data).to.include({
         method: 'FPS',
         entity: 'Music Establish (ERL)',
         bankCode: '001',
         accountDocId: 'a1',
         refNumber: '123',
       })
-      ;(expect as any)(data.identifier).to.eq('001/a1')
-      ;(expect as any)(data.timestamp).to.be.ok
-      ;(expect as any)(data.editedBy).to.be.a('string')
+      expect(data.identifier).to.equal('001/a1')
+      expect(Boolean(data.timestamp)).to.equal(true)
+      expect(data.editedBy).to.be.a('string')
     })
   })
 
@@ -117,17 +116,14 @@ describe('Add Payment cascade', () => {
     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
 
-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
-    ;(cy as any).stub(firestore, 'collection').returns({})
-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
+    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
+    cy.stub(firestore, 'collection').returns({})
+    cy.stub(erlDir, 'listBanks').resolves([
       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
     ])
-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
+    cy.stub(erlDir, 'listAccounts').resolves([
       { accountDocId: 'a1', accountType: 'Savings' },
     ])
-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
-      .default
     mountModal(PaymentModal)
 
     cy.get('[data-testid="method-select"]').parent().click()
@@ -144,17 +140,20 @@ describe('Add Payment cascade', () => {
     cy.get('[data-testid="submit-payment"]').click()
 
     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
-      ;(expect as any)(data).to.include({ method: 'Cheque', entity: 'Personal' })
-      ;(expect as any)(data.bankCode).to.be.undefined
-      ;(expect as any)(data.accountDocId).to.be.undefined
-      ;(expect as any)(data.identifier).to.be.undefined
+      expect(data).to.include({ method: 'Cheque', entity: 'Personal' })
+      expect(data.bankCode).to.equal(undefined)
+      expect(data.accountDocId).to.equal(undefined)
+      expect(data.identifier).to.equal(undefined)
     })
   })
 })
 
 describe('Card footer alignment', () => {
   beforeEach(function () {
-    if (Cypress?.env('CI')) this.skip()
+    const cypressInstance = getCypressInstance()
+    if (cypressInstance?.env('CI')) {
+      this.skip()
+    }
   })
 
   function mountFooter() {
@@ -196,13 +195,12 @@ describe('Card footer alignment', () => {
       const dotRect = $dots[0].getBoundingClientRect()
       cy.get('[data-testid="service-mode-btn"]').then(($btn) => {
         const btnRect = $btn[0].getBoundingClientRect()
-        ;(expect as any)(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
+        expect(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
         cy.get('[data-testid="card-footer-row"]').then(($row) => {
           const rowRect = $row[0].getBoundingClientRect()
-          ;(expect as any)(dotRect.left).to.be.gte(rowRect.left)
+          expect(dotRect.left).to.be.gte(rowRect.left)
         })
       })
     })
   })
 })
-
diff --git a/docs/context/PR-251.md b/docs/context/PR-251.md
new file mode 100644
index 0000000..81ef4ef
--- /dev/null
+++ b/docs/context/PR-251.md
@@ -0,0 +1,558 @@
+# PR #251 — Diff Summary
+
+- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
+- **Head (source)**: `c08d615458e64086f577db3d49f2e1a3b84f2195`
+- **Repo**: `girafeev1/ArtifactoftheEstablisher`
+
+## Changed Files
+
+```txt
+M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+M	components/StudentDialog/PaymentHistory.test.tsx
+M	components/StudentDialog/PaymentModal.test.tsx
+A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
+M	cypress/e2e/add_payment_cascade.cy.tsx
+A	docs/context/PR-251.md
+M	jest.config.cjs
+M	lib/erlDirectory.test.ts
+M	pages/dashboard/businesses/projects-database/[groupId].tsx
+```
+
+## Stats
+
+```txt
+ .../businesses/coaching-sessions.test.tsx          |  35 +++++--
+ components/StudentDialog/PaymentHistory.test.tsx   |   8 +-
+ components/StudentDialog/PaymentModal.test.tsx     |  21 ++--
+ .../projectdialog/ProjectDatabaseDetailDialog.tsx  | 113 +++++++++++++++++++++
+ cypress/e2e/add_payment_cascade.cy.tsx             |  69 ++++++-------
+ docs/context/PR-251.md                             |   1 +
+ jest.config.cjs                                    |   2 +
+ lib/erlDirectory.test.ts                           |   4 +-
+ .../businesses/projects-database/[groupId].tsx     |  29 +++++-
+ 9 files changed, 221 insertions(+), 61 deletions(-)
+```
+
+## Unified Diff (truncated to first 4000 lines)
+
+```diff
+diff --git a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+index 75ef22c..8ec8b9e 100644
+--- a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
++++ b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+@@ -19,15 +19,37 @@ jest.mock('firebase/firestore', () => ({
+ }))
+ jest.mock('../../../../lib/firebase', () => ({ db: {} }))
+ jest.mock('../../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
+-jest.mock('../../../../components/StudentDialog/OverviewTab', () => () => null)
+-jest.mock('../../../../components/StudentDialog/SessionDetail', () => () => null)
+-jest.mock('../../../../components/StudentDialog/FloatingWindow', () => ({ children }: any) => (
+-  <div>{children}</div>
+-))
++jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
++  function OverviewTabMock() {
++    return null
++  }
++  OverviewTabMock.displayName = 'OverviewTabMock'
++  return OverviewTabMock
++})
++jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
++  function SessionDetailMock() {
++    return null
++  }
++  SessionDetailMock.displayName = 'SessionDetailMock'
++  return SessionDetailMock
++})
++jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
++  function FloatingWindowMock({ children }: any) {
++    return <div>{children}</div>
++  }
++  FloatingWindowMock.displayName = 'FloatingWindowMock'
++  return FloatingWindowMock
++})
+ jest.mock('../../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
+ jest.mock('../../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
+ jest.mock('../../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
+-jest.mock('../../../../components/LoadingDash', () => () => null)
++jest.mock('../../../../components/LoadingDash', () => {
++  function LoadingDashMock() {
++    return null
++  }
++  LoadingDashMock.displayName = 'LoadingDashMock'
++  return LoadingDashMock
++})
+ jest.mock('../../../../lib/scanLogs', () => ({
+   readScanLogs: jest.fn(async () => null),
+   writeScanLog: jest.fn(),
+@@ -51,4 +73,3 @@ describe('coaching sessions card view', () => {
+     expect(screen.queryByTestId('pprompt-badge')).toBeNull()
+   })
+ })
+-
+diff --git a/components/StudentDialog/PaymentHistory.test.tsx b/components/StudentDialog/PaymentHistory.test.tsx
+index e850e7a..e2560e9 100644
+--- a/components/StudentDialog/PaymentHistory.test.tsx
++++ b/components/StudentDialog/PaymentHistory.test.tsx
+@@ -6,7 +6,13 @@ import '@testing-library/jest-dom'
+ import { render, screen, waitFor } from '@testing-library/react'
+ import PaymentHistory from './PaymentHistory'
+ 
+-jest.mock('./PaymentModal', () => () => <div />)
++jest.mock('./PaymentModal', () => {
++  function PaymentModalMock() {
++    return <div />
++  }
++  PaymentModalMock.displayName = 'PaymentModalMock'
++  return PaymentModalMock
++})
+ 
+ jest.mock('firebase/firestore', () => ({
+   collection: jest.fn(),
+diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
+index 3d4b44f..ac1f927 100644
+--- a/components/StudentDialog/PaymentModal.test.tsx
++++ b/components/StudentDialog/PaymentModal.test.tsx
+@@ -6,6 +6,8 @@ import '@testing-library/jest-dom'
+ import { render, fireEvent, waitFor, screen } from '@testing-library/react'
+ import PaymentModal from './PaymentModal'
+ import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
++import * as firestore from 'firebase/firestore'
++import * as erlDirectory from '../../lib/erlDirectory'
+ 
+ jest.mock('../../lib/erlDirectory', () => ({
+   listBanks: jest
+@@ -46,6 +48,9 @@ jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))
+ 
+ const noop = () => {}
+ 
++const mockedErlDirectory = jest.mocked(erlDirectory, true)
++const mockedFirestore = jest.mocked(firestore, true)
++
+ describe('PaymentModal ERL cascade', () => {
+   test('populates banks/accounts and submits identifier with audit fields', async () => {
+     const qc = new QueryClient()
+@@ -65,14 +70,10 @@ describe('PaymentModal ERL cascade', () => {
+     const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
+     fireEvent.change(accountSelect, { target: { value: 'a1' } })
+     await waitFor(() =>
+-      expect(
+-        require('../../lib/erlDirectory').buildAccountLabel,
+-      ).toHaveBeenCalled(),
++      expect(mockedErlDirectory.buildAccountLabel).toHaveBeenCalled(),
+     )
+-    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
+-    expect(
+-      require('../../lib/erlDirectory').listAccounts,
+-    ).toHaveBeenCalledWith({
++    expect(mockedErlDirectory.listBanks).toHaveBeenCalled()
++    expect(mockedErlDirectory.listAccounts).toHaveBeenCalledWith({
+       bankCode: '001',
+       bankName: 'Bank',
+       rawCodeSegment: '(001)',
+@@ -83,10 +84,10 @@ describe('PaymentModal ERL cascade', () => {
+     fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
+     fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })
+ 
+-    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
++    expect(mockedFirestore.addDoc).not.toHaveBeenCalled()
+     fireEvent.click(getByTestId('submit-payment'))
+-    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
+-    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
++    await waitFor(() => expect(mockedFirestore.addDoc).toHaveBeenCalled())
++    const data = (mockedFirestore.addDoc as jest.Mock).mock.calls[0][1]
+     expect(data.identifier).toBe('a1')
+     expect(data.bankCode).toBeUndefined()
+     expect(data.accountDocId).toBeUndefined()
+diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
+new file mode 100644
+index 0000000..3bc18b4
+--- /dev/null
++++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
+@@ -0,0 +1,113 @@
++// components/projectdialog/ProjectDatabaseDetailDialog.tsx
++
++import React from 'react'
++import {
++  Box,
++  Button,
++  Checkbox,
++  Dialog,
++  DialogActions,
++  DialogContent,
++  Divider,
++  Typography,
++} from '@mui/material'
++import CloseIcon from '@mui/icons-material/Close'
++import CheckIcon from '@mui/icons-material/Check'
++
++import type { ProjectRecord } from '../../lib/projectsDatabase'
++
++interface ProjectDatabaseDetailDialogProps {
++  open: boolean
++  onClose: () => void
++  project: ProjectRecord | null
++}
++
++const textOrNA = (value: string | null | undefined) =>
++  value && value.trim().length > 0 ? value : 'N/A'
++
++const formatAmount = (value: number | null | undefined) => {
++  if (typeof value !== 'number' || Number.isNaN(value)) {
++    return 'HK$0'
++  }
++  return `HK$${value.toLocaleString('en-US', {
++    minimumFractionDigits: 0,
++    maximumFractionDigits: 2,
++  })}`
++}
++
++export default function ProjectDatabaseDetailDialog({
++  open,
++  onClose,
++  project,
++}: ProjectDatabaseDetailDialogProps) {
++  if (!project) {
++    return null
++  }
++
++  const paid = project.paid === true
++  const paidOnText = paid ? project.onDateDisplay || '-' : undefined
++
++  return (
++    <Dialog open={open} onClose={onClose} fullWidth>
++      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
++        <Typography variant="subtitle1">
++          {textOrNA(project.projectNumber)}
++        </Typography>
++        <Typography variant="subtitle1">
++          {textOrNA(project.clientCompany)}
++        </Typography>
++        <Typography variant="h4">{textOrNA(project.projectTitle)}</Typography>
++        <Typography variant="body2"> - {textOrNA(project.projectNature)}</Typography>
++        <Divider />
++        <Typography variant="body2">
++          <strong>Project Pickup Date:</strong>{' '}
++          {project.projectDateDisplay ?? 'Not set'}
++        </Typography>
++        <Typography variant="body2">
++          <strong>Amount:</strong> {formatAmount(project.amount)}
++        </Typography>
++        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
++          <strong>Paid:</strong>
++          <Checkbox
++            checked={paid}
++            icon={<CloseIcon />}
++            checkedIcon={<CheckIcon />}
++            disableRipple
++            sx={{ p: 0 }}
++            disabled
++          />
++        </Typography>
++        {paidOnText && (
++          <Typography variant="body2">
++            <strong>Paid On:</strong> {paidOnText}
++          </Typography>
++        )}
++        {project.paidTo && (
++          <Typography variant="body2">
++            <strong>Pay to:</strong> {textOrNA(project.paidTo)}
++          </Typography>
++        )}
++        {project.presenterWorkType && (
++          <Typography variant="body2">
++            <strong>Presenter Work Type:</strong> {textOrNA(project.presenterWorkType)}
++          </Typography>
++        )}
++        {project.subsidiary && (
++          <Typography variant="body2">
++            <strong>Subsidiary:</strong> {textOrNA(project.subsidiary)}
++          </Typography>
++        )}
++        <Divider />
++        <Box sx={{ mt: 1 }}>
++          <Typography variant="body2">
++            <strong>Invoice:</strong> {textOrNA(project.invoice)}
++          </Typography>
++        </Box>
++      </DialogContent>
++      <DialogActions>
++        <Button onClick={onClose}>Close</Button>
++      </DialogActions>
++    </Dialog>
++  )
++}
++
+diff --git a/cypress/e2e/add_payment_cascade.cy.tsx b/cypress/e2e/add_payment_cascade.cy.tsx
+index 83606c4..ced2188 100644
+--- a/cypress/e2e/add_payment_cascade.cy.tsx
++++ b/cypress/e2e/add_payment_cascade.cy.tsx
+@@ -8,9 +8,10 @@ import * as erlDir from '../../lib/erlDirectory'
+ import * as firestore from 'firebase/firestore'
+ import { Box, IconButton, Button } from '@mui/material'
+ import MoreVertIcon from '@mui/icons-material/MoreVert'
+-declare const expect: any
++import PaymentModal from '../../components/StudentDialog/PaymentModal'
+ 
+-declare const Cypress: any
++const getCypressInstance = () =>
++  (globalThis as typeof globalThis & { Cypress?: Cypress.Cypress }).Cypress
+ 
+ function mountModal(Component: any) {
+   cy.visit('about:blank')
+@@ -28,7 +29,10 @@ function mountModal(Component: any) {
+ 
+ describe('Add Payment cascade', () => {
+   beforeEach(function () {
+-    if (Cypress?.env('CI')) this.skip()
++    const cypressInstance = getCypressInstance()
++    if (cypressInstance?.env('CI')) {
++      this.skip()
++    }
+   })
+ 
+   it('shows cascade selects', () => {
+@@ -39,17 +43,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    ;(cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
++    cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').should('exist')
+@@ -70,17 +71,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').parent().click()
+@@ -96,16 +94,16 @@ describe('Add Payment cascade', () => {
+ 
+     cy.wrap(addDocStub).should('have.been.called')
+     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
+-      ;(expect as any)(data).to.include({
++      expect(data).to.include({
+         method: 'FPS',
+         entity: 'Music Establish (ERL)',
+         bankCode: '001',
+         accountDocId: 'a1',
+         refNumber: '123',
+       })
+-      ;(expect as any)(data.identifier).to.eq('001/a1')
+-      ;(expect as any)(data.timestamp).to.be.ok
+-      ;(expect as any)(data.editedBy).to.be.a('string')
++      expect(data.identifier).to.equal('001/a1')
++      expect(Boolean(data.timestamp)).to.equal(true)
++      expect(data.editedBy).to.be.a('string')
+     })
+   })
+ 
+@@ -117,17 +115,14 @@ describe('Add Payment cascade', () => {
+     process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 'x'
+     process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'x'
+ 
+-    const addDocStub = (cy as any).stub(firestore, 'addDoc').resolves()
+-    ;(cy as any).stub(firestore, 'collection').returns({})
+-    ;(cy as any).stub(erlDir, 'listBanks').resolves([
++    const addDocStub = cy.stub(firestore, 'addDoc').resolves()
++    cy.stub(firestore, 'collection').returns({})
++    cy.stub(erlDir, 'listBanks').resolves([
+       { bankCode: '001', bankName: 'Bank', rawCodeSegment: '(001)' },
+     ])
+-    ;(cy as any).stub(erlDir, 'listAccounts').resolves([
++    cy.stub(erlDir, 'listAccounts').resolves([
+       { accountDocId: 'a1', accountType: 'Savings' },
+     ])
+-    delete require.cache[require.resolve('../../components/StudentDialog/PaymentModal')]
+-    const PaymentModal = require('../../components/StudentDialog/PaymentModal')
+-      .default
+     mountModal(PaymentModal)
+ 
+     cy.get('[data-testid="method-select"]').parent().click()
+@@ -144,17 +139,20 @@ describe('Add Payment cascade', () => {
+     cy.get('[data-testid="submit-payment"]').click()
+ 
+     cy.wrap(addDocStub).its('firstCall.args.1').should((data: any) => {
+-      ;(expect as any)(data).to.include({ method: 'Cheque', entity: 'Personal' })
+-      ;(expect as any)(data.bankCode).to.be.undefined
+-      ;(expect as any)(data.accountDocId).to.be.undefined
+-      ;(expect as any)(data.identifier).to.be.undefined
++      expect(data).to.include({ method: 'Cheque', entity: 'Personal' })
++      expect(data.bankCode).to.equal(undefined)
++      expect(data.accountDocId).to.equal(undefined)
++      expect(data.identifier).to.equal(undefined)
+     })
+   })
+ })
+ 
+ describe('Card footer alignment', () => {
+   beforeEach(function () {
+-    if (Cypress?.env('CI')) this.skip()
++    const cypressInstance = getCypressInstance()
++    if (cypressInstance?.env('CI')) {
++      this.skip()
++    }
+   })
+ 
+   function mountFooter() {
+@@ -196,13 +194,12 @@ describe('Card footer alignment', () => {
+       const dotRect = $dots[0].getBoundingClientRect()
+       cy.get('[data-testid="service-mode-btn"]').then(($btn) => {
+         const btnRect = $btn[0].getBoundingClientRect()
+-        ;(expect as any)(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
++        expect(Math.abs(dotRect.bottom - btnRect.bottom)).to.be.lte(1)
+         cy.get('[data-testid="card-footer-row"]').then(($row) => {
+           const rowRect = $row[0].getBoundingClientRect()
+-          ;(expect as any)(dotRect.left).to.be.gte(rowRect.left)
++          expect(dotRect.left).to.be.gte(rowRect.left)
+         })
+       })
+     })
+   })
+ })
+-
+diff --git a/docs/context/PR-251.md b/docs/context/PR-251.md
+new file mode 100644
+index 0000000..64e5546
+--- /dev/null
++++ b/docs/context/PR-251.md
+@@ -0,0 +1 @@
++# Context for PR #251
+diff --git a/jest.config.cjs b/jest.config.cjs
+index cacf9c9..3674d3c 100644
+--- a/jest.config.cjs
++++ b/jest.config.cjs
+@@ -1,3 +1,5 @@
++/* eslint-env node */
++/* global module */
+ /** @type {import('jest').Config} */
+ module.exports = {
+   testEnvironment: 'node',
+diff --git a/lib/erlDirectory.test.ts b/lib/erlDirectory.test.ts
+index bb36046..0092dbc 100644
+--- a/lib/erlDirectory.test.ts
++++ b/lib/erlDirectory.test.ts
+@@ -29,7 +29,8 @@ test('buildBankLabel formats bank name and code', () => {
+ })
+ 
+ test('listBanks expands multiple codes', async () => {
+-  ;(getDocs as jest.Mock).mockResolvedValueOnce({
++  const getDocsMock = getDocs as jest.Mock
++  getDocsMock.mockResolvedValueOnce({
+     docs: [
+       { id: 'b1', data: () => ({ name: 'Bank1', code: [40, 152] }) },
+     ],
+@@ -57,4 +58,3 @@ test('buildAccountLabel masks and falls back', () => {
+     }),
+   ).toBe('Savings · ••••4321')
+ })
+-
+diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
+index 3823567..4dee9fb 100644
+--- a/pages/dashboard/businesses/projects-database/[groupId].tsx
++++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
+@@ -29,6 +29,7 @@ import {
+ } from '@mui/material'
+ import type { SelectChangeEvent } from '@mui/material/Select'
+ import ArrowBackIcon from '@mui/icons-material/ArrowBack'
++import ProjectDatabaseDetailDialog from '../../../../components/projectdialog/ProjectDatabaseDetailDialog'
+ 
+ const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
+ const headingSx = { fontFamily: 'Cantata One' }
+@@ -77,8 +78,8 @@ const stringOrNA = (value: string | null | undefined) =>
+   value && value.trim().length > 0 ? value : 'N/A'
+ 
+ const amountText = (value: number | null | undefined) => {
+-  if (value === null || value === undefined) {
+-    return '-'
++  if (typeof value !== 'number' || Number.isNaN(value)) {
++    return 'HK$0'
+   }
+ 
+   return `HK$${value.toLocaleString('en-US', {
+@@ -120,6 +121,10 @@ export default function ProjectsDatabasePage({
+   const [selectedYear, setSelectedYear] = useState<string>(
+     detailSelection?.year ?? years[0] ?? ''
+   )
++  const [dialogOpen, setDialogOpen] = useState(false)
++  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(
++    null
++  )
+ 
+   const handleYearChange = (event: SelectChangeEvent<string>) => {
+     setSelectedYear(event.target.value)
+@@ -148,6 +153,16 @@ export default function ProjectsDatabasePage({
+     )
+   }
+ 
++  const handleProjectClick = (project: ProjectRecord) => {
++    setSelectedProject(project)
++    setDialogOpen(true)
++  }
++
++  const handleCloseDialog = () => {
++    setDialogOpen(false)
++    setSelectedProject(null)
++  }
++
+   if (mode === 'select') {
+     return (
+       <SidebarLayout>
+@@ -312,13 +327,12 @@ export default function ProjectsDatabasePage({
+                   <ListItem
+                     key={`${project.year}-${project.projectNumber}`}
+                     alignItems="flex-start"
+-                    sx={{ cursor: 'default' }}
++                    sx={{ cursor: 'pointer' }}
++                    onClick={() => handleProjectClick(project)}
+                   >
+                     <ListItemText
+                       primary={primary}
+-                      primaryTypographyProps={{ sx: valueSx }}
+                       secondary={segments.join(' | ')}
+-                      secondaryTypographyProps={{ sx: valueSx }}
+                     />
+                   </ListItem>
+                 )
+@@ -327,6 +341,11 @@ export default function ProjectsDatabasePage({
+           )}
+         </CardContent>
+       </Card>
++      <ProjectDatabaseDetailDialog
++        open={dialogOpen}
++        onClose={handleCloseDialog}
++        project={selectedProject}
++      />
+     </SidebarLayout>
+   )
+ }
+```
diff --git a/jest.config.cjs b/jest.config.cjs
index cacf9c9..3674d3c 100644
--- a/jest.config.cjs
+++ b/jest.config.cjs
@@ -1,3 +1,5 @@
+/* eslint-env node */
+/* global module */
 /** @type {import('jest').Config} */
 module.exports = {
   testEnvironment: 'node',
diff --git a/lib/erlDirectory.test.ts b/lib/erlDirectory.test.ts
index bb36046..0092dbc 100644
--- a/lib/erlDirectory.test.ts
+++ b/lib/erlDirectory.test.ts
@@ -29,7 +29,8 @@ test('buildBankLabel formats bank name and code', () => {
 })
 
 test('listBanks expands multiple codes', async () => {
-  ;(getDocs as jest.Mock).mockResolvedValueOnce({
+  const getDocsMock = getDocs as jest.Mock
+  getDocsMock.mockResolvedValueOnce({
     docs: [
       { id: 'b1', data: () => ({ name: 'Bank1', code: [40, 152] }) },
     ],
@@ -57,4 +58,3 @@ test('buildAccountLabel masks and falls back', () => {
     }),
   ).toBe('Savings · ••••4321')
 })
-
diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
index 3823567..4dee9fb 100644
--- a/pages/dashboard/businesses/projects-database/[groupId].tsx
+++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
@@ -29,6 +29,7 @@ import {
 } from '@mui/material'
 import type { SelectChangeEvent } from '@mui/material/Select'
 import ArrowBackIcon from '@mui/icons-material/ArrowBack'
+import ProjectDatabaseDetailDialog from '../../../../components/projectdialog/ProjectDatabaseDetailDialog'
 
 const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
 const headingSx = { fontFamily: 'Cantata One' }
@@ -77,8 +78,8 @@ const stringOrNA = (value: string | null | undefined) =>
   value && value.trim().length > 0 ? value : 'N/A'
 
 const amountText = (value: number | null | undefined) => {
-  if (value === null || value === undefined) {
-    return '-'
+  if (typeof value !== 'number' || Number.isNaN(value)) {
+    return 'HK$0'
   }
 
   return `HK$${value.toLocaleString('en-US', {
@@ -120,6 +121,10 @@ export default function ProjectsDatabasePage({
   const [selectedYear, setSelectedYear] = useState<string>(
     detailSelection?.year ?? years[0] ?? ''
   )
+  const [dialogOpen, setDialogOpen] = useState(false)
+  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(
+    null
+  )
 
   const handleYearChange = (event: SelectChangeEvent<string>) => {
     setSelectedYear(event.target.value)
@@ -148,6 +153,16 @@ export default function ProjectsDatabasePage({
     )
   }
 
+  const handleProjectClick = (project: ProjectRecord) => {
+    setSelectedProject(project)
+    setDialogOpen(true)
+  }
+
+  const handleCloseDialog = () => {
+    setDialogOpen(false)
+    setSelectedProject(null)
+  }
+
   if (mode === 'select') {
     return (
       <SidebarLayout>
@@ -312,13 +327,12 @@ export default function ProjectsDatabasePage({
                   <ListItem
                     key={`${project.year}-${project.projectNumber}`}
                     alignItems="flex-start"
-                    sx={{ cursor: 'default' }}
+                    sx={{ cursor: 'pointer' }}
+                    onClick={() => handleProjectClick(project)}
                   >
                     <ListItemText
                       primary={primary}
-                      primaryTypographyProps={{ sx: valueSx }}
                       secondary={segments.join(' | ')}
-                      secondaryTypographyProps={{ sx: valueSx }}
                     />
                   </ListItem>
                 )
@@ -327,6 +341,11 @@ export default function ProjectsDatabasePage({
           )}
         </CardContent>
       </Card>
+      <ProjectDatabaseDetailDialog
+        open={dialogOpen}
+        onClose={handleCloseDialog}
+        project={selectedProject}
+      />
     </SidebarLayout>
   )
 }
```
