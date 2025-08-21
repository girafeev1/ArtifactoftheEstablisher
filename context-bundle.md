# PR #242 — Diff Summary

- **Base (target)**: `a2c9af8091631737b8a15a9f15ed29f3f058d195`
- **Head (source)**: `f14f3a51604bc82d6c98c104748f38cd62875ba0`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/StudentDialog/PaymentDetail.test.tsx
M	components/StudentDialog/PaymentDetail.tsx
M	components/StudentDialog/PaymentHistory.tsx
M	components/StudentDialog/PaymentModal.test.tsx
M	components/StudentDialog/PaymentModal.tsx
M	lib/erlDirectory.test.ts
M	lib/erlDirectory.ts
A	lib/payments/submit.test.ts
A	lib/payments/submit.ts
A	prompts/p-028-02r.md
M	styles/studentDialog.css
```

## Stats

```txt
 components/StudentDialog/PaymentDetail.test.tsx |  46 ++-
 components/StudentDialog/PaymentDetail.tsx      | 468 +++++++++++++-----------
 components/StudentDialog/PaymentHistory.tsx     |  32 +-
 components/StudentDialog/PaymentModal.test.tsx  |  11 +-
 components/StudentDialog/PaymentModal.tsx       |  30 +-
 lib/erlDirectory.test.ts                        |  36 +-
 lib/erlDirectory.ts                             |  84 +++--
 lib/payments/submit.test.ts                     |  22 ++
 lib/payments/submit.ts                          |  13 +
 prompts/p-028-02r.md                            |   1 +
 styles/studentDialog.css                        |   2 +-
 11 files changed, 424 insertions(+), 321 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/StudentDialog/PaymentDetail.test.tsx b/components/StudentDialog/PaymentDetail.test.tsx
