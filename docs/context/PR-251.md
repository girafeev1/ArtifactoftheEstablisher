# PR #251 — Diff Summary

- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
- **Head (source)**: `c08d615458e64086f577db3d49f2e1a3b84f2195`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
M	components/StudentDialog/PaymentHistory.test.tsx
M	components/StudentDialog/PaymentModal.test.tsx
A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
M	cypress/e2e/add_payment_cascade.cy.tsx
A	docs/context/PR-251.md
M	jest.config.cjs
M	lib/erlDirectory.test.ts
M	pages/dashboard/businesses/projects-database/[groupId].tsx
```

## Stats

```txt
 .../businesses/coaching-sessions.test.tsx          |  35 +++++--
 components/StudentDialog/PaymentHistory.test.tsx   |   8 +-
 components/StudentDialog/PaymentModal.test.tsx     |  21 ++--
 .../projectdialog/ProjectDatabaseDetailDialog.tsx  | 113 +++++++++++++++++++++
 cypress/e2e/add_payment_cascade.cy.tsx             |  69 ++++++-------
 docs/context/PR-251.md                             |   1 +
 jest.config.cjs                                    |   2 +
 lib/erlDirectory.test.ts                           |   4 +-
 .../businesses/projects-database/[groupId].tsx     |  29 +++++-
 9 files changed, 221 insertions(+), 61 deletions(-)
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
diff --git a/cypress/e2e/add_payment_cascade.cy.tsx b/cypress/e2e/add_payment_cascade.cy.tsx
index 83606c4..ced2188 100644
--- a/cypress/e2e/add_payment_cascade.cy.tsx
+++ b/cypress/e2e/add_payment_cascade.cy.tsx
@@ -8,9 +8,10 @@ import * as erlDir from '../../lib/erlDirectory'
 import * as firestore from 'firebase/firestore'
 import { Box, IconButton, Button } from '@mui/material'
 import MoreVertIcon from '@mui/icons-material/MoreVert'
-declare const expect: any
+import PaymentModal from '../../components/StudentDialog/PaymentModal'
 
-declare const Cypress: any
+const getCypressInstance = () =>
+  (globalThis as typeof globalThis & { Cypress?: Cypress.Cypress }).Cypress
 
 function mountModal(Component: any) {
   cy.visit('about:blank')
@@ -28,7 +29,10 @@ function mountModal(Component: any) {
 
 describe('Add Payment cascade', () => {
   beforeEach(function () {
-    if (Cypress?.env('CI')) this.skip()
+    const cypressInstance = getCypressInstance()
+    if (cypressInstance?.env('CI')) {
+      this.skip()
+    }
   })
 
   it('shows cascade selects', () => {
@@ -39,17 +43,14 @@ describe('Add Payment cascade', () => {
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
@@ -70,17 +71,14 @@ describe('Add Payment cascade', () => {
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
@@ -96,16 +94,16 @@ describe('Add Payment cascade', () => {
 
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
 
@@ -117,17 +115,14 @@ describe('Add Payment cascade', () => {
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
@@ -144,17 +139,20 @@ describe('Add Payment cascade', () => {
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
@@ -196,13 +194,12 @@ describe('Card footer alignment', () => {
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
index 0000000..64e5546
--- /dev/null
+++ b/docs/context/PR-251.md
@@ -0,0 +1 @@
+# Context for PR #251
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
