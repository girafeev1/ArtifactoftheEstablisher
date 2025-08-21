# PR #236 — Diff Summary

- **Base (target)**: `e2caf5adeadab57c68978b75fd7bab3d0f11c25c`
- **Head (source)**: `ae58d3f78f65231201c56ad416d8e46ad59a483c`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/StudentDialog/PaymentDetail.test.tsx
M	components/StudentDialog/PaymentDetail.tsx
M	components/StudentDialog/PaymentModal.test.tsx
M	components/StudentDialog/PaymentModal.tsx
M	lib/erlDirectory.test.ts
M	lib/erlDirectory.ts
M	pages/dashboard/businesses/coaching-sessions.tsx
A	prompts/p-027-08r.md
```

## Stats

```txt
 components/StudentDialog/PaymentDetail.test.tsx  |   6 +
 components/StudentDialog/PaymentDetail.tsx       | 271 +++++++++++++----------
 components/StudentDialog/PaymentModal.test.tsx   |  78 ++++---
 components/StudentDialog/PaymentModal.tsx        | 104 +++++----
 lib/erlDirectory.test.ts                         | 102 ++++++++-
 lib/erlDirectory.ts                              |  33 ++-
 pages/dashboard/businesses/coaching-sessions.tsx |   1 +
 prompts/p-027-08r.md                             |  44 ++++
 8 files changed, 433 insertions(+), 206 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/StudentDialog/PaymentDetail.test.tsx b/components/StudentDialog/PaymentDetail.test.tsx
index 81ef1af..9810341 100644
--- a/components/StudentDialog/PaymentDetail.test.tsx
+++ b/components/StudentDialog/PaymentDetail.test.tsx
@@ -83,6 +83,9 @@ describe('PaymentDetail', () => {
         onBack={() => {}}
       />,
     )
+    fireEvent.change(screen.getByTestId('detail-method-select'), {
+      target: { value: 'FPS' },
+    })
     fireEvent.change(screen.getByTestId('detail-entity-select'), {
       target: { value: 'Music Establish (ERL)' },
     })
@@ -104,10 +107,13 @@ describe('PaymentDetail', () => {
     await waitFor(() =>
       expect(payment.entity).toBe('Music Establish (ERL)'),
     )
+    expect(payment.method).toBe('FPS')
     expect(payment.bankCode).toBe('001')
     expect(payment.accountDocId).toBe('A1')
     expect(payment.identifier).toBe('001/A1')
     expect(payment.refNumber).toBe('REF1')
+    expect(screen.queryByTestId('detail-method-select')).toBeNull()
+    expect(screen.queryByTestId('detail-entity-select')).toBeNull()
   })
 })
 
diff --git a/components/StudentDialog/PaymentDetail.tsx b/components/StudentDialog/PaymentDetail.tsx
index 5a57aac..1f264e7 100644
--- a/components/StudentDialog/PaymentDetail.tsx
+++ b/components/StudentDialog/PaymentDetail.tsx
@@ -48,6 +48,7 @@ import {
   BankInfo,
   AccountInfo,
 } from '../../lib/erlDirectory'