index 52a9655..d9aa04e 100644
--- a/components/StudentDialog/PaymentDetail.test.tsx
+++ b/components/StudentDialog/PaymentDetail.test.tsx
@@ -29,6 +29,7 @@ jest.mock('firebase/firestore', () => ({
   collection: jest.fn(),
   Timestamp: { now: () => ({ seconds: 0 }) },
   deleteField: () => 'DELETED',
+  getDoc: jest.fn(() => Promise.resolve({ data: () => ({ firstName: 'First', lastName: 'Last' }) })),
 }))
 jest.mock('../../lib/erlDirectory', () => ({
   listBanks: () =>
@@ -37,6 +38,14 @@ jest.mock('../../lib/erlDirectory', () => ({
     .fn()
     .mockResolvedValue([{ accountDocId: 'A1', accountType: 'Savings' }]),
   buildBankLabel: (b: any) => `${b.bankName || ''} (${b.bankCode})`.trim(),
+  lookupAccount: jest.fn(() =>
+    Promise.resolve({
+      bankName: 'Bank1',
+      bankCode: '001',
+      accountType: 'Savings',
+      accountNumber: '1234',
+    }),
+  ),
 }))
 
 describe('PaymentDetail', () => {
@@ -75,7 +84,7 @@ describe('PaymentDetail', () => {
     expect(blinkEls[0]).toBe(screen.getByTestId('remaining-amount'))
   })
 
-  it('allows editing empty metadata and saves', async () => {
+  it('allows editing empty metadata and saves identifier only', async () => {
     const payment: any = { ...basePayment }
     render(
       <PaymentDetail
@@ -95,13 +104,6 @@ describe('PaymentDetail', () => {
     fireEvent.change(screen.getByTestId('detail-bank-select'), {
       target: { value: '001' },
     })
-    await waitFor(() =>
-      expect(require('../../lib/erlDirectory').listAccounts).toHaveBeenCalledWith({
-        bankCode: '001',
-        bankName: 'Bank1',
-        rawCodeSegment: '(001)',
-      }),
-    )
     await waitFor(() => screen.getByTestId('detail-bank-account-select'))
     fireEvent.change(screen.getByTestId('detail-bank-account-select'), {
       target: { value: 'A1' },
@@ -113,16 +115,32 @@ describe('PaymentDetail', () => {
       expect(screen.getByTestId('detail-save')).not.toBeDisabled(),
     )
     fireEvent.click(screen.getByTestId('detail-save'))
-    await waitFor(() =>
-      expect(payment.entity).toBe('Music Establish (ERL)'),
-    )
+    await waitFor(() => expect(payment.identifier).toBe('A1'))
     expect(payment.method).toBe('FPS')
-    expect(payment.bankCode).toBe('001')
-    expect(payment.accountDocId).toBe('A1')
-    expect(payment.identifier).toBe('001/A1')
+    expect(payment.bankCode).toBeUndefined()
+    expect(payment.accountDocId).toBeUndefined()
     expect(payment.refNumber).toBe('REF1')
+    expect(payment.entity).toBeUndefined()
     expect(screen.queryByTestId('detail-method-select')).toBeNull()
     expect(screen.queryByTestId('detail-entity-select')).toBeNull()
+    expect(screen.getByTestId('payment-summary-block')).toBeInTheDocument()
+  })
+
+  it('renders summary block when identifier present', async () => {
+    const payment: any = { ...basePayment, identifier: 'A1', method: 'FPS', refNumber: 'R1' }
+    render(
+      <PaymentDetail
+        abbr="A"
+        account="acct"
+        payment={payment}
+        onBack={() => {}}
+      />,
+    )
+    await waitFor(() =>
+      expect(screen.getByTestId('payment-summary-block')).toBeInTheDocument(),
+    )
+    expect(screen.queryByTestId('detail-method-select')).toBeNull()
+    expect(screen.getByText(/Bank1 \(001\)/)).toBeInTheDocument()
   })
 })
 
diff --git a/components/StudentDialog/PaymentDetail.tsx b/components/StudentDialog/PaymentDetail.tsx
index a582681..586cd54 100644
--- a/components/StudentDialog/PaymentDetail.tsx
+++ b/components/StudentDialog/PaymentDetail.tsx
@@ -22,6 +22,7 @@ import {
   collection,
   Timestamp,
   deleteField,
+  getDoc,
 } from 'firebase/firestore'
 import { db } from '../../lib/firebase'
 import { formatMMMDDYYYY } from '../../lib/date'
@@ -32,7 +33,6 @@ import { minUnpaidRate } from '../../lib/billing/minUnpaidRate'
 import { paymentBlinkClass } from '../../lib/billing/paymentBlink'
 import { formatSessions } from '../../lib/billing/formatSessions'
 import { truncateList } from '../../lib/payments/truncate'
-import { normalizeIdentifier } from '../../lib/payments/format'
 import {
   patchBillingAssignedSessions,
   writeSummaryFromCache,
@@ -47,6 +47,7 @@ import {
   buildBankLabel,
   BankInfo,
   AccountInfo,
+  lookupAccount,
 } from '../../lib/erlDirectory'
 import { useSnackbar } from 'notistack'
 
@@ -98,6 +99,19 @@ export default function PaymentDetail({
   const [accountIdVal, setAccountIdVal] = useState(payment.accountDocId || '')
   const [banks, setBanks] = useState<BankInfo[]>([])
   const [accounts, setAccounts] = useState<AccountInfo[]>([])
+  const [studentName, setStudentName] = useState<{ first: string; last: string }>({
+    first: '',
+    last: '',
+  })
+  const [acctInfo, setAcctInfo] = useState<
+    | {
+        bankName: string
+        bankCode: string
+        accountType?: string
+        accountNumber?: string
+      }
+    | null
+  >(null)
   const qc = useBillingClient()
   const { data: bill } = useBilling(abbr, account)
   const [retainers, setRetainers] = useState<any[]>([])
@@ -162,13 +176,24 @@ export default function PaymentDetail({
       setAccountIdVal('')
     }
   }, [isErl, selectedBank])
+  useEffect(() => {
+    getDoc(doc(db, PATHS.student(abbr)))
+      .then((snap) => {
+        const data = snap.data() as any
+        setStudentName({ first: data?.firstName || '', last: data?.lastName || '' })
+      })
+      .catch(() => setStudentName({ first: '', last: '' }))
+  }, [abbr])
 
   useEffect(() => {
-    if (accountIdVal && process.env.NODE_ENV !== 'production') {
-      console.debug('[edit-payment] account selected', accountIdVal)
+    if (!payment.identifier) {
+      setAcctInfo(null)
+      return
     }
-  }, [accountIdVal])
-
+    lookupAccount(payment.identifier)
+      .then((info) => setAcctInfo(info))
+      .catch(() => setAcctInfo(null))
+  }, [payment.identifier])
 
   const assignedSet = new Set(assignedSessionIds)
   const allRows = bill
@@ -236,23 +261,13 @@ export default function PaymentDetail({
     )
   }
 
-  const needsCascadeInitial =
-    !payment.method ||
-    !payment.entity ||
-    ((payment.entity === 'Music Establish (ERL)' || payment.entity === 'ME-ERL') &&
-      (!payment.bankCode || !payment.accountDocId))
-  const [metaComplete, setMetaComplete] = useState(!needsCascadeInitial)
+  const [metaComplete, setMetaComplete] = useState(!!payment.identifier)
   const needsCascade = !metaComplete
 
   const needsMeta = needsCascade || !payment.refNumber
 
   useEffect(() => {
-    const init =
-      !payment.method ||
-      !payment.entity ||
-      ((payment.entity === 'Music Establish (ERL)' || payment.entity === 'ME-ERL') &&
-        (!payment.bankCode || !payment.accountDocId))
-    setMetaComplete(!init)
+    setMetaComplete(!!payment.identifier)
     setMethodVal(payment.method || '')
     setEntityVal(payment.entity || '')
     setBankCodeVal(payment.bankCode || '')
@@ -263,43 +278,29 @@ export default function PaymentDetail({
   const saveMetaDetails = async () => {
     const patch: any = {
       method: methodVal,
-      entity: entityVal,
       refNumber: refVal,
       timestamp: Timestamp.now(),
       editedBy: userEmail,
+      entity: deleteField(),
+      bankCode: deleteField(),
+      accountDocId: deleteField(),
     }
     if (isErl) {
-      if (!bankCodeVal || !accountIdVal) return
-      patch.bankCode = bankCodeVal
-      patch.accountDocId = accountIdVal
-      const id = normalizeIdentifier(
-        entityVal,
-        bankCodeVal,
-        accountIdVal,
-        payment.identifier,
-      )
-      if (id) patch.identifier = id
-    } else {
-      patch.bankCode = deleteField()
-      patch.accountDocId = deleteField()
+      if (!accountIdVal) return
+      patch.identifier = accountIdVal
+    } else if (payment.identifier) {
       patch.identifier = deleteField()
-      delete payment.bankCode
-      delete payment.accountDocId
-      delete payment.identifier
     }
     await updateDoc(doc(db, PATHS.payments(abbr), payment.id), patch)
     Object.assign(payment, {
       method: methodVal,
-      entity: entityVal,
       refNumber: refVal,
+      identifier: isErl ? accountIdVal : undefined,
     })
-    if (isErl) {
-      Object.assign(payment, {
-        bankCode: bankCodeVal,
-        accountDocId: accountIdVal,
-        identifier: patch.identifier,
-      })
-    }
+    delete payment.bankCode
+    delete payment.accountDocId
+    delete payment.entity
+    if (!isErl) delete payment.identifier
     await writeSummaryFromCache(qc, abbr, account)
     setMetaComplete(true)
   }
@@ -445,69 +446,66 @@ export default function PaymentDetail({
   return (
     <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
       <Box sx={{ flexGrow: 1, overflow: 'auto', p: 4, pb: '64px' }}>
-        <Box
-          sx={{
-            display: 'grid',
-            gridTemplateColumns: 'auto 1fr',
-            columnGap: 2,
-            rowGap: 1,
-            mb: 2,
-          }}
-        >
-          {(() => {
-            const d = payment.paymentMade?.toDate
-              ? payment.paymentMade.toDate()
-              : new Date(payment.paymentMade)
-            const fields: { label: string; value: React.ReactNode }[] = [
-              {
-                label: 'Payment Amount',
-                value: formatCurrency(amount),
-              },
-              {
-                label: 'Payment Date',
-                value: isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d),
-              },
-            ]
-            if (needsCascade) {
-              fields.push({
-                label: 'Method',
-                value: (
-                  <TextField
-                    select
-                    size="small"
-                    value={methodVal}
-                    onChange={(e) => setMethodVal(e.target.value)}
-                    inputProps={{
-                      'data-testid': 'detail-method-select',
-                      style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                    }}
-                  >
-                    {['FPS', 'Bank Transfer', 'Cheque'].map((m) => (
-                      <MenuItem key={m} value={m}>
-                        {m}
-                      </MenuItem>
-                    ))}
-                  </TextField>
-                ),
-              })
-              fields.push({
-                label: 'Entity',
-                value: (
-                  <TextField
-                    select
-                    size="small"
-                    value={entityVal}
-                    onChange={(e) => setEntityVal(e.target.value)}
-                    inputProps={{
-                      'data-testid': 'detail-entity-select',
-                      style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                    }}
-                  >
-                    <MenuItem value="Music Establish (ERL)">Music Establish (ERL)</MenuItem>
-                    <MenuItem value="Personal">Personal</MenuItem>
-                  </TextField>
-                ),
-              })
+        {needsCascade ? (
+          <Box
+            sx={{
+              display: 'grid',
+              gridTemplateColumns: 'auto 1fr',
+              columnGap: 2,
+              rowGap: 1,
+              mb: 2,
+            }}
+          >
+            {(() => {
+              const d = payment.paymentMade?.toDate
+                ? payment.paymentMade.toDate()
+                : new Date(payment.paymentMade)
+              const fields: { label: string; value: React.ReactNode }[] = [
+                { label: 'Payment Amount', value: formatCurrency(amount) },
+                {
+                  label: 'Payment Date',
+                  value: isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d),
+                },
+                {
+                  label: 'Method',
+                  value: (
+                    <TextField
+                      select
+                      size="small"
+                      value={methodVal}
+                      onChange={(e) => setMethodVal(e.target.value)}
+                      inputProps={{
+                        'data-testid': 'detail-method-select',
+                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                      }}
+                    >
+                      {['FPS', 'Bank Transfer', 'Cheque'].map((m) => (
+                        <MenuItem key={m} value={m}>
+                          {m}
+                        </MenuItem>
+                      ))}
+                    </TextField>
+                  ),
+                },
+                {
+                  label: 'Entity',
+                  value: (
+                    <TextField
+                      select
+                      size="small"
+                      value={entityVal}
+                      onChange={(e) => setEntityVal(e.target.value)}
+                      inputProps={{
+                        'data-testid': 'detail-entity-select',
+                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                      }}
+                    >
+                      <MenuItem value="Music Establish (ERL)">Music Establish (ERL)</MenuItem>
+                      <MenuItem value="Personal">Personal</MenuItem>
+                    </TextField>
+                  ),
+                },
+              ]
               if (entityVal === 'Music Establish (ERL)') {
                 fields.push({
                   label: 'Bank',
@@ -517,9 +515,7 @@ export default function PaymentDetail({
                       size="small"
                       value={selectedBank ? selectedBank.bankCode : ''}
                       onChange={(e) => {
-                        const b = banks.find(
-                          (bk) => bk.bankCode === e.target.value,
-                        )
+                        const b = banks.find((bk) => bk.bankCode === e.target.value)
                         setSelectedBank(b || null)
                       }}
                       inputProps={{
@@ -528,10 +524,7 @@ export default function PaymentDetail({
                       }}
                     >
                       {banks.map((b) => (
-                        <MenuItem
-                          key={`${b.bankName}-${b.bankCode}`}
-                          value={b.bankCode}
-                        >
+                        <MenuItem key={`${b.bankName}-${b.bankCode}`} value={b.bankCode}>
                           {buildBankLabel(b)}
                         </MenuItem>
                       ))}
@@ -560,113 +553,162 @@ export default function PaymentDetail({
                   ),
                 })
               }
-            } else {
-              fields.push({ label: 'Method', value: payment.method || 'N/A' })
-              fields.push({
-                label: 'Entity',
-                value:
-                  payment.entity === 'ME-ERL'
-                    ? 'Music Establish (ERL)'
-                    : payment.entity || 'N/A',
-              })
-              if (
-                payment.entity === 'ME-ERL' ||
-                payment.entity === 'Music Establish (ERL)'
-              ) {
+              if (sessionOrds.length) {
+                const { visible, hiddenCount } = truncateList(sessionOrds)
                 fields.push({
-                  label: 'Bank',
-                  value: buildBankLabel({
-                    bankCode: payment.bankCode,
-                    bankName:
-                      banks.find((b) => b.bankCode === payment.bankCode)?.bankName || '',
-                    rawCodeSegment: '',
-                  }),
-                })
-                fields.push({
-                  label: 'Bank Account',
-                  value: payment.accountDocId || 'N/A',
+                  label: 'For Session(s)',
+                  value: (
+                    <>
+                      {formatSessions(showAllSessions ? sessionOrds : visible)}
+                      {hiddenCount > 0 && !showAllSessions && <> … (+{hiddenCount} more)</>}
+                      {hiddenCount > 0 && (
+                        <Button
+                          size="small"
+                          onClick={() => setShowAllSessions((s) => !s)}
+                          sx={{ ml: 1 }}
+                        >
+                          {showAllSessions ? 'Hide' : 'View all'}
+                        </Button>
+                      )}
+                    </>
+                  ),
                 })
               }
-            }
-            if (sessionOrds.length) {
-              const { visible, hiddenCount } = truncateList(sessionOrds)
               fields.push({
-                label: 'For Session(s)',
+                label: 'Reference #',
                 value: (
-                  <>
-                    {formatSessions(
-                      showAllSessions ? sessionOrds : visible,
-                    )}
-                    {hiddenCount > 0 && !showAllSessions && (
-                      <> … (+{hiddenCount} more)</>
-                    )}
-                    {hiddenCount > 0 && (
-                      <Button
-                        size="small"
-                        onClick={() => setShowAllSessions((s) => !s)}
-                        sx={{ ml: 1 }}
-                      >
-                        {showAllSessions ? 'Hide' : 'View all'}
-                      </Button>
-                    )}
-                  </>
+                  <TextField
+                    size="small"
+                    value={refVal}
+                    onChange={(e) => setRefVal(e.target.value)}
+                    inputProps={{
+                      'data-testid': 'detail-ref-input',
+                      style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                    }}
+                  />
                 ),
               })
-            }
-            fields.push({
-              label: 'Reference #',
-              value: payment.refNumber ? (
-                payment.refNumber
-              ) : (
-                <TextField
-                  size="small"
-                  value={refVal}
-                  onChange={(e) => setRefVal(e.target.value)}
-                  inputProps={{
-                    'data-testid': 'detail-ref-input',
-                    style: { fontFamily: 'Newsreader', fontWeight: 500 },
-                  }}
-                />
-              ),
-            })
-            fields.push({
-              label: 'Remaining amount',
-              value: (
-                <span
-                  data-testid="remaining-amount"
-                  className={remainingClass}
-                >
-                  {formatCurrency(pendingRemaining)}
-                </span>
-              ),
-            })
-            return fields.map((f) => (
-              <React.Fragment key={f.label}>
-                <Typography
-                  variant="subtitle2"
-                  sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
-                >
-                  {f.label}:
-                </Typography>
-                <Typography
-                  variant="h6"
-                  sx={{ fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
-                >
-                  {f.value}
-                </Typography>
-              </React.Fragment>
-            ))
-          })()}
-          {bankError && (
-            <Typography
-              variant="body2"
-              color="error"
-              sx={{ gridColumn: '1 / span 2', mt: 1 }}
+              fields.push({
+                label: 'Remaining amount',
+                value: (
+                  <span data-testid="remaining-amount" className={remainingClass}>
+                    {formatCurrency(pendingRemaining)}
+                  </span>
+                ),
+              })
+              return fields.map((f) => (
+                <React.Fragment key={f.label}>
+                  <Typography
+                    variant="subtitle2"
+                    sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
+                  >
+                    {f.label}:
+                  </Typography>
+                  <Typography
+                    variant="h6"
+                    sx={{ fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
+                  >
+                    {f.value}
+                  </Typography>
+                </React.Fragment>
+              ))
+            })()}
+            {bankError && (
+              <Typography
+                variant="body2"
+                color="error"
+                sx={{ gridColumn: '1 / span 2', mt: 1 }}
+              >
+                {bankError}
+              </Typography>
+            )}
+          </Box>
+        ) : (
+          <>
+            <Box data-testid="payment-summary-block" sx={{ mb: 2 }}>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                Payment made by –
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                {(studentName.first || 'N/A')}, {(studentName.last || 'N/A')}
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                on {(() => { const d = payment.paymentMade?.toDate ? payment.paymentMade.toDate() : new Date(payment.paymentMade); return isNaN(d.getTime()) ? '-' : formatMMMDDYYYY(d) })()} thru {payment.method || 'N/A'}
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                to Establish Records Limited:
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                {(acctInfo?.bankName || 'N/A')} ({acctInfo?.bankCode || 'N/A'})
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                {acctInfo?.accountType || 'N/A'}
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                {acctInfo?.accountNumber || 'N/A'}
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                for
+              </Typography>
+              <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                {formatCurrency(amount)}
+              </Typography>
+            </Box>
+            <Box
+              sx={{
+                display: 'grid',
+                gridTemplateColumns: 'auto 1fr',
+                columnGap: 2,
+                rowGap: 1,
+                mb: 2,
+              }}
             >
-              {bankError}
-            </Typography>
-          )}
-        </Box>
+              {(() => {
+                const fields: { label: string; value: React.ReactNode }[] = []
+                fields.push({
+                  label: 'Reference #',
+                  value: payment.refNumber ? (
+                    payment.refNumber
+                  ) : (
+                    <TextField
+                      size="small"
+                      value={refVal}
+                      onChange={(e) => setRefVal(e.target.value)}
+                      inputProps={{
+                        'data-testid': 'detail-ref-input',
+                        style: { fontFamily: 'Newsreader', fontWeight: 500 },
+                      }}
+                    />
+                  ),
+                })
+                fields.push({
+                  label: 'Remaining amount',
+                  value: (
+                    <span data-testid="remaining-amount" className={remainingClass}>
+                      {formatCurrency(pendingRemaining)}
+                    </span>
+                  ),
+                })
+                return fields.map((f) => (
+                  <React.Fragment key={f.label}>
+                    <Typography
+                      variant="subtitle2"
+                      sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}
+                    >
+                      {f.label}:
+                    </Typography>
+                    <Typography
+                      variant="h6"
+                      sx={{ fontFamily: 'Newsreader', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}
+                    >
+                      {f.value}
+                    </Typography>
+                  </React.Fragment>
+                ))
+              })()}
+            </Box>
+          </>
+        )}
 
         <Typography
           variant="subtitle2"
@@ -986,9 +1028,7 @@ export default function PaymentDetail({
             <Button
               variant="contained"
               onClick={saveMetaDetails}
-              disabled={
-                !entityVal || (isErl && (!bankCodeVal || !accountIdVal))
-              }
+              disabled={!methodVal || !entityVal || (isErl && !accountIdVal)}
               data-testid="detail-save"
             >
               Save
diff --git a/components/StudentDialog/PaymentHistory.tsx b/components/StudentDialog/PaymentHistory.tsx
index 9a315c4..f5e30da 100644
--- a/components/StudentDialog/PaymentHistory.tsx
+++ b/components/StudentDialog/PaymentHistory.tsx
@@ -181,33 +181,33 @@ export default function PaymentHistory({
             <Box
               sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
             >
-              <Typography
-                variant="subtitle1"
-                sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
-              >
-                Payment History
-              </Typography>
               <Box>
+                <Typography
+                  variant="subtitle1"
+                  sx={{ fontFamily: 'Cantata One', textDecoration: 'underline' }}
+                >
+                  Payment History
+                </Typography>
                 <Tooltip title="Filter Columns">
                   <IconButton
                     aria-label="Filter Columns"
                     data-testid="filter-columns"
                     onClick={(e) => setFilterAnchor(e.currentTarget)}
-                    sx={{ mr: 1 }}
+                    sx={{ mt: 0.5 }}
                   >
                     <FilterListIcon fontSize="small" />
                   </IconButton>
                 </Tooltip>
-                <Tooltip title="Create Payment">
-                  <IconButton
-                    color="primary"
-                    onClick={() => setModalOpen(true)}
-                    aria-label="Create Payment"
-                  >
-                    <CreateIcon fontSize="small" />
-                  </IconButton>
-                </Tooltip>
               </Box>
+              <Tooltip title="Create Payment">
+                <IconButton
+                  color="primary"
+                  onClick={() => setModalOpen(true)}
+                  aria-label="Create Payment"
+                >
+                  <CreateIcon fontSize="small" />
+                </IconButton>
+              </Tooltip>
             </Box>
             <Popover
               open={Boolean(filterAnchor)}
diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
index 3bc7f17..6916cd5 100644
--- a/components/StudentDialog/PaymentModal.test.tsx
+++ b/components/StudentDialog/PaymentModal.test.tsx
@@ -66,14 +66,19 @@ describe('PaymentModal ERL cascade', () => {
       rawCodeSegment: '(001)',
     })
     fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
+    fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })
 
+    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
     fireEvent.click(getByTestId('submit-payment'))
     await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
     const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
-    expect(data.identifier).toBe('001/a1')
-    expect(data.bankCode).toBe('001')
-    expect(data.accountDocId).toBe('a1')
+    expect(data.identifier).toBe('a1')
+    expect(data.bankCode).toBeUndefined()
+    expect(data.accountDocId).toBeUndefined()
+    expect(data.method).toBe('FPS')
+    expect(data.entity).toBeUndefined()
     expect(data.editedBy).toBe('tester@example.com')
     expect(data.timestamp).toBe('now')
+    expect(data.refNumber).toBe('R1')
   })
 })
diff --git a/components/StudentDialog/PaymentModal.tsx b/components/StudentDialog/PaymentModal.tsx
index 138e0cd..35729f8 100644
--- a/components/StudentDialog/PaymentModal.tsx
+++ b/components/StudentDialog/PaymentModal.tsx
@@ -20,7 +20,7 @@ import {
   BankInfo,
   AccountInfo,
 } from '../../lib/erlDirectory'
-import { normalizeIdentifier } from '../../lib/payments/format'
+import { reducePaymentPayload } from '../../lib/payments/submit'
 import { PATHS, logPath } from '../../lib/paths'
 import { useBillingClient, billingKey } from '../../lib/billing/useBilling'
 import { writeSummaryFromCache } from '../../lib/liveRefresh'
@@ -41,13 +41,11 @@ export default function PaymentModal({
   const [madeOn, setMadeOn] = useState('')
   const [method, setMethod] = useState('')
   const [entity, setEntity] = useState('')
-  const [bankCode, setBankCode] = useState('')
   const [selectedBank, setSelectedBank] = useState<BankInfo | null>(null)
   const [accountId, setAccountId] = useState('')
   const [banks, setBanks] = useState<BankInfo[]>([])
   const [accounts, setAccounts] = useState<AccountInfo[]>([])
   const [bankError, setBankError] = useState<string | null>(null)
-  const [identifier, setIdentifier] = useState('')
   const [refNumber, setRefNumber] = useState('')
   const qc = useBillingClient()
   const isErl = entity === 'Music Establish (ERL)'
@@ -57,11 +55,9 @@ export default function PaymentModal({
 
   useEffect(() => {
     if (!isErl) {
-      setBankCode('')
       setSelectedBank(null)
       setAccountId('')
       setBankError(null)
-      setIdentifier('')
     }
   }, [isErl])
 
@@ -89,43 +85,31 @@ export default function PaymentModal({
       listAccounts(selectedBank)
         .then((a) => setAccounts(a))
         .catch(() => setAccounts([]))
-      setBankCode(selectedBank.bankCode)
     } else {
       setAccounts([])
     }
     setAccountId('')
   }, [selectedBank])
 
-  useEffect(() => {
-    if (accountId && process.env.NODE_ENV !== 'production') {
-      console.debug('[add-payment] account selected', accountId)
-    }
-  }, [accountId])
-
   const save = async () => {
     const paymentsPath = PATHS.payments(abbr)
     logPath('addPayment', paymentsPath)
     const colRef = collection(db, paymentsPath)
     const today = new Date()
     const date = madeOn ? new Date(madeOn) : today
-    const data: any = {
+    const draft: any = {
       amount: Number(amount) || 0,
       paymentMade: Timestamp.fromDate(date),
       remainingAmount: Number(amount) || 0,
       assignedSessions: [],
       assignedRetainers: [],
       method,
-      entity,
       refNumber,
       timestamp: Timestamp.now(),
       editedBy: getAuth().currentUser?.email || 'system',
+      accountDocId: isErl ? accountId : undefined,
     }
-    if (isErl) {
-      const id = normalizeIdentifier(entity, bankCode, accountId, identifier)
-      if (id) data.identifier = id
-      data.bankCode = bankCode
-      data.accountDocId = accountId
-    }
+    const data = reducePaymentPayload(draft)
     await addDoc(colRef, data)
     qc.setQueryData(billingKey(abbr, account), (prev?: any) => {
       if (!prev) return prev
@@ -202,9 +186,7 @@ export default function PaymentModal({
             const val = e.target.value
             setEntity(val)
             if (val !== 'Music Establish (ERL)') {
-              setBankCode('')
               setAccountId('')
-              setIdentifier('')
             }
           }}
           fullWidth
@@ -300,14 +282,12 @@ export default function PaymentModal({
             setMadeOn('')
             setMethod('')
             setEntity('')
-            setBankCode('')
             setSelectedBank(null)
             setAccountId('')
-            setIdentifier('')
             setRefNumber('')
             onClose()
           }}
-          disabled={!method || !entity || (isErl && (!bankCode || !accountId))}
+          disabled={!method || !entity || (isErl && !accountId)}
           data-testid="submit-payment"
         >
           Submit
diff --git a/lib/erlDirectory.test.ts b/lib/erlDirectory.test.ts
index ab4b9ac..b70d4a6 100644
--- a/lib/erlDirectory.test.ts
+++ b/lib/erlDirectory.test.ts
@@ -1,7 +1,33 @@
-import { normalizeCode, buildBankLabel } from './erlDirectory'
+import { buildAccountsPath, buildBankLabel, listBanks } from './erlDirectory'
+import { getDocs } from 'firebase/firestore'
 
-test('normalizeCode and buildBankLabel', () => {
-  expect(normalizeCode(40)).toEqual({ code: '040', raw: '(040)' })
-  expect(normalizeCode('040')).toEqual({ code: '040', raw: '(040)' })
-  expect(buildBankLabel({ bankCode: '040', bankName: 'Bank', rawCodeSegment: '(040)' })).toBe('Bank (040)')
+jest.mock('firebase/firestore', () => ({
+  initializeFirestore: jest.fn(),
+  getFirestore: jest.fn(),
+  collection: jest.fn(),
+  getDocs: jest.fn(),
+}))
+
+test('buildAccountsPath formats code with parentheses', () => {
+  expect(buildAccountsPath(40)).toEqual(['bankAccount', '(040)', 'accounts'])
+})
+
+test('buildBankLabel formats bank name and code', () => {
+  expect(
+    buildBankLabel({ bankName: 'Dah Sing Bank', bankCode: '040', rawCodeSegment: '(040)' }),
+  ).toBe('Dah Sing Bank (040)')
 })
+
+test('listBanks expands multiple codes', async () => {
+  ;(getDocs as jest.Mock).mockResolvedValueOnce({
+    docs: [
+      { id: 'b1', data: () => ({ name: 'Bank1', code: [40, 152] }) },
+    ],
+  })
+  const banks = await listBanks()
+  expect(banks).toEqual([
+    { bankCode: '040', bankName: 'Bank1', rawCodeSegment: '(040)' },
+    { bankCode: '152', bankName: 'Bank1', rawCodeSegment: '(152)' },
+  ])
+})
+
diff --git a/lib/erlDirectory.ts b/lib/erlDirectory.ts
index 2e29205..f3ffabb 100644
--- a/lib/erlDirectory.ts
+++ b/lib/erlDirectory.ts
@@ -33,72 +33,70 @@ export function normalizeCode(code: string | number): { code: string; raw: strin
   return { code: normalized, raw: `(${normalized})` }
 }
 
+export function buildAccountsPath(code: string | number): string[] {
+  const { raw } = normalizeCode(code)
+  return ['bankAccount', raw, 'accounts']
+}
+
 export async function listBanks(): Promise<BankInfo[]> {
   try {
-    const snap = await getDocs(collection(dbDirectory, 'banks'))
-    const banks = snap.docs.map((d) => {
-      const data = d.data() as any
-      const { code, raw } = normalizeCode(d.id)
-      return {
-        bankCode: code,
-        bankName: data.name || '',
-        rawCodeSegment: raw,
-      } as BankInfo
-    })
-    if (banks.length) return banks
-    throw new Error('empty banks collection')
-  } catch (e) {
-    if (process.env.NODE_ENV !== 'production') {
-      console.warn('preferred bank directory failed', e)
-    }
     const snap = await getDocs(collection(dbDirectory, 'bankAccount'))
     const banks: BankInfo[] = []
     snap.docs.forEach((d) => {
       const data = d.data() as any
-      if (!Array.isArray(data.code))
-        throw new Error(`missing code for bank ${d.id}`)
-      ;[...new Set(data.code)].forEach((c: any) => {
+      if (!Array.isArray(data.code)) return
+      data.code.forEach((c: any) => {
         const { code, raw } = normalizeCode(c)
-        banks.push({ bankCode: code, bankName: d.id, rawCodeSegment: raw })
+        banks.push({ bankCode: code, bankName: data.name || d.id, rawCodeSegment: raw })
       })
     })
-    if (!banks.length) throw new Error('empty bankAccount directory')
     return banks
+  } catch (e) {
+    if (process.env.NODE_ENV !== 'production') {
+      console.warn('bank directory failed', e)
+    }
+    return []
   }
 }
 
 export async function listAccounts(bank: BankInfo): Promise<AccountInfo[]> {
-  const res: Record<string, AccountInfo> = {}
   try {
     const snap = await getDocs(
-      collection(dbDirectory, 'banks', bank.bankCode, 'accounts'),
+      collection(dbDirectory, ...buildAccountsPath(bank.bankCode)),
     )
-    snap.docs.forEach((d) => {
-      res[d.id] = { accountDocId: d.id, ...(d.data() as any) }
-    })
+    return snap.docs.map((d) => ({ accountDocId: d.id, ...(d.data() as any) }))
   } catch (e) {
     if (process.env.NODE_ENV !== 'production') {
-      console.warn('preferred accounts failed', e)
+      console.warn('accounts load failed', e)
     }
+    return []
   }
-  try {
-    const snap = await getDocs(
-      collection(
-        dbDirectory,
-        'bankAccount',
-        bank.bankName,
-        bank.rawCodeSegment,
-      ),
-    )
-    snap.docs.forEach((d) => {
-      if (!res[d.id]) res[d.id] = { accountDocId: d.id, ...(d.data() as any) }
-    })
-  } catch (e) {
-    if (process.env.NODE_ENV !== 'production') {
-      console.warn('legacy accounts failed', e)
+}
+
+export async function lookupAccount(
+  id: string,
+): Promise<
+  | {
+      bankName: string
+      bankCode: string
+      accountType?: string
+      accountNumber?: string
     }
+  | null
+> {
+  const banks = await listBanks()
+  for (const b of banks) {
+    const accounts = await listAccounts(b)
+    const match = accounts.find((a) => a.accountDocId === id)
+    if (match)
+      return {
+        bankName: b.bankName,
+        bankCode: b.bankCode,
+        accountType: match.accountType,
+        accountNumber: match.accountNumber,
+      }
   }
-  return Object.values(res)
+  return null
 }
 
 export function buildBankLabel(b: BankInfo): string {
diff --git a/lib/payments/submit.test.ts b/lib/payments/submit.test.ts
new file mode 100644
index 0000000..9a2b0b8
--- /dev/null
+++ b/lib/payments/submit.test.ts
@@ -0,0 +1,22 @@
+import { reducePaymentPayload } from './submit'
+
+test('reducePaymentPayload strips helper fields and maps identifier', () => {
+  const input = {
+    amount: 100,
+    accountDocId: 'acc1',
+    method: 'FPS',
+    entity: 'ERL',
+    bankCode: '001',
+    refNumber: 'r1',
+  }
+  const out = reducePaymentPayload(input)
+  expect(out).toEqual({
+    amount: 100,
+    refNumber: 'r1',
+    identifier: 'acc1',
+    method: 'FPS',
+  })
+  expect(out.entity).toBeUndefined()
+  expect(out.bankCode).toBeUndefined()
+  expect(out.accountDocId).toBeUndefined()
+})
diff --git a/lib/payments/submit.ts b/lib/payments/submit.ts
new file mode 100644
index 0000000..2ad76bc
--- /dev/null
+++ b/lib/payments/submit.ts
@@ -0,0 +1,13 @@
+export interface PaymentDraft {
+  accountDocId?: string
+  entity?: string
+  bankCode?: string
+  [key: string]: any
+}
+
+export function reducePaymentPayload(draft: PaymentDraft) {
+  const { accountDocId, entity, bankCode, ...rest } = draft
+  const payload: any = { ...rest }
+  if (accountDocId) payload.identifier = accountDocId
+  return payload
+}
diff --git a/prompts/p-028-02r.md b/prompts/p-028-02r.md
new file mode 100644
index 0000000..a38318d
--- /dev/null
+++ b/prompts/p-028-02r.md
@@ -0,0 +1 @@
+# P-028-02r — Helper-only cascade (store only identifier), Bank (Code) labels, one-block “result” summary, opaque footer
diff --git a/styles/studentDialog.css b/styles/studentDialog.css
index 51986b5..1c299a5 100644
--- a/styles/studentDialog.css
+++ b/styles/studentDialog.css
@@ -133,7 +133,7 @@
   z-index: 10;
   border-top: 1px solid var(--mui-palette-divider);
   box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
-  background: var(--mui-palette-background-paper);
+  background-color: var(--mui-palette-background-paper);
 }
 
 .student-dialog-modal .MuiDialog-paper,
```