+import { useSnackbar } from 'notistack'
 
 const formatCurrency = (n: number) =>
   new Intl.NumberFormat(undefined, {
@@ -116,17 +117,33 @@ export default function PaymentDetail({
   const minDue = React.useMemo(() => minUnpaidRate(bill?.rows || []), [bill])
   const isErl =
     entityVal === 'Music Establish (ERL)' || entityVal === 'ME-ERL'
+  const bankMsg = "Bank directory unavailable or missing 'code' on bank docs"
+  const [bankError, setBankError] = useState<string | null>(null)
+  const { enqueueSnackbar } = useSnackbar()
   useEffect(() => {
     if (isErl && banks.length === 0) {
       listBanks()
-        .then((b) => setBanks(b))
-        .catch(() => setBanks([]))
+        .then((b) => {
+          setBanks(b)
+          if (b.length === 0) {
+            setBankError(bankMsg)
+            enqueueSnackbar(bankMsg, { variant: 'error' })
+          } else {
+            setBankError(null)
+          }
+        })
+        .catch(() => {
+          setBanks([])
+          setBankError(bankMsg)
+          enqueueSnackbar(bankMsg, { variant: 'error' })
+        })
     }
   }, [isErl, banks.length])
   useEffect(() => {
     if (!isErl) {
       setBankCodeVal('')
       setAccountIdVal('')
+      setBankError(null)
     }
   }, [isErl])
   useEffect(() => {
@@ -140,33 +157,6 @@ export default function PaymentDetail({
     }
   }, [isErl, bankCodeVal])
 
-  const saveMeta = async (
-    field: 'method' | 'entity' | 'identifier' | 'refNumber',
-    value: string,
-  ) => {
-    const ref = doc(db, PATHS.payments(abbr), payment.id)
-    const patch: any = {}
-    if (field === 'identifier') {
-      const val = normalizeIdentifier(
-        value.trim(),
-        payment.bankCode,
-        payment.accountDocId,
-      )
-      if (!val) return
-      patch.identifier = val
-      payment.identifier = val
-    } else {
-      const val = value.trim()
-      if (!val) return
-      patch[field] = val
-      ;(payment as any)[field] = val
-      if (field === 'method') setMethodVal(val)
-      if (field === 'entity') setEntityVal(val)
-      if (field === 'refNumber') setRefVal(val)
-    }
-    await updateDoc(ref, patch)
-    await writeSummaryFromCache(qc, abbr, account)
-  }
 
   const assignedSet = new Set(assignedSessionIds)
   const allRows = bill
@@ -234,14 +224,33 @@ export default function PaymentDetail({
     )
   }
 
-  const needsMeta =
+  const needsCascadeInitial =
+    !payment.method ||
     !payment.entity ||
     ((payment.entity === 'Music Establish (ERL)' || payment.entity === 'ME-ERL') &&
-      (!payment.bankCode || !payment.accountDocId)) ||
-    !payment.refNumber
+      (!payment.bankCode || !payment.accountDocId))
+  const [metaComplete, setMetaComplete] = useState(!needsCascadeInitial)
+  const needsCascade = !metaComplete
+
+  const needsMeta = needsCascade || !payment.refNumber
+
+  useEffect(() => {
+    const init =
+      !payment.method ||
+      !payment.entity ||
+      ((payment.entity === 'Music Establish (ERL)' || payment.entity === 'ME-ERL') &&
+        (!payment.bankCode || !payment.accountDocId))
+    setMetaComplete(!init)
+    setMethodVal(payment.method || '')
+    setEntityVal(payment.entity || '')
+    setBankCodeVal(payment.bankCode || '')
+    setAccountIdVal(payment.accountDocId || '')
+    setRefVal(payment.refNumber || '')
+  }, [payment])
 
   const saveMetaDetails = async () => {
     const patch: any = {
+      method: methodVal,
       entity: entityVal,
       refNumber: refVal,
       timestamp: Timestamp.now(),
@@ -267,18 +276,20 @@ export default function PaymentDetail({
       delete payment.identifier
     }
     await updateDoc(doc(db, PATHS.payments(abbr), payment.id), patch)
+    Object.assign(payment, {
+      method: methodVal,
+      entity: entityVal,
+      refNumber: refVal,
+    })
     if (isErl) {
       Object.assign(payment, {
-        entity: entityVal,
-        refNumber: refVal,
         bankCode: bankCodeVal,
         accountDocId: accountIdVal,
         identifier: patch.identifier,
       })
-    } else {
-      Object.assign(payment, { entity: entityVal, refNumber: refVal })
     }
     await writeSummaryFromCache(qc, abbr, account)
+    setMetaComplete(true)
   }
 
   useEffect(() => {
@@ -444,101 +455,116 @@ export default function PaymentDetail({
                 label: 'Payment Date',
                 value: isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d),
               },
-              {
+            ]
+            if (needsCascade) {
+              fields.push({
                 label: 'Method',
-                value: payment.method ? (
-                  payment.method
-                ) : (
+                value: (
                   <TextField
+                    select
                     size="small"
                     value={methodVal}
                     onChange={(e) => setMethodVal(e.target.value)}
-                    onBlur={() => saveMeta('method', methodVal)}
                     inputProps={{
+                      'data-testid': 'detail-method-select',
                       style: { fontFamily: 'Newsreader', fontWeight: 500 },
                     }}
-                  />
+                  >
+                    {['FPS', 'Bank Transfer', 'Cheque'].map((m) => (
+                      <MenuItem key={m} value={m}>
+                        {m}
+                      </MenuItem>
+                    ))}
+                  </TextField>
                 ),
-              },
-              {
-                label: 'Entity',
-                value: payment.entity
-                  ? payment.entity === 'ME-ERL'
-                    ? 'Music Establish (ERL)'
-                    : payment.entity
-                  : (
-                      <TextField
-                        select
-                        size="small"
-                        value={entityVal}
-                        onChange={(e) => setEntityVal(e.target.value)}
-                        inputProps={{
-                          'data-testid': 'detail-entity-select',
-                          style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                        }}
-                      >
-                        <MenuItem value="Music Establish (ERL)">
-                          Music Establish (ERL)
-                        </MenuItem>
-                        <MenuItem value="Personal">Personal</MenuItem>
-                      </TextField>
-                    ),
-              },
-            ]
-            const showBank =
-              payment.entity === 'ME-ERL' ||
-              payment.entity === 'Music Establish (ERL)' ||
-              (!payment.entity && entityVal === 'Music Establish (ERL)')
-            if (showBank) {
+              })
               fields.push({
-                label: 'Bank',
-                value: payment.bankCode
-                  ? buildBankLabel({
-                      bankCode: payment.bankCode,
-                      bankName: banks.find((b) => b.bankCode === payment.bankCode)?.bankName,
-                    })
-                  : (
-                      <TextField
-                        select
-                        size="small"
-                        value={bankCodeVal}
-                        onChange={(e) => setBankCodeVal(e.target.value)}
-                        inputProps={{
-                          'data-testid': 'detail-bank-select',
-                          style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                        }}
-                      >
-                        {banks.map((b) => (
-                          <MenuItem key={b.bankCode} value={b.bankCode}>
-                            {buildBankLabel(b)}
-                          </MenuItem>
-                        ))}
-                      </TextField>
-                    ),
+                label: 'Entity',
+                value: (
+                  <TextField
+                    select
+                    size="small"
+                    value={entityVal}
+                    onChange={(e) => setEntityVal(e.target.value)}
+                    inputProps={{
+                      'data-testid': 'detail-entity-select',
+                      style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                    }}
+                  >
+                    <MenuItem value="Music Establish (ERL)">Music Establish (ERL)</MenuItem>
+                    <MenuItem value="Personal">Personal</MenuItem>
+                  </TextField>
+                ),
               })
+              if (entityVal === 'Music Establish (ERL)') {
+                fields.push({
+                  label: 'Bank',
+                  value: (
+                    <TextField
+                      select
+                      size="small"
+                      value={bankCodeVal}
+                      onChange={(e) => setBankCodeVal(e.target.value)}
+                      inputProps={{
+                        'data-testid': 'detail-bank-select',
+                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                      }}
+                    >
+                      {banks.map((b) => (
+                        <MenuItem key={b.bankCode} value={b.bankCode}>
+                          {buildBankLabel(b)}
+                        </MenuItem>
+                      ))}
+                    </TextField>
+                  ),
+                })
+                fields.push({
+                  label: 'Bank Account',
+                  value: (
+                    <TextField
+                      select
+                      size="small"
+                      value={accountIdVal}
+                      onChange={(e) => setAccountIdVal(e.target.value)}
+                      inputProps={{
+                        'data-testid': 'detail-bank-account-select',
+                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                      }}
+                    >
+                      {accounts.map((a) => (
+                        <MenuItem key={a.accountDocId} value={a.accountDocId}>
+                          {a.accountType}
+                        </MenuItem>
+                      ))}
+                    </TextField>
+                  ),
+                })
+              }
+            } else {
+              fields.push({ label: 'Method', value: payment.method || 'N/A' })
               fields.push({
-                label: 'Bank Account',
-                value: payment.accountDocId
-                  ? payment.accountDocId
-                  : (
-                      <TextField
-                        select
-                        size="small"
-                        value={accountIdVal}
-                        onChange={(e) => setAccountIdVal(e.target.value)}
-                        inputProps={{
-                          'data-testid': 'detail-bank-account-select',
-                          style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                        }}
-                      >
-                        {accounts.map((a) => (
-                          <MenuItem key={a.accountDocId} value={a.accountDocId}>
-                            {a.accountType}
-                          </MenuItem>
-                        ))}
-                      </TextField>
-                    ),
+                label: 'Entity',
+                value:
+                  payment.entity === 'ME-ERL'
+                    ? 'Music Establish (ERL)'
+                    : payment.entity || 'N/A',
               })
+              if (
+                payment.entity === 'ME-ERL' ||
+                payment.entity === 'Music Establish (ERL)'
+              ) {
+                fields.push({
+                  label: 'Bank',
+                  value: buildBankLabel({
+                    bankCode: payment.bankCode,
+                    bankName: banks.find((b) => b.bankCode === payment.bankCode)?.bankName,
+                  }),
+                })
+                fields.push({
+                  label: 'Bank Account',
+                  value: payment.accountDocId || 'N/A',
+                })
+              }
             }
             if (sessionOrds.length) {
               const { visible, hiddenCount } = truncateList(sessionOrds)
@@ -609,6 +635,15 @@ export default function PaymentDetail({
               </React.Fragment>
             ))
           })()}
+          {bankError && (
+            <Typography
+              variant="body2"
+              color="error"
+              sx={{ gridColumn: '1 / span 2', mt: 1 }}
+            >
+              {bankError}
+            </Typography>
+          )}
         </Box>
 
         <Typography
diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
index c6426ff..43c406d 100644
--- a/components/StudentDialog/PaymentModal.test.tsx
+++ b/components/StudentDialog/PaymentModal.test.tsx
@@ -2,58 +2,68 @@
  * @jest-environment jsdom
  */
 import React from 'react'
+import '@testing-library/jest-dom'
 import { render, fireEvent, waitFor } from '@testing-library/react'
 import PaymentModal from './PaymentModal'
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
 
 jest.mock('../../lib/erlDirectory', () => ({
-  listBanks: jest.fn().mockResolvedValue([
-    { bankCode: '001', bankName: 'Bank' },
-  ]),
+  listBanks: jest.fn().mockResolvedValue([{ bankCode: '001', bankName: 'Bank' }]),
   listAccounts: jest.fn().mockResolvedValue([
     { accountDocId: 'a1', accountType: 'Savings' },
   ]),
   buildBankLabel: jest.fn((b) => `${b.bankName} ${b.bankCode}`),
 }))
 
+jest.mock('firebase/firestore', () => ({
+  collection: jest.fn(),
+  addDoc: jest.fn(),
+  Timestamp: { fromDate: jest.fn(() => 'date'), now: jest.fn(() => 'now') },
+}))
+
+jest.mock('firebase/auth', () => ({
+  getAuth: () => ({ currentUser: { email: 'tester@example.com' } }),
+}))
+
+jest.mock('../../lib/firebase', () => ({ db: {} }))
+jest.mock('../../lib/paths', () => ({ PATHS: { payments: () => 'p' }, logPath: jest.fn() }))
+jest.mock('../../lib/billing/useBilling', () => ({
+  useBillingClient: () => ({ setQueryData: jest.fn() }),
+  billingKey: () => 'key',
+}))
+jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))
+
 const noop = () => {}
 
-describe('PaymentModal entity switching', () => {
-  test('clears bank fields when switching to Personal', async () => {
+describe('PaymentModal ERL cascade', () => {
+  test('populates banks/accounts and submits identifier with audit fields', async () => {
     const qc = new QueryClient()
-    const { getByTestId, queryByTestId } = render(
-      React.createElement(QueryClientProvider, { client: qc },
-        React.createElement(PaymentModal, {
-          abbr: 'A',
-          account: 'B',
-          open: true,
-          onClose: noop,
-        }),
-      ),
+    const { getByTestId } = render(
+      <QueryClientProvider client={qc}>
+        <PaymentModal abbr="A" account="B" open onClose={noop} />
+      </QueryClientProvider>,
     )
 
-    const entitySelect = getByTestId('entity-select') as HTMLInputElement
-    fireEvent.change(entitySelect, { target: { value: 'Music Establish (ERL)' } })
-    await waitFor(() => expect(entitySelect.value).toBe('Music Establish (ERL)'))
-
-    let bankSelect = getByTestId('bank-select') as HTMLInputElement
+    fireEvent.change(getByTestId('entity-select'), {
+      target: { value: 'Music Establish (ERL)' },
+    })
+    await waitFor(() => getByTestId('bank-select'))
+    const bankSelect = getByTestId('bank-select') as HTMLInputElement
     fireEvent.change(bankSelect, { target: { value: '001' } })
-    await waitFor(() => expect(bankSelect.value).toBe('001'))
-
-    let accountSelect = getByTestId('bank-account-select') as HTMLInputElement
+    await waitFor(() => getByTestId('bank-account-select'))
+    const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
     fireEvent.change(accountSelect, { target: { value: 'a1' } })
-    await waitFor(() => expect(accountSelect.value).toBe('a1'))
+    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
+    expect(require('../../lib/erlDirectory').listAccounts).toHaveBeenCalledWith('001')
+    fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
 
-    fireEvent.change(entitySelect, { target: { value: 'Personal' } })
-    await waitFor(() => expect(entitySelect.value).toBe('Personal'))
-
-    expect(
-      (getByTestId('entity-select') as HTMLInputElement).value,
-    ).toBe('Personal')
-
-    await waitFor(() => {
-      expect(queryByTestId('bank-select')).toBeNull()
-      expect(queryByTestId('bank-account-select')).toBeNull()
-    })
+    fireEvent.click(getByTestId('submit-payment'))
+    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
+    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
+    expect(data.identifier).toBe('001/a1')
+    expect(data.bankCode).toBe('001')
+    expect(data.accountDocId).toBe('a1')
+    expect(data.editedBy).toBe('tester@example.com')
+    expect(data.timestamp).toBe('now')
   })
 })
diff --git a/components/StudentDialog/PaymentModal.tsx b/components/StudentDialog/PaymentModal.tsx
index 7d8f659..c44f5b1 100644
--- a/components/StudentDialog/PaymentModal.tsx
+++ b/components/StudentDialog/PaymentModal.tsx
@@ -8,6 +8,7 @@ import {
   Button,
   MenuItem,
   Typography,
+  Grid,
 } from '@mui/material'
 import { collection, addDoc, Timestamp } from 'firebase/firestore'
 import { getAuth } from 'firebase/auth'
@@ -23,6 +24,7 @@ import { normalizeIdentifier } from '../../lib/payments/format'
 import { PATHS, logPath } from '../../lib/paths'
 import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
 import { writeSummaryFromCache } from '../../lib/liveRefresh'
+import { useSnackbar } from 'notistack'
 
 export default function PaymentModal({
   abbr,
@@ -48,6 +50,8 @@ export default function PaymentModal({
   const [refNumber, setRefNumber] = useState('')
   const qc = useBillingClient()
   const isErl = entity === 'Music Establish (ERL)'
+  const { enqueueSnackbar } = useSnackbar()
+  const bankMsg = "Bank directory unavailable or missing 'code' on bank docs"
 
   useEffect(() => {
     if (!isErl) {
@@ -63,9 +67,17 @@ export default function PaymentModal({
       listBanks()
         .then((b) => {
           setBanks(b)
-          setBankError(null)
+          if (b.length === 0) {
+            setBankError(bankMsg)
+            enqueueSnackbar(bankMsg, { variant: 'error' })
+          } else {
+            setBankError(null)
+          }
+        })
+        .catch(() => {
+          setBankError(bankMsg)
+          enqueueSnackbar(bankMsg, { variant: 'error' })
         })
-        .catch(() => setBankError('Bank directory unavailable (check permissions)'))
     }
   }, [isErl, banks.length])
 
@@ -198,48 +210,52 @@ export default function PaymentModal({
         </TextField>
         {isErl && (
           <>
-            <TextField
-              label="Bank"
-              select
-              value={bankCode}
-              onChange={(e) => setBankCode(e.target.value)}
-              fullWidth
-              InputLabelProps={{
-                sx: { fontFamily: 'Newsreader', fontWeight: 200 },
-              }}
-              inputProps={{
-                style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                'data-testid': 'bank-select',
-              }}
-              sx={{ mt: 2 }}
-            >
-              {banks.map((b) => (
-                <MenuItem key={b.bankCode} value={b.bankCode}>
-                  {buildBankLabel(b)}
-                </MenuItem>
-              ))}
-            </TextField>
-            <TextField
-              label="Bank Account"
-              select
-              value={accountId}
-              onChange={(e) => setAccountId(e.target.value)}
-              fullWidth
-              InputLabelProps={{
-                sx: { fontFamily: 'Newsreader', fontWeight: 200 },
-              }}
-              inputProps={{
-                style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                'data-testid': 'bank-account-select',
-              }}
-              sx={{ mt: 2 }}
-            >
-              {accounts.map((a) => (
-                <MenuItem key={a.accountDocId} value={a.accountDocId}>
-                  {a.accountType}
-                </MenuItem>
-              ))}
-            </TextField>
+            <Grid container spacing={2} sx={{ mt: 2 }}>
+              <Grid item xs={12} md={6}>
+                <TextField
+                  label="Bank"
+                  select
+                  value={bankCode}
+                  onChange={(e) => setBankCode(e.target.value)}
+                  fullWidth
+                  InputLabelProps={{
+                    sx: { fontFamily: 'Newsreader', fontWeight: 200 },
+                  }}
+                  inputProps={{
+                    style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                    'data-testid': 'bank-select',
+                  }}
+                >
+                  {banks.map((b) => (
+                    <MenuItem key={b.bankCode} value={b.bankCode}>
+                      {buildBankLabel(b)}
+                    </MenuItem>
+                  ))}
+                </TextField>
+              </Grid>
+              <Grid item xs={12} md={6}>
+                <TextField
+                  label="Bank Account"
+                  select
+                  value={accountId}
+                  onChange={(e) => setAccountId(e.target.value)}
+                  fullWidth
+                  InputLabelProps={{
+                    sx: { fontFamily: 'Newsreader', fontWeight: 200 },
+                  }}
+                  inputProps={{
+                    style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                    'data-testid': 'bank-account-select',
+                  }}
+                >
+                  {accounts.map((a) => (
+                    <MenuItem key={a.accountDocId} value={a.accountDocId}>
+                      {a.accountType}
+                    </MenuItem>
+                  ))}
+                </TextField>
+              </Grid>
+            </Grid>
             {bankError && (
               <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                 {bankError}
diff --git a/lib/erlDirectory.test.ts b/lib/erlDirectory.test.ts
index 777cbfa..a903978 100644
--- a/lib/erlDirectory.test.ts
+++ b/lib/erlDirectory.test.ts
@@ -1,4 +1,19 @@
-import { buildBankLabel } from './erlDirectory'
+import {
+  buildBankLabel,
+  listBanks,
+  listAccounts,
+} from './erlDirectory'
+import { collection, collectionGroup, getDocs } from 'firebase/firestore'
+
+jest.mock('./firebase', () => ({ app: {} }))
+
+jest.mock('firebase/firestore', () => ({
+  getFirestore: jest.fn(() => ({})),
+  initializeFirestore: jest.fn(() => ({})),
+  collection: jest.fn((_: any, ...parts: string[]) => parts.join('/')),
+  collectionGroup: jest.fn((_: any, id: string) => `group:${id}`),
+  getDocs: jest.fn(),
+}))
 
 describe('buildBankLabel', () => {
   test('uses name and code when available', () => {
@@ -13,3 +28,88 @@ describe('buildBankLabel', () => {
     ).toBe('d1 banks')
   })
 })
+
+describe('listBanks', () => {
+  beforeEach(() => {
+    ;(getDocs as jest.Mock).mockReset()
+    ;(collection as jest.Mock).mockClear()
+  })
+
+  test('returns banks collection when present', async () => {
+    ;(getDocs as jest.Mock).mockResolvedValueOnce({
+      docs: [
+        { id: 'b1', data: () => ({ code: '001', name: 'Bank1' }) },
+      ],
+    })
+    const res = await listBanks()
+    expect(collection).toHaveBeenCalledWith(expect.anything(), 'banks')
+    expect(res).toEqual([
+      {
+        bankCode: '001',
+        bankName: 'Bank1',
+        docId: 'b1',
+        collectionId: 'banks',
+      },
+    ])
+  })
+
+  test('falls back to bankAccount collection using code field', async () => {
+    ;(getDocs as jest.Mock)
+      .mockResolvedValueOnce({ docs: [] })
+      .mockResolvedValueOnce({
+        docs: [
+          { id: 'Dah Sing Bank', data: () => ({ code: '(040)' }) },
+        ],
+      })
+    const res = await listBanks()
+    expect(collection).toHaveBeenCalledWith(expect.anything(), 'bankAccount')
+    expect(res).toEqual([
+      {
+        bankCode: '(040)',
+        bankName: 'Dah Sing Bank',
+        docId: 'Dah Sing Bank',
+        collectionId: 'bankAccount',
+      },
+    ])
+  })
+})
+
+describe('listAccounts', () => {
+  beforeEach(() => {
+    ;(getDocs as jest.Mock).mockReset()
+    ;(collection as jest.Mock).mockClear()
+    ;(collectionGroup as jest.Mock).mockClear()
+  })
+
+  test('returns accounts under banks/{code} when present', async () => {
+    ;(getDocs as jest.Mock).mockResolvedValueOnce({
+      empty: false,
+      docs: [{ id: 'a1', data: () => ({ accountType: 'chk' }) }],
+    })
+    const res = await listAccounts('001')
+    expect(collection).toHaveBeenCalledWith(
+      expect.anything(),
+      'banks',
+      '001',
+      'accounts',
+    )
+    expect(res).toEqual([{ accountDocId: 'a1', accountType: 'chk' }])
+  })
+
+  test('falls back to collection group on code', async () => {
+    ;(getDocs as jest.Mock)
+      .mockResolvedValueOnce({ empty: true, docs: [] })
+      .mockResolvedValueOnce({
+        docs: [
+          {
+            id: 'acc1',
+            data: () => ({ accountType: 'sv' }),
+            ref: { path: '/bankAccount/DSB/(040)/acc1' },
+          },
+        ],
+      })
+    const res = await listAccounts('(040)')
+    expect(collectionGroup).toHaveBeenCalledWith(expect.anything(), '(040)')
+    expect(res).toEqual([{ accountDocId: 'acc1', accountType: 'sv' }])
+  })
+})
diff --git a/lib/erlDirectory.ts b/lib/erlDirectory.ts
index a040c19..0d578d6 100644
--- a/lib/erlDirectory.ts
+++ b/lib/erlDirectory.ts
@@ -1,4 +1,10 @@
-import { initializeFirestore, getFirestore, collection, getDocs } from 'firebase/firestore'
+import {
+  initializeFirestore,
+  getFirestore,
+  collection,
+  collectionGroup,
+  getDocs,
+} from 'firebase/firestore'
 import { app } from './firebase'
 
 export interface BankInfo {
@@ -39,12 +45,19 @@ export async function listBanks(): Promise<BankInfo[]> {
   } catch (e) {
     console.warn('preferred bank directory failed', e)
     const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
-    return snap.docs.map((d) => ({
-      bankCode: d.id,
-      bankName: (d.data() as any)?.name,
-      docId: d.id,
-      collectionId: 'bankAccount',
-    }))
+    const banks = snap.docs.map((d) => {
+      const data = d.data() as any
+      if (typeof data.code !== 'string')
+        throw new Error(`missing code for bank ${d.id}`)
+      return {
+        bankCode: data.code,
+        bankName: d.id,
+        docId: d.id,
+        collectionId: 'bankAccount',
+      } as BankInfo
+    })
+    if (!banks.length) throw new Error('empty bankAccount directory')
+    return banks
   }
 }
 
@@ -56,8 +69,10 @@ export async function listAccounts(bankCode: string): Promise<AccountInfo[]> {
   } catch (e) {
     console.warn('preferred accounts failed', e)
   }
-  const snap = await getDocs(collection(dbDirectory, 'bankAccount', bankCode, 'accounts'))
-  return snap.docs.map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
+  const snap = await getDocs(collectionGroup(dbDirectory, bankCode))
+  return snap.docs
+    .filter((d) => d.ref.path.includes('/bankAccount/'))
+    .map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
 }
 
 export function buildBankLabel(b: BankInfo): string {
diff --git a/pages/dashboard/businesses/coaching-sessions.tsx b/pages/dashboard/businesses/coaching-sessions.tsx
index 91e4106..889c100 100644
--- a/pages/dashboard/businesses/coaching-sessions.tsx
+++ b/pages/dashboard/businesses/coaching-sessions.tsx
@@ -430,6 +430,7 @@ export default function CoachingSessions() {
             sx={{
               bgcolor: serviceMode ? 'red' : 'primary.main',
               animation: serviceMode ? 'blink 1s infinite' : 'none',
+              height: 36,
             }}
           >
             Service Mode
diff --git a/prompts/p-027-08r.md b/prompts/p-027-08r.md
new file mode 100644
index 0000000..61b7579
--- /dev/null
+++ b/prompts/p-027-08r.md
@@ -0,0 +1,44 @@
+# P-027-08r — Wire ERL cascade to current Firestore structure, side-by-side selects, add cascade to Payment Detail (when empty), keep single badge & alignment
+
+## Save path
+prompts/p-027-08r.md
+
+## Branch & PR
+- Branch: codex/finalize-add-payment-cascade-and-alignments-08r
+- PR title: feat(payment): ERL cascade wired to bankAccount structure, side-by-side selects, detail fallback, single badge, alignment (P-027-08r)
+- Labels: payments, ui, codex
+- Do not change CI, Actions, or Vercel settings in this PR.
+
+## A) ERL directory hookup (no new helpers, adapt existing files)
+- Update lib/erlDirectory.ts to read new `erl-directory/bankAccount/{BankName}` docs that require a `code` field.
+- listBanks(): prefer `banks/*`; fallback to `bankAccount/*` using `data.code`.
+- listAccounts(bankCode): prefer `banks/{bankCode}/accounts/*`; fallback via `collectionGroup(dbDirectory, bankCode)` filtering paths containing `/bankAccount/`.
+- buildBankLabel unchanged.
+- Missing `code` on bank docs should surface a toast and inline hint in the UI.
+
+## A2. Add Payment dialog — keep cascade, make it actually populate
+- Entity "Music Establish (ERL)" triggers bank/account cascade using updated helpers.
+- If listBanks() empty or throws, inline message: `Bank directory unavailable or missing 'code' on bank docs`.
+- Submit writes method, entity, refNumber, timestamp, editedBy and for ERL also bankCode, accountDocId, identifier = "${bankCode}/${accountDocId}".
+
+## B) UI layout tweaks
+- Bank & Bank Account selects render side-by-side in PaymentModal (Grid container md={6}).
+- Coaching Sessions card footer: keep 3-dots (`settings-3dots`) and Service Mode (`service-mode-btn`) in footer row; baselines match and stay inside card.
+- P-prompt badge: single `pprompt-badge-card` at top-right of card view only.
+
+## C) Payment Detail — fallback cascade only when fields are empty
+- When method/entity/bankCode/accountDocId missing, render inline cascade to complete metadata once.
+- Save writes same fields as Add Payment plus timestamp & editedBy; once set, fields become read-only.
+
+## D) Tests
+- lib/erlDirectory.test.ts: banks/accounts fallback logic.
+- PaymentModal.test.tsx: ERL cascade populates and submit stores identifier & audit fields.
+- PaymentDetail.test.tsx: metadata cascade saves once then renders read-only.
+
+## Acceptance
+- Add Payment dialog shows working cascade with current ERL structure.
+- Bank and Bank Account selects side-by-side.
+- Payment Detail shows cascade only when metadata missing; after save, fields read-only.
+- 3-dots and Service Mode share baseline inside card; no sidebar drift.
+- Only one P-prompt badge rendered (top-right of card).
+- No TypeScript errors; unit/RTL tests pass.
```
