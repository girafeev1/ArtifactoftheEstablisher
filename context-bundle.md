# PR #253 — Diff Summary

- **Base (target)**: `7b9894aa8b8fb7fe78d46cf4b6d0cf752f0ad3da`
- **Head (source)**: `a5960aac7a557d05a4dbdf62350ecef55665c58f`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	.github/workflows/deploy-to-vercel-prod.yml
M	components/SidebarLayout.tsx
M	components/clientdialog/NewClientDialog.tsx
A	components/database/ClientBankDatabasePage.tsx
M	components/projectdialog/ProjectDatabaseCreateDialog.tsx
M	components/projectdialog/ProjectDatabaseDetailContent.tsx
M	components/projectdialog/projectFormUtils.ts
M	context-bundle.md
A	docs/context/PR-253.md
A	lib/bankAccountsDirectory.ts
A	lib/clientDirectory.ts
M	package-lock.json
A	pages/api/client-directory/[clientId].ts
A	pages/api/client-directory/index.ts
A	pages/dashboard/businesses/client-accounts-database/index.tsx
A	pages/dashboard/businesses/company-bank-accounts-database/index.tsx
M	pages/dashboard/businesses/projects-database/[groupId].tsx
M	pages/dashboard/businesses/projects-database/new-window.tsx
```

## Stats

```txt
 .github/workflows/deploy-to-vercel-prod.yml        |   10 +-
 components/SidebarLayout.tsx                       |   46 +-
 components/clientdialog/NewClientDialog.tsx        |   17 +-
 components/database/ClientBankDatabasePage.tsx     |  443 ++
 .../projectdialog/ProjectDatabaseCreateDialog.tsx  |  160 +-
 .../projectdialog/ProjectDatabaseDetailContent.tsx |  145 +-
 components/projectdialog/projectFormUtils.ts       |   79 +
 context-bundle.md                                  | 7666 ++++++++++----------
 docs/context/PR-253.md                             | 4057 +++++++++++
 lib/bankAccountsDirectory.ts                       |  127 +
 lib/clientDirectory.ts                             |  220 +
 package-lock.json                                  |    2 -
 pages/api/client-directory/[clientId].ts           |   49 +
 pages/api/client-directory/index.ts                |   42 +
 .../businesses/client-accounts-database/index.tsx  |   62 +
 .../company-bank-accounts-database/index.tsx       |   62 +
 .../businesses/projects-database/[groupId].tsx     |    7 +-
 .../businesses/projects-database/new-window.tsx    |   38 +-
 18 files changed, 9287 insertions(+), 3945 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/.github/workflows/deploy-to-vercel-prod.yml b/.github/workflows/deploy-to-vercel-prod.yml
index abbe8c4..e5d0142 100644
--- a/.github/workflows/deploy-to-vercel-prod.yml
+++ b/.github/workflows/deploy-to-vercel-prod.yml
@@ -1,22 +1,20 @@
 name: Deploy to Vercel Production
 
 on:
-  pull_request:
-    types: [opened, synchronize, reopened, ready_for_review]
+  push:
+    branches: ['**']
 
 permissions:
   contents: read
   deployments: write
 
 concurrency:
-  group: vercel-prod-${{ github.event.pull_request.number }}
+  group: vercel-prod-${{ github.ref }}
   cancel-in-progress: true
 
 jobs:
   deploy:
-    if: >-
-      github.event.pull_request.head.repo.full_name == github.repository &&
-      github.event.pull_request.draft == false
+    if: github.event_name == 'push'
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@v4
diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
index 3ba283a..4e66713 100644
--- a/components/SidebarLayout.tsx
+++ b/components/SidebarLayout.tsx
@@ -77,25 +77,33 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
               </Link>
             </MenuItem>
           </Menu>
-          <Button fullWidth onClick={handleDatabaseClick} sx={{ justifyContent: 'flex-start', mb: 1 }}>
-            Database
-          </Button>
-          <Menu anchorEl={databaseAnchorEl} open={Boolean(databaseAnchorEl)} onClose={handleDatabaseClose}>
-            <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
-              <Link href="/dashboard/database?view=clients" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
-                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
-                  Client Accounts
-                </Button>
-              </Link>
-            </MenuItem>
-            <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
-              <Link href="/dashboard/database?view=bank" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
-                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
-                  Company Bank Accounts
-                </Button>
-              </Link>
-            </MenuItem>
-          </Menu>
+        <Button fullWidth onClick={handleDatabaseClick} sx={{ justifyContent: 'flex-start', mb: 1 }}>
+          Database
+        </Button>
+        <Menu anchorEl={databaseAnchorEl} open={Boolean(databaseAnchorEl)} onClose={handleDatabaseClose}>
+          <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
+            <Link
+              href="/dashboard/businesses/client-accounts-database"
+              passHref
+              style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
+            >
+              <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
+                Client Accounts
+              </Button>
+            </Link>
+          </MenuItem>
+          <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
+            <Link
+              href="/dashboard/businesses/company-bank-accounts-database"
+              passHref
+              style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
+            >
+              <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
+                Company Bank Accounts
+              </Button>
+            </Link>
+          </MenuItem>
+        </Menu>
         </Box>
         <Button color="secondary" onClick={() => signOut()} sx={{ mt: 3, justifyContent: 'flex-start' }}>
           Sign Out
diff --git a/components/clientdialog/NewClientDialog.tsx b/components/clientdialog/NewClientDialog.tsx
index 93e3c87..eadb78a 100644
--- a/components/clientdialog/NewClientDialog.tsx
+++ b/components/clientdialog/NewClientDialog.tsx
@@ -52,10 +52,23 @@ export default function NewClientDialog({ open, onClose, onSubmitted }: NewClien
 
   const handleSubmit = async () => {
     try {
-      const resp = await fetch('/api/clients', {
+      const resp = await fetch('/api/client-directory', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
-        body: JSON.stringify({ data: newClient }),
+        body: JSON.stringify({
+          client: {
+            companyName: newClient.companyName,
+            title: newClient.title,
+            nameAddressed: newClient.nameAddressed,
+            emailAddress: newClient.emailAddress,
+            addressLine1: newClient.addressLine1,
+            addressLine2: newClient.addressLine2,
+            addressLine3: newClient.addressLine3,
+            addressLine4: newClient.addressLine4,
+            addressLine5: newClient.addressLine5,
+            name: newClient.nameAddressed,
+          },
+        }),
       });
       if (!resp.ok) {
         const errJson = await resp.json().catch(() => ({}));
diff --git a/components/database/ClientBankDatabasePage.tsx b/components/database/ClientBankDatabasePage.tsx
new file mode 100644
index 0000000..62dbf53
--- /dev/null
+++ b/components/database/ClientBankDatabasePage.tsx
@@ -0,0 +1,443 @@
+import { useEffect, useMemo, useState } from 'react'
+import { useRouter } from 'next/router'
+
+import SidebarLayout from '../SidebarLayout'
+import ViewClientDialog from '../clientdialog/ViewClientDialog'
+import EditClientDialog, { type Client as EditDialogClient } from '../clientdialog/EditClientDialog'
+import NewClientDialog from '../clientdialog/NewClientDialog'
+
+import {
+  Alert,
+  Accordion,
+  AccordionSummary,
+  AccordionDetails,
+  Box,
+  Button,
+  Chip,
+  List,
+  ListItem,
+  ListItemButton,
+  ListItemText,
+  ToggleButton,
+  ToggleButtonGroup,
+  Typography,
+} from '@mui/material'
+import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
+
+import type { ClientDirectoryRecord } from '../../lib/clientDirectory'
+import type { BankAccountDirectoryRecord } from '../../lib/bankAccountsDirectory'
+
+interface ClientBankDatabasePageProps {
+  clients: ClientDirectoryRecord[]
+  bankAccounts: BankAccountDirectoryRecord[]
+  initialView: 'clients' | 'bank'
+  error?: string
+}
+
+const convertToClientDetails = (record: ClientDirectoryRecord) => {
+  const title = record.title ?? ''
+  const nameAddressed = record.nameAddressed ?? record.name ?? ''
+  const cleanedTitle = title && nameAddressed.toLowerCase().startsWith(title.toLowerCase()) ? '' : title
+
+  return {
+    companyName: record.companyName,
+    title: cleanedTitle,
+    nameAddressed,
+    emailAddress: record.emailAddress ?? '',
+    addressLine1: record.addressLine1 ?? '',
+    addressLine2: record.addressLine2 ?? '',
+    addressLine3: record.addressLine3 ?? '',
+    addressLine4: record.addressLine4 ?? '',
+    addressLine5: record.addressLine5 ?? record.region ?? '',
+  }
+}
+
+const convertToEditClient = (record: ClientDirectoryRecord): EditDialogClient => ({
+  companyName: record.companyName,
+  title: record.title ?? 'Mr.',
+  nameAddressed: record.nameAddressed ?? record.name ?? '',
+  emailAddress: record.emailAddress ?? '',
+  addressLine1: record.addressLine1 ?? '',
+  addressLine2: record.addressLine2 ?? '',
+  addressLine3: record.addressLine3 ?? '',
+  addressLine4: record.addressLine4 ?? '',
+  addressLine5: record.addressLine5 ?? record.region ?? 'Kowloon',
+})
+
+const formatBankName = (name: string) =>
+  name.split(/(-|\s+)/).map((segment, index) => {
+    if (segment === '-') {
+      return (
+        <span key={`hyphen-${index}`} className='federo-text' style={{ margin: '0 6px' }}>
+          -
+        </span>
+      )
+    }
+    if (segment.trim().length === 0) {
+      return (
+        <span key={`space-${index}`} className='federo-text'>
+          {segment}
+        </span>
+      )
+    }
+    return (
+      <span key={`word-${index}`} className='federo-text' style={{ marginRight: 6 }}>
+        {segment.split('').map((char, charIndex) => (
+          <span key={`char-${index}-${charIndex}`} style={charIndex === 0 ? { fontWeight: 700 } : undefined}>
+            {char}
+          </span>
+        ))}
+      </span>
+    )
+  })
+
+const getContactSecondary = (client: ClientDirectoryRecord) => {
+  const contact = [client.title, client.nameAddressed ?? client.name]
+    .filter(Boolean)
+    .join(' ')
+    .trim()
+
+  const email = client.emailAddress ?? 'N/A'
+  return contact ? `${contact} - ${email}` : `N/A - ${email}`
+}
+
+const getStatusChip = (active: boolean | null) => {
+  if (active === null) {
+    return null
+  }
+  return (
+    <Chip
+      size='small'
+      label={active ? 'Active' : 'Inactive'}
+      sx={{
+        bgcolor: active ? 'rgba(76, 175, 80, 0.18)' : 'rgba(244, 67, 54, 0.18)',
+        color: active ? 'success.main' : 'error.main',
+        border: '1px solid',
+        borderColor: active ? 'success.light' : 'error.light',
+      }}
+    />
+  )
+}
+
+export function ClientBankDatabasePage({
+  clients,
+  bankAccounts,
+  initialView,
+  error,
+}: ClientBankDatabasePageProps) {
+  const router = useRouter()
+  const [view, setView] = useState<'clients' | 'bank'>(initialView)
+  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
+  const [filteredClients, setFilteredClients] = useState<ClientDirectoryRecord[]>(clients)
+  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRecord | null>(null)
+  const [editableClient, setEditableClient] = useState<EditDialogClient | null>(null)
+  const [editingClientId, setEditingClientId] = useState<string | null>(null)
+  const [viewDialogOpen, setViewDialogOpen] = useState(false)
+  const [editDialogOpen, setEditDialogOpen] = useState(false)
+  const [addDialogOpen, setAddDialogOpen] = useState(false)
+
+  useEffect(() => {
+    setView(initialView)
+  }, [initialView])
+
+  useEffect(() => {
+    if (view === 'bank') {
+      setSelectedLetter(null)
+    }
+  }, [view])
+
+  const uniqueLetters = useMemo(
+    () => Array.from(new Set(clients.map((client) => client.companyName.charAt(0).toUpperCase()))).sort(),
+    [clients]
+  )
+
+  useEffect(() => {
+    if (selectedLetter) {
+      setFilteredClients(
+        clients.filter((client) => client.companyName.charAt(0).toUpperCase() === selectedLetter)
+      )
+    } else {
+      setFilteredClients(clients)
+    }
+  }, [selectedLetter, clients])
+
+  const groupedBankAccounts = useMemo(() => {
+    const map = new Map<
+      string,
+      {
+        bankName: string
+        bankCode: string | null
+        entries: BankAccountDirectoryRecord[]
+        active: boolean
+      }
+    >()
+
+    bankAccounts.forEach((account) => {
+      const key = `${account.bankName}__${account.bankCode ?? 'unknown'}`
+      if (!map.has(key)) {
+        map.set(key, {
+          bankName: account.bankName,
+          bankCode: account.bankCode,
+          entries: [],
+          active: false,
+        })
+      }
+      const bucket = map.get(key)!
+      bucket.entries.push(account)
+      if (account.status === true) {
+        bucket.active = true
+      }
+    })
+
+    return Array.from(map.values()).sort((a, b) => {
+      if (a.active !== b.active) {
+        return a.active ? -1 : 1
+      }
+      const codeA = a.bankCode ? Number(a.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
+      const codeB = b.bankCode ? Number(b.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
+      if (codeA !== codeB) {
+        return codeA - codeB
+      }
+      return a.bankName.localeCompare(b.bankName)
+    })
+  }, [bankAccounts])
+
+  const handleToggleView = (newView: 'clients' | 'bank') => {
+    setView(newView)
+  }
+
+  const handleClientClick = (client: ClientDirectoryRecord) => {
+    setSelectedClient(client)
+    setViewDialogOpen(true)
+  }
+
+  const handleCloseViewDialog = () => {
+    setViewDialogOpen(false)
+    setSelectedClient(null)
+  }
+
+  const handleEditFromView = () => {
+    if (!selectedClient) return
+    setViewDialogOpen(false)
+    setEditableClient(convertToEditClient(selectedClient))
+    setEditingClientId(selectedClient.companyName)
+    setEditDialogOpen(true)
+  }
+
+  const handleCloseEditDialog = () => {
+    setEditDialogOpen(false)
+    setEditableClient(null)
+    setSelectedClient(null)
+    setEditingClientId(null)
+  }
+
+  const handleClientChange = (client: EditDialogClient) => {
+    setEditableClient(client)
+  }
+
+  const handleSaveClient = async () => {
+    if (!editableClient || !editingClientId) {
+      return
+    }
+
+    try {
+      const payload = {
+        ...editableClient,
+        name: editableClient.nameAddressed,
+      }
+
+      const response = await fetch(`/api/client-directory/${encodeURIComponent(editingClientId)}`, {
+        method: 'PATCH',
+        headers: { 'Content-Type': 'application/json' },
+        body: JSON.stringify({ updates: payload }),
+      })
+
+      if (!response.ok) {
+        const payload = await response.json().catch(() => ({}))
+        throw new Error(payload.error || 'Failed to update client')
+      }
+
+      setEditDialogOpen(false)
+      setEditableClient(null)
+      setSelectedClient(null)
+      setEditingClientId(null)
+      router.replace(router.asPath)
+      alert('Client updated successfully')
+    } catch (err) {
+      console.error('[ClientBankDatabasePage] failed to update client:', err)
+      alert(err instanceof Error ? err.message : 'Failed to update client')
+    }
+  }
+
+  const handleOpenAddDialog = () => {
+    setAddDialogOpen(true)
+  }
+
+  const handleCloseAddDialog = () => {
+    setAddDialogOpen(false)
+  }
+
+  const handleNewClientSubmitted = () => {
+    setAddDialogOpen(false)
+    router.replace(router.asPath)
+  }
+
+  return (
+    <SidebarLayout>
+      <Box
+        sx={{
+          display: 'flex',
+          justifyContent: 'space-between',
+          alignItems: 'center',
+          flexWrap: 'wrap',
+          gap: 2,
+          mb: 2,
+        }}
+      >
+        <Typography variant='h4'>
+          {view === 'clients' ? 'Client Accounts (Database)' : 'Company Bank Accounts (Database)'}
+        </Typography>
+        {view === 'clients' && (
+          <Button variant='contained' onClick={handleOpenAddDialog}>
+            Add Client
+          </Button>
+        )}
+      </Box>
+      {error && (
+        <Alert severity='error' sx={{ mb: 2 }}>
+          Error: {error}
+        </Alert>
+      )}
+      <ToggleButtonGroup
+        exclusive
+        value={view}
+        onChange={(event, value) => {
+          if (value) {
+            handleToggleView(value)
+          }
+        }}
+        sx={{ mb: 2 }}
+      >
+        <ToggleButton value='clients'>Client Accounts</ToggleButton>
+        <ToggleButton value='bank'>Company Bank Accounts</ToggleButton>
+      </ToggleButtonGroup>
+
+      {view === 'clients' ? (
+        <Box>
+          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
+            {uniqueLetters.map((letter) => (
+              <Button
+                key={letter}
+                variant={selectedLetter === letter ? 'contained' : 'outlined'}
+                onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
+              >
+                {letter}
+              </Button>
+            ))}
+          </Box>
+          {filteredClients.length === 0 ? (
+            <Typography>No client data found.</Typography>
+          ) : (
+            <List>
+              {filteredClients.map((entry, idx) => (
+                <ListItem key={`${entry.companyName}-${idx}`} disablePadding>
+                  <ListItemButton onClick={() => handleClientClick(entry)}>
+                    <ListItemText
+                      primary={entry.companyName}
+                      secondary={getContactSecondary(entry)}
+                    />
+                  </ListItemButton>
+                </ListItem>
+              ))}
+            </List>
+          )}
+        </Box>
+      ) : groupedBankAccounts.length === 0 ? (
+        <Typography>No bank accounts found.</Typography>
+      ) : (
+        groupedBankAccounts.map((group) => (
+          <Accordion key={`${group.bankName}-${group.bankCode ?? 'unknown'}`} sx={{ mb: 2 }}>
+            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
+              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
+                <Typography
+                  variant='h5'
+                  component='div'
+                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
+                >
+                  {formatBankName(group.bankName)}
+                  {group.bankCode && (
+                    <Typography
+                      variant='h6'
+                      component='span'
+                      color='text.secondary'
+                      sx={{ fontSize: '0.7em' }}
+                    >
+                      {group.bankCode}
+                    </Typography>
+                  )}
+                </Typography>
+                {getStatusChip(group.active)}
+              </Box>
+            </AccordionSummary>
+            <AccordionDetails>
+              {group.entries
+                .slice()
+                .sort((a, b) => {
+                  if (a.status !== b.status) {
+                    return (b.status ? 1 : 0) - (a.status ? 1 : 0)
+                  }
+                  return a.accountId.localeCompare(b.accountId)
+                })
+                .map((entry) => (
+                  <Box
+                    key={entry.accountId}
+                    sx={{
+                      mb: 2,
+                      p: 2,
+                      border: '1px solid',
+                      borderColor: 'divider',
+                      borderRadius: 1,
+                      display: 'flex',
+                      flexDirection: 'column',
+                      gap: 1,
+                    }}
+                  >
+                    <Typography variant='h6'>
+                      {entry.accountType ? `${entry.accountType} Account` : 'Account'}
+                    </Typography>
+                    <Typography variant='body1'>
+                      {entry.accountNumber ?? 'Account number unavailable'}
+                    </Typography>
+                    <Typography variant='body2'>FPS ID: {entry.fpsId ?? 'N/A'}</Typography>
+                    <Typography variant='body2'>FPS Email: {entry.fpsEmail ?? 'N/A'}</Typography>
+                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
+                      <Chip label={entry.accountId} size='small' variant='outlined' />
+                    </Box>
+                  </Box>
+                ))}
+            </AccordionDetails>
+          </Accordion>
+        ))
+      )}
+
+      <ViewClientDialog
+        open={viewDialogOpen}
+        onClose={handleCloseViewDialog}
+        client={selectedClient ? convertToClientDetails(selectedClient) : null}
+        onEdit={handleEditFromView}
+      />
+      {editableClient && (
+        <EditClientDialog
+          open={editDialogOpen}
+          onClose={handleCloseEditDialog}
+          client={editableClient}
+          onClientChange={handleClientChange}
+          onSave={async () => handleSaveClient()}
+        />
+      )}
+      <NewClientDialog open={addDialogOpen} onClose={handleCloseAddDialog} onSubmitted={handleNewClientSubmitted} />
+    </SidebarLayout>
+  )
+}
+
+export default ClientBankDatabasePage
diff --git a/components/projectdialog/ProjectDatabaseCreateDialog.tsx b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
index 8152e21..c11fd9e 100644
--- a/components/projectdialog/ProjectDatabaseCreateDialog.tsx
+++ b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
@@ -19,7 +19,11 @@ import OpenInNewIcon from '@mui/icons-material/OpenInNew'
 
 import ProjectDatabaseWindow from './ProjectDatabaseWindow'
 import type { ProjectRecord } from '../../lib/projectsDatabase'
-import { sanitizeText, toIsoUtcStringOrNull } from './projectFormUtils'
+import {
+  generateSequentialProjectNumber,
+  sanitizeText,
+  toIsoUtcStringOrNull,
+} from './projectFormUtils'
 
 interface ProjectDatabaseCreateDialogProps {
   open: boolean
@@ -27,6 +31,7 @@ interface ProjectDatabaseCreateDialogProps {
   onClose: () => void
   onCreated: (created?: ProjectRecord) => void
   onDetach?: () => void
+  existingProjectNumbers: readonly string[]
 }
 
 interface ProjectDatabaseCreateFormProps {
@@ -37,6 +42,7 @@ interface ProjectDatabaseCreateFormProps {
   variant: 'dialog' | 'page'
   resetToken?: unknown
   onBusyChange?: (busy: boolean) => void
+  existingProjectNumbers: readonly string[]
 }
 
 interface FormState {
@@ -77,16 +83,40 @@ export function ProjectDatabaseCreateForm({
   variant,
   resetToken,
   onBusyChange,
+  existingProjectNumbers,
 }: ProjectDatabaseCreateFormProps) {
   const [form, setForm] = useState<FormState>(EMPTY_FORM)
   const [saving, setSaving] = useState(false)
   const [error, setError] = useState<string | null>(null)
+  const [editingProjectNumber, setEditingProjectNumber] = useState(false)
+
+  const normalizedProjectNumbers = useMemo(
+    () => {
+      const trimmed = existingProjectNumbers
+        .map((value) => value.trim())
+        .filter((value) => value.length > 0)
+      return Array.from(new Set(trimmed))
+    },
+    [existingProjectNumbers]
+  )
+
+  const defaultProjectNumber = useMemo(
+    () => generateSequentialProjectNumber(year, normalizedProjectNumbers),
+    [year, normalizedProjectNumbers]
+  )
+
+  const defaultSubsidiary = 'Establish Records Limited'
 
   useEffect(() => {
-    setForm(EMPTY_FORM)
+    setForm({
+      ...EMPTY_FORM,
+      projectNumber: defaultProjectNumber,
+      subsidiary: defaultSubsidiary,
+    })
     setError(null)
     setSaving(false)
-  }, [resetToken])
+    setEditingProjectNumber(false)
+  }, [resetToken, defaultProjectNumber, defaultSubsidiary])
 
   useEffect(() => {
     onBusyChange?.(saving)
@@ -99,10 +129,31 @@ export function ProjectDatabaseCreateForm({
       setForm((prev) => ({ ...prev, [field]: event.target.value }))
     }
 
+  const updateProjectNumber = (value: string) => {
+    setForm((prev) => ({ ...prev, projectNumber: value }))
+  }
+
   const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
     setForm((prev) => ({ ...prev, paid: checked }))
   }
 
+  const commitProjectNumber = () => {
+    const trimmed = form.projectNumber.trim()
+    updateProjectNumber(trimmed.length > 0 ? trimmed : defaultProjectNumber)
+    setEditingProjectNumber(false)
+  }
+
+  const handleProjectNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
+    if (event.key === 'Enter') {
+      event.preventDefault()
+      commitProjectNumber()
+    } else if (event.key === 'Escape') {
+      event.preventDefault()
+      updateProjectNumber(defaultProjectNumber)
+      setEditingProjectNumber(false)
+    }
+  }
+
   const handleSubmit = async () => {
     if (!year) {
       setError('Select a year before creating a project')
@@ -184,7 +235,7 @@ export function ProjectDatabaseCreateForm({
   }
 
   return (
-    <Stack spacing={2}>
+    <Stack spacing={2} sx={{ width: '100%', maxWidth: 640, mx: 'auto' }}>
       <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
         <Box>
           <Typography variant="h5" sx={{ fontFamily: 'Cantata One' }}>
@@ -209,29 +260,36 @@ export function ProjectDatabaseCreateForm({
           </IconButton>
         </Stack>
       </Stack>
-      {year && (
-        <Chip label={year} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }} />
-      )}
-      <Divider />
-      {error && <Alert severity="error">{error}</Alert>}
-      <Grid container spacing={2}>
-        <Grid item xs={12} sm={6}>
+      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
+        {editingProjectNumber ? (
           <TextField
-            label="Project Number"
             value={form.projectNumber}
-            onChange={handleChange('projectNumber')}
-            fullWidth
-            required
+            onChange={(event) => updateProjectNumber(event.target.value)}
+            onBlur={commitProjectNumber}
+            onKeyDown={handleProjectNumberKeyDown}
+            size="small"
+            autoFocus
+            label="Project Number"
+            sx={{ minWidth: 160 }}
           />
-        </Grid>
-        <Grid item xs={12} sm={6}>
-          <TextField
-            label="Client Company"
-            value={form.clientCompany}
-            onChange={handleChange('clientCompany')}
-            fullWidth
+        ) : (
+          <Chip
+            label={form.projectNumber || defaultProjectNumber}
+            variant="outlined"
+            onClick={() => setEditingProjectNumber(true)}
+            sx={{ cursor: 'pointer' }}
           />
-        </Grid>
+        )}
+        <Chip
+          label={form.subsidiary || defaultSubsidiary}
+          color="primary"
+          variant="outlined"
+          size="small"
+        />
+      </Stack>
+      <Divider />
+      {error && <Alert severity="error">{error}</Alert>}
+      <Grid container spacing={2}>
         <Grid item xs={12}>
           <TextField
             label="Project Title"
@@ -240,7 +298,7 @@ export function ProjectDatabaseCreateForm({
             fullWidth
           />
         </Grid>
-        <Grid item xs={12}>
+        <Grid item xs={12} sm={6}>
           <TextField
             label="Project Nature"
             value={form.projectNature}
@@ -258,9 +316,9 @@ export function ProjectDatabaseCreateForm({
         </Grid>
         <Grid item xs={12} sm={6}>
           <TextField
-            label="Subsidiary"
-            value={form.subsidiary}
-            onChange={handleChange('subsidiary')}
+            label="Client Company"
+            value={form.clientCompany}
+            onChange={handleChange('clientCompany')}
             fullWidth
           />
         </Grid>
@@ -274,17 +332,6 @@ export function ProjectDatabaseCreateForm({
             InputLabelProps={{ shrink: true }}
           />
         </Grid>
-        <Grid item xs={12} sm={6}>
-          <TextField
-            label="Paid On"
-            type="date"
-            value={form.onDate}
-            onChange={handleChange('onDate')}
-            fullWidth
-            InputLabelProps={{ shrink: true }}
-            disabled={!form.paid}
-          />
-        </Grid>
         <Grid item xs={12} sm={6}>
           <TextField
             label="Amount"
@@ -303,17 +350,38 @@ export function ProjectDatabaseCreateForm({
         </Grid>
         <Grid item xs={12} sm={6}>
           <TextField
-            label="Pay To"
-            value={form.paidTo}
-            onChange={handleChange('paidTo')}
+            label="Paid On"
+            type="date"
+            value={form.onDate}
+            onChange={handleChange('onDate')}
             fullWidth
+            InputLabelProps={{ shrink: true }}
             disabled={!form.paid}
           />
         </Grid>
         <Grid item xs={12} sm={6}>
-          <FormControlLabel
-            control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
-            label="Paid"
+          <Box
+            sx={{
+              height: '100%',
+              display: 'flex',
+              alignItems: { xs: 'flex-start', sm: 'center' },
+              justifyContent: { xs: 'flex-start', sm: 'flex-start' },
+              pt: { xs: 1.5, sm: 0 },
+            }}
+          >
+            <FormControlLabel
+              control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
+              label="Paid"
+            />
+          </Box>
+        </Grid>
+        <Grid item xs={12}>
+          <TextField
+            label="Pay To"
+            value={form.paidTo}
+            onChange={handleChange('paidTo')}
+            fullWidth
+            disabled={!form.paid}
           />
         </Grid>
       </Grid>
@@ -336,6 +404,7 @@ export default function ProjectDatabaseCreateDialog({
   onClose,
   onCreated,
   onDetach,
+  existingProjectNumbers,
 }: ProjectDatabaseCreateDialogProps) {
   const [busy, setBusy] = useState(false)
 
@@ -347,7 +416,7 @@ export default function ProjectDatabaseCreateDialog({
     <ProjectDatabaseWindow
       open={open}
       onClose={busy ? () => {} : onClose}
-      contentSx={{ p: { xs: 2.5, sm: 3 } }}
+      contentSx={{ p: { xs: 2.5, sm: 3 }, maxWidth: 640, mx: 'auto' }}
     >
       <ProjectDatabaseCreateForm
         year={year}
@@ -357,6 +426,7 @@ export default function ProjectDatabaseCreateDialog({
         variant="dialog"
         resetToken={open}
         onBusyChange={setBusy}
+        existingProjectNumbers={existingProjectNumbers}
       />
     </ProjectDatabaseWindow>
   )
diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
index e136869..417bafe 100644
--- a/components/projectdialog/ProjectDatabaseDetailContent.tsx
+++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
@@ -1,4 +1,4 @@
-import { useMemo } from 'react'
+import { useEffect, useMemo, useState } from 'react'
 
 import {
   Box,
@@ -12,12 +12,38 @@ import {
 import CloseIcon from '@mui/icons-material/Close'
 import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
 import { Cormorant_Infant } from 'next/font/google'
+import { fetchBankAccountsDirectory, buildBankAccountLabel } from '../../lib/bankAccountsDirectory'
 
 import type { ProjectRecord } from '../../lib/projectsDatabase'
 import type { ReactNode } from 'react'
 
 const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
 
+interface TextSegment {
+  text: string
+  isCjk: boolean
+}
+
+const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
+
+const splitByCjkSegments = (value: string | null | undefined): TextSegment[] => {
+  if (!value) {
+    return []
+  }
+
+  const segments: TextSegment[] = []
+  for (const char of Array.from(value)) {
+    const isCjk = CJK_REGEX.test(char)
+    const last = segments[segments.length - 1]
+    if (last && last.isCjk === isCjk) {
+      last.text += char
+    } else {
+      segments.push({ text: char, isCjk })
+    }
+  }
+  return segments
+}
+
 const textOrNA = (value: string | null | undefined) =>
   value && value.trim().length > 0 ? value : 'N/A'
 
@@ -42,6 +68,30 @@ const valueSx = {
   lineHeight: 1.3,
 } as const
 
+let bankAccountLabelCache: Map<string, string> | null = null
+let bankAccountLabelPromise: Promise<Map<string, string>> | null = null
+
+const getBankAccountLabelMap = async (): Promise<Map<string, string>> => {
+  if (bankAccountLabelCache) {
+    return bankAccountLabelCache
+  }
+  if (!bankAccountLabelPromise) {
+    bankAccountLabelPromise = fetchBankAccountsDirectory().then((records) => {
+      const map = new Map<string, string>()
+      records.forEach((record) => {
+        map.set(record.accountId, buildBankAccountLabel(record))
+      })
+      bankAccountLabelCache = map
+      return map
+    })
+  }
+  return bankAccountLabelPromise
+}
+
+if (typeof window !== 'undefined') {
+  void getBankAccountLabelMap()
+}
+
 interface ProjectDatabaseDetailContentProps {
   project: ProjectRecord
   headerActions?: ReactNode
@@ -55,6 +105,48 @@ export default function ProjectDatabaseDetailContent({
   onClose,
   onEdit,
 }: ProjectDatabaseDetailContentProps) {
+  const [payToLabel, setPayToLabel] = useState<string | null>(() =>
+    project.paidTo && bankAccountLabelCache?.has(project.paidTo)
+      ? bankAccountLabelCache.get(project.paidTo) ?? null
+      : null
+  )
+
+  useEffect(() => {
+    let cancelled = false
+
+    const load = async () => {
+      if (!project.paidTo) {
+        if (!cancelled) {
+          setPayToLabel(null)
+        }
+        return
+      }
+
+      if (bankAccountLabelCache?.has(project.paidTo)) {
+        setPayToLabel(bankAccountLabelCache.get(project.paidTo) ?? null)
+        return
+      }
+
+      try {
+        const map = await getBankAccountLabelMap()
+        if (!cancelled) {
+          setPayToLabel(map.get(project.paidTo) ?? null)
+        }
+      } catch (err) {
+        console.error('[ProjectDatabaseDetailContent] failed to load bank account labels:', err)
+        if (!cancelled) {
+          setPayToLabel(null)
+        }
+      }
+    }
+
+    load()
+
+    return () => {
+      cancelled = true
+    }
+  }, [project.paidTo])
+
   const detailItems = useMemo(() => {
     const invoiceValue: ReactNode = project.invoice
       ? project.invoice.startsWith('http')
@@ -83,20 +175,20 @@ export default function ProjectDatabaseDetailContent({
         label: 'Paid On',
         value: project.paid ? project.onDateDisplay ?? '-' : '-',
       },
-      { label: 'Pay To', value: textOrNA(project.paidTo) },
+      {
+        label: 'Pay To',
+        value: payToLabel ?? textOrNA(project.paidTo),
+      },
       { label: 'Invoice', value: invoiceValue },
     ] satisfies Array<{ label: string; value: ReactNode }>
-  }, [project])
+  }, [payToLabel, project])
 
-  const rawPresenter = textOrNA(project.presenterWorkType)
-  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
-  const hasCjkCharacters = (value: string | null | undefined) =>
-    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
+  const presenterBase = textOrNA(project.presenterWorkType)
+  const presenterText = presenterBase === 'N/A' ? presenterBase : `${presenterBase} -`
+  const presenterSegments = splitByCjkSegments(presenterText)
 
-  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
-  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
-
-  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
+  const projectTitleText = textOrNA(project.projectTitle)
+  const titleSegments = splitByCjkSegments(projectTitleText)
 
   return (
     <Stack spacing={1.2}>
@@ -121,19 +213,32 @@ export default function ProjectDatabaseDetailContent({
               </IconButton>
             )}
           </Stack>
-          <Typography
-            variant='subtitle1'
-            sx={{ color: 'text.primary' }}
-            className={presenterClassName}
-          >
-            {presenterText}
+          <Typography variant='subtitle1' sx={{ color: 'text.primary' }}>
+            {presenterSegments.length === 0
+              ? presenterText
+              : presenterSegments.map((segment, index) => (
+                  <span
+                    key={`presenter-segment-${index}`}
+                    className={segment.isCjk ? 'iansui-text' : 'federo-text'}
+                  >
+                    {segment.text}
+                  </span>
+                ))}
           </Typography>
           <Typography
             variant='h4'
-            className={hasCjkInTitle ? 'yuji-title' : undefined}
-            sx={{ fontFamily: hasCjkInTitle ? undefined : 'Cantata One', lineHeight: 1.2 }}
+            sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}
           >
-            {textOrNA(project.projectTitle)}
+            {titleSegments.length === 0
+              ? projectTitleText
+              : titleSegments.map((segment, index) => (
+                  <span
+                    key={`title-segment-${index}`}
+                    className={segment.isCjk ? 'yuji-title' : undefined}
+                  >
+                    {segment.text}
+                  </span>
+                ))}
           </Typography>
           <Typography variant='body1' color='text.secondary'>
             {textOrNA(project.projectNature)}
diff --git a/components/projectdialog/projectFormUtils.ts b/components/projectdialog/projectFormUtils.ts
index 0e0a19a..6dfc761 100644
--- a/components/projectdialog/projectFormUtils.ts
+++ b/components/projectdialog/projectFormUtils.ts
@@ -15,3 +15,82 @@ export const sanitizeText = (value: string) => {
   const trimmed = value.trim()
   return trimmed.length === 0 ? null : trimmed
 }
+
+interface SequenceCandidate {
+  original: string
+  prefix: string
+  value: number
+  width: number
+  matchesYear: boolean
+}
+
+const extractSequence = (text: string): Omit<SequenceCandidate, 'matchesYear'> | null => {
+  const match = text.match(/(\d+)(?!.*\d)/)
+  if (!match || match.index === undefined) {
+    return null
+  }
+  const digits = match[1]
+  const prefix = text.slice(0, match.index)
+  const value = Number.parseInt(digits, 10)
+  if (Number.isNaN(value)) {
+    return null
+  }
+  return {
+    original: text,
+    prefix,
+    value,
+    width: digits.length,
+  }
+}
+
+export const generateSequentialProjectNumber = (
+  year: string | null,
+  existingNumbers: readonly string[]
+): string => {
+  const trimmedYear = year?.trim() ?? ''
+  const cleaned = existingNumbers
+    .map((value) => value?.trim())
+    .filter((value): value is string => Boolean(value))
+
+  const parsed = cleaned
+    .map((value) => {
+      const sequence = extractSequence(value)
+      if (!sequence) {
+        return null
+      }
+      return {
+        ...sequence,
+        matchesYear:
+          trimmedYear.length > 0 &&
+          (value.startsWith(trimmedYear) || sequence.prefix.includes(trimmedYear)),
+      } satisfies SequenceCandidate
+    })
+    .filter((candidate): candidate is SequenceCandidate => Boolean(candidate))
+
+  const chooseCandidate = (candidates: SequenceCandidate[]): SequenceCandidate | null => {
+    if (candidates.length === 0) {
+      return null
+    }
+    return candidates.reduce((highest, current) =>
+      current.value > highest.value ? current : highest
+    )
+  }
+
+  const preferred = trimmedYear.length
+    ? chooseCandidate(parsed.filter((candidate) => candidate.matchesYear))
+    : null
+
+  const fallback = chooseCandidate(parsed)
+
+  const target = preferred ?? fallback
+
+  if (target) {
+    const nextValue = target.value + 1
+    const padded = String(nextValue).padStart(target.width, '0')
+    return `${target.prefix}${padded}`
+  }
+
+  const defaultPrefix = trimmedYear ? `${trimmedYear}-` : ''
+  const defaultWidth = trimmedYear ? 3 : 3
+  return `${defaultPrefix}${String(1).padStart(defaultWidth, '0')}`
+}
diff --git a/context-bundle.md b/context-bundle.md
index 3adfa99..668d184 100644
--- a/context-bundle.md
+++ b/context-bundle.md
@@ -1,4075 +1,4057 @@
-# PR #252 — Diff Summary
+# PR #253 — Diff Summary
 
-- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
-- **Head (source)**: `2a053e23f15309c445dcb84277e01827d6ad2eb4`
+- **Base (target)**: `7b9894aa8b8fb7fe78d46cf4b6d0cf752f0ad3da`
+- **Head (source)**: `ac80177b5b08ea1e9726f6d5a4efdbd0a49e3a97`
 - **Repo**: `girafeev1/ArtifactoftheEstablisher`
 
 ## Changed Files
 
 ```txt
-M	.github/workflows/context-bundle-pr.yml
 M	.github/workflows/deploy-to-vercel-prod.yml
-M	.github/workflows/pr-diff-file.yml
-M	.github/workflows/pr-diff-refresh.yml
-M	.gitignore
-D	.vercel/README.txt
-D	.vercel/project.json
-M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
-M	components/StudentDialog/PaymentHistory.test.tsx
-M	components/StudentDialog/PaymentModal.test.tsx
-A	components/projectdialog/ProjectDatabaseDetailContent.tsx
-A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
-A	components/projectdialog/ProjectDatabaseEditDialog.tsx
+M	components/SidebarLayout.tsx
+M	components/clientdialog/NewClientDialog.tsx
+A	components/database/ClientBankDatabasePage.tsx
+M	components/projectdialog/ProjectDatabaseCreateDialog.tsx
+M	components/projectdialog/ProjectDatabaseDetailContent.tsx
+M	components/projectdialog/projectFormUtils.ts
 M	context-bundle.md
-M	cypress/e2e/add_payment_cascade.cy.tsx
-A	docs/context/PR-251.md
-A	docs/context/PR-252.md
-M	jest.config.cjs
-M	lib/erlDirectory.test.ts
-M	lib/projectsDatabase.ts
-A	lib/projectsDatabaseSelection.ts
-M	pages/_app.tsx
-A	pages/api/projects-database/[year]/[projectId].ts
+A	docs/context/PR-253.md
+A	lib/bankAccountsDirectory.ts
+A	lib/clientDirectory.ts
+M	package-lock.json
+A	pages/api/client-directory/[clientId].ts
+A	pages/api/client-directory/index.ts
+A	pages/dashboard/businesses/client-accounts-database/index.tsx
+A	pages/dashboard/businesses/company-bank-accounts-database/index.tsx
 M	pages/dashboard/businesses/projects-database/[groupId].tsx
-A	pages/dashboard/businesses/projects-database/window.tsx
-A	styles/project-dialog.css
-A	vercel.json
+M	pages/dashboard/businesses/projects-database/new-window.tsx
 ```
 
 ## Stats
 
 ```txt
- .github/workflows/context-bundle-pr.yml            |   36 +-
- .github/workflows/deploy-to-vercel-prod.yml        |   35 +-
- .github/workflows/pr-diff-file.yml                 |   51 -
- .github/workflows/pr-diff-refresh.yml              |   73 +-
- .gitignore                                         |    1 +
- .vercel/README.txt                                 |   11 -
- .vercel/project.json                               |    1 -
- .../businesses/coaching-sessions.test.tsx          |   35 +-
- components/StudentDialog/PaymentHistory.test.tsx   |    8 +-
- components/StudentDialog/PaymentModal.test.tsx     |   21 +-
- .../projectdialog/ProjectDatabaseDetailContent.tsx |  178 +
- .../projectdialog/ProjectDatabaseDetailDialog.tsx  |  201 +
- .../projectdialog/ProjectDatabaseEditDialog.tsx    |  297 ++
- context-bundle.md                                  | 4707 +++++++++++++++++---
- cypress/e2e/add_payment_cascade.cy.tsx             |  104 +-
- docs/context/PR-251.md                             | 4067 +++++++++++++++++
- docs/context/PR-252.md                             |    1 +
- jest.config.cjs                                    |    2 +
- lib/erlDirectory.test.ts                           |    4 +-
- lib/projectsDatabase.ts                            |  147 +-
- lib/projectsDatabaseSelection.ts                   |   30 +
- pages/_app.tsx                                     |   34 +-
- pages/api/projects-database/[year]/[projectId].ts  |   63 +
- .../businesses/projects-database/[groupId].tsx     |  111 +-
- .../businesses/projects-database/window.tsx        |  177 +
- styles/project-dialog.css                          |   20 +
- vercel.json                                        |    6 +
- 27 files changed, 9401 insertions(+), 1020 deletions(-)
+ .github/workflows/deploy-to-vercel-prod.yml        |   10 +-
+ components/SidebarLayout.tsx                       |   22 +
+ components/clientdialog/NewClientDialog.tsx        |   17 +-
+ components/database/ClientBankDatabasePage.tsx     |  443 ++
+ .../projectdialog/ProjectDatabaseCreateDialog.tsx  |  160 +-
+ .../projectdialog/ProjectDatabaseDetailContent.tsx |  143 +-
+ components/projectdialog/projectFormUtils.ts       |   79 +
+ context-bundle.md                                  | 7736 ++++++++++----------
+ docs/context/PR-253.md                             |    1 +
+ lib/bankAccountsDirectory.ts                       |  127 +
+ lib/clientDirectory.ts                             |  220 +
+ package-lock.json                                  |    2 -
+ pages/api/client-directory/[clientId].ts           |   49 +
+ pages/api/client-directory/index.ts                |   42 +
+ .../businesses/client-accounts-database/index.tsx  |   62 +
+ .../company-bank-accounts-database/index.tsx       |   62 +
+ .../businesses/projects-database/[groupId].tsx     |    7 +-
+ .../businesses/projects-database/new-window.tsx    |   38 +-
+ 18 files changed, 5254 insertions(+), 3966 deletions(-)
 ```
 
 ## Unified Diff (truncated to first 4000 lines)
 
 ```diff
-diff --git a/.github/workflows/context-bundle-pr.yml b/.github/workflows/context-bundle-pr.yml
-index eae6a8a..73f53ce 100644
---- a/.github/workflows/context-bundle-pr.yml
-+++ b/.github/workflows/context-bundle-pr.yml
-@@ -53,31 +53,11 @@ jobs:
-           git commit -m "chore(context): update PR #${{ github.event.number }}"
-           git push origin HEAD:${{ github.head_ref }}
- 
--      # 🔗 Upsert a single comment with evergreen & snapshot links
--      - name: Comment links on PR
--        if: always()
--        uses: actions/github-script@v7
--        with:
--          script: |
--            const pr = context.payload.pull_request;
--            const owner = context.repo.owner;
--            const repo  = context.repo.repo;
--            const headRef = pr.head.ref;
--            const headSha = pr.head.sha;
--            const n = pr.number;
--            const evergreen = `https://github.com/${owner}/${repo}/blob/${headRef}/docs/context/PR-${n}.md`;
--            const snapshot  = `https://raw.githubusercontent.com/${owner}/${repo}/${headSha}/docs/context/PR-${n}.md`;
--            const body = [
--              `**Diff file generated ✅**`,
--              ``,
--              `Evergreen: ${evergreen}`,
--              `Snapshot: ${snapshot}`,
--              `File path: docs/context/PR-${n}.md`
--            ].join('\n');
--            const { data: comments } = await github.rest.issues.listComments({ owner, repo, issue_number: n });
--            const mine = comments.find(c => c.user.type === 'Bot' && c.body?.includes('Diff file generated ✅'));
--            if (mine) {
--              await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
--            } else {
--              await github.rest.issues.createComment({ owner, repo, issue_number: n, body });
--            }
-+      - name: Log context bundle update
-+        if: steps.ctxdiff.outputs.changed == 'true'
-+        run: |
-+          {
-+            echo "## Context bundle updated"
-+            echo "- PR: #${{ github.event.number }}"
-+            echo "- File: docs/context/PR-${{ github.event.number }}.md"
-+          } >> "$GITHUB_STEP_SUMMARY"
 diff --git a/.github/workflows/deploy-to-vercel-prod.yml b/.github/workflows/deploy-to-vercel-prod.yml
-index 542388b..abbe8c4 100644
+index abbe8c4..e5d0142 100644
 --- a/.github/workflows/deploy-to-vercel-prod.yml
 +++ b/.github/workflows/deploy-to-vercel-prod.yml
-@@ -1,36 +1,22 @@
--name: Deploy Codex PR to Vercel Production
-+name: Deploy to Vercel Production
+@@ -1,22 +1,20 @@
+ name: Deploy to Vercel Production
  
  on:
--  push:
--    branches:
--      - main
--      - shwdtf-*          # your Codex PRs
--      - codex/*           # additional Codex-style branches
--    # BLACKLIST ONLY: if a push changes ONLY these paths, the job won't run
--    paths-ignore:
--      - 'docs/**'
--      - 'prompts/**'
--      - '.github/**'      # editing workflows should NOT deploy your app
--      - '**/*.md'         # any markdown-only change (README, etc.)
--
--  # keep manual runs available (optional)
--  workflow_dispatch: {}
-+  pull_request:
-+    types: [opened, synchronize, reopened, ready_for_review]
+-  pull_request:
+-    types: [opened, synchronize, reopened, ready_for_review]
++  push:
++    branches: ['**']
  
  permissions:
    contents: read
    deployments: write
  
  concurrency:
--  group: vercel-prod-${{ github.ref }}
-+  group: vercel-prod-${{ github.event.pull_request.number }}
+-  group: vercel-prod-${{ github.event.pull_request.number }}
++  group: vercel-prod-${{ github.ref }}
    cancel-in-progress: true
  
  jobs:
    deploy:
--      if: |
--      !contains(github.event.head_commit.message, 'chore(context)') &&
--      !contains(github.event.head_commit.message, 'archive PR')
--    runs-on: ubuntu-latest
--    steps:
-+    if: >-
-+      github.event.pull_request.head.repo.full_name == github.repository &&
-+      github.event.pull_request.draft == false
+-    if: >-
+-      github.event.pull_request.head.repo.full_name == github.repository &&
+-      github.event.pull_request.draft == false
++    if: github.event_name == 'push'
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
-@@ -39,27 +25,24 @@ jobs:
-         with:
-           node-version: 20
- 
--      - name: Install deps
-+      - name: Install dependencies
-         run: npm ci
- 
-       - name: Install Vercel CLI
-         run: npm i -g vercel@latest
- 
--      # Pull environment (Production)
--      - name: Link Vercel project (prod)
-+      - name: Pull production environment
-         run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
-         env:
-           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
- 
--      # Build locally using Vercel build (produces .vercel/output)
-       - name: Build
-         run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
-         env:
-           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
- 
--      # Deploy the prebuilt output as Production
-       - name: Deploy to Production
-         run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
-         env:
-diff --git a/.github/workflows/pr-diff-file.yml b/.github/workflows/pr-diff-file.yml
-index e341d18..c7b5809 100644
---- a/.github/workflows/pr-diff-file.yml
-+++ b/.github/workflows/pr-diff-file.yml
-@@ -99,54 +99,3 @@ jobs:
-           fi
-           # Capture post-commit SHA so Snapshot points to the commit that actually contains the file
-           echo "post_commit_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
--
--      - name: Compose links
--        id: links
--        shell: bash
--        env:
--          OWNER_REPO: ${{ github.repository }}
--          BRANCH: ${{ github.event.pull_request.head.ref }}
--          PR_NUMBER: ${{ github.event.number }}
--          HEAD_SHA: ${{ steps.diff.outputs.head_sha }}          # pre-commit head
--          POST_SHA: ${{ steps.commit.outputs.post_commit_sha }} # post-commit head (if same-repo)
--        run: |
--          FILE="docs/context/PR-${PR_NUMBER}.md"
--          echo "evergreen=https://github.com/${OWNER_REPO}/blob/${BRANCH}/${FILE}" >> "$GITHUB_OUTPUT"
--          SNAP="${POST_SHA:-$HEAD_SHA}"
--          echo "snapshot=https://raw.githubusercontent.com/${OWNER_REPO}/${SNAP}/${FILE}" >> "$GITHUB_OUTPUT"
--
--      - name: Post sticky comment with links (or inline preview for forks)
--        uses: actions/github-script@v7
--        env:
--          EVERGREEN: ${{ steps.links.outputs.evergreen }}
--          SNAPSHOT: ${{ steps.links.outputs.snapshot }}
--          FROM_SAME_REPO: ${{ steps.ownership.outputs.same_repo }}
--        with:
--          script: |
--            const pr = context.payload.pull_request;
--            const sameRepo = process.env.FROM_SAME_REPO === 'true';
--
--            // Small inline preview (first 250 lines)
--            const fs = require('fs');
--            let inline = '';
--            try {
--              const preview = fs.readFileSync(`docs/context/PR-${pr.number}.md`, 'utf8')
--                .split('\n').slice(0, 250).join('\n');
--              inline = `\n<details><summary>Preview (first 250 lines)</summary>\n\n\`\`\`md\n${preview}\n\`\`\`\n\n</details>\n`;
--            } catch {}
--
--            const marker = '<!-- pr-diff-file-sticky -->';
--            const body = sameRepo
--              ? `**Diff file generated** ✅\n\n- **Evergreen:** ${process.env.EVERGREEN}\n- **Snapshot:** ${process.env.SNAPSHOT}\n\n_File path:_ \`docs/context/PR-${pr.number}.md\`${inline}\n${marker}`
--              : `**Diff generated (fork PR)** ⚠️\nWorkflows cannot push files back to fork branches.\n${inline}\n${marker}`;
--
--            const { data: comments } = await github.rest.issues.listComments({
--              ...context.repo, issue_number: pr.number, per_page: 100
--            });
--
--            const existing = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker));
--            if (existing) {
--              await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
--            } else {
--              await github.rest.issues.createComment({ ...context.repo, issue_number: pr.number, body });
--            }
-diff --git a/.github/workflows/pr-diff-refresh.yml b/.github/workflows/pr-diff-refresh.yml
-index b45ba7a..e33b1cb 100644
---- a/.github/workflows/pr-diff-refresh.yml
-+++ b/.github/workflows/pr-diff-refresh.yml
-@@ -158,74 +158,13 @@ jobs:
-             /tmp/diff.patch
-           if-no-files-found: ignore
- 
--      - name: Compose links
--        id: links
--        env:
--          OWNER_REPO: ${{ github.repository }}
--          BRANCH: ${{ needs.resolve.outputs.head_ref }}
--          PR_NUMBER: ${{ needs.resolve.outputs.pr_number }}
--          # Prefer the new commit SHA if we made one, else the original head SHA
--          HEAD_SHA: ${{ steps.commit.outputs.head_after || needs.resolve.outputs.head_sha }}
-+      - name: Log diff refresh location
-         run: |
--          FILE="docs/context/PR-${PR_NUMBER}.md"
--          echo "evergreen=https://github.com/${OWNER_REPO}/blob/${BRANCH}/${FILE}" >> "$GITHUB_OUTPUT"
--          echo "snapshot=https://raw.githubusercontent.com/${OWNER_REPO}/${HEAD_SHA}/${FILE}" >> "$GITHUB_OUTPUT"
--          echo "run_url=https://github.com/${OWNER_REPO}/actions/runs/${GITHUB_RUN_ID}" >> "$GITHUB_OUTPUT"
--
--      - name: Post sticky comment
--        uses: actions/github-script@v7
--        env:
--          EVERGREEN: ${{ steps.links.outputs.evergreen }}
--          SNAPSHOT:  ${{ steps.links.outputs.snapshot }}
--          RUN_URL:   ${{ steps.links.outputs.run_url }}
--          IS_SAME:   ${{ needs.resolve.outputs.same_repo }}
--        with:
--          script: |
--            const prNumber = Number("${{ needs.resolve.outputs.pr_number }}");
--            const marker = "<!-- pr-diff-refresh-sticky -->";
--
--            let body;
--            if (process.env.IS_SAME === 'true') {
--              body = [
--                `**Diff file refreshed** ✅`,
--                ``,
--                `- Evergreen: ${process.env.EVERGREEN}`,
--                `- Snapshot: ${process.env.SNAPSHOT}`,
--                ``,
--                `_File path:_ docs/context/PR-${prNumber}.md`,
--                marker
--              ].join('\n');
--            } else {
--              body = [
--                `**Diff refreshed (fork PR)** ⚠️`,
--                `Artifacts (download): ${process.env.RUN_URL}`,
--                ``,
--                `_Note:_ Workflows cannot push files back to fork branches.`,
--                marker
--              ].join('\n');
--            }
--
--            const { data: comments } = await github.rest.issues.listComments({
--              owner: context.repo.owner,
--              repo: context.repo.repo,
--              issue_number: prNumber
--            });
--            const existing = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker));
--            if (existing) {
--              await github.rest.issues.updateComment({
--                owner: context.repo.owner,
--                repo: context.repo.repo,
--                comment_id: existing.id,
--                body
--              });
--            } else {
--              await github.rest.issues.createComment({
--                owner: context.repo.owner,
--                repo: context.repo.repo,
--                issue_number: prNumber,
--                body
--              });
--            }
-+          {
-+            echo "## Diff refreshed"
-+            echo "- PR: #${{ needs.resolve.outputs.pr_number }}"
-+            echo "- File: docs/context/PR-${{ needs.resolve.outputs.pr_number }}.md"
-+          } >> "$GITHUB_STEP_SUMMARY"
- 
-       - name: Inline preview (append to comment when possible)
-         if: always()
-diff --git a/.gitignore b/.gitignore
-index 588810e..2587906 100644
---- a/.gitignore
-+++ b/.gitignore
-@@ -8,3 +8,4 @@
- *.DS_Store
- Invoice.JSON
- tsconfig.tsbuildinfo
-+.vercel
-diff --git a/.vercel/README.txt b/.vercel/README.txt
-deleted file mode 100644
-index 525d8ce..0000000
---- a/.vercel/README.txt
-+++ /dev/null
-@@ -1,11 +0,0 @@
--> Why do I have a folder named ".vercel" in my project?
--The ".vercel" folder is created when you link a directory to a Vercel project.
--
--> What does the "project.json" file contain?
--The "project.json" file contains:
--- The ID of the Vercel project that you linked ("projectId")
--- The ID of the user or team your Vercel project is owned by ("orgId")
--
--> Should I commit the ".vercel" folder?
--No, you should not share the ".vercel" folder with anyone.
--Upon creation, it will be automatically added to your ".gitignore" file.
-diff --git a/.vercel/project.json b/.vercel/project.json
-deleted file mode 100644
-index 7ae5fef..0000000
---- a/.vercel/project.json
-+++ /dev/null
-@@ -1 +0,0 @@
--{"projectId":"prj_fZtOwXp0ToGe87kfUosIkQgXMEQY","orgId":"team_ne7hiLb7J8wyHgGulNGIxGIz"}
-\ No newline at end of file
-diff --git a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
-index 75ef22c..8ec8b9e 100644
---- a/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
-+++ b/__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
-@@ -19,15 +19,37 @@ jest.mock('firebase/firestore', () => ({
- }))
- jest.mock('../../../../lib/firebase', () => ({ db: {} }))
- jest.mock('../../../../lib/paths', () => ({ PATHS: {}, logPath: jest.fn() }))
--jest.mock('../../../../components/StudentDialog/OverviewTab', () => () => null)
--jest.mock('../../../../components/StudentDialog/SessionDetail', () => () => null)
--jest.mock('../../../../components/StudentDialog/FloatingWindow', () => ({ children }: any) => (
--  <div>{children}</div>
--))
-+jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
-+  function OverviewTabMock() {
-+    return null
-+  }
-+  OverviewTabMock.displayName = 'OverviewTabMock'
-+  return OverviewTabMock
-+})
-+jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
-+  function SessionDetailMock() {
-+    return null
-+  }
-+  SessionDetailMock.displayName = 'SessionDetailMock'
-+  return SessionDetailMock
-+})
-+jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
-+  function FloatingWindowMock({ children }: any) {
-+    return <div>{children}</div>
-+  }
-+  FloatingWindowMock.displayName = 'FloatingWindowMock'
-+  return FloatingWindowMock
-+})
- jest.mock('../../../../lib/sessionStats', () => ({ clearSessionSummaries: jest.fn() }))
- jest.mock('../../../../lib/sessions', () => ({ computeSessionStart: jest.fn() }))
- jest.mock('../../../../lib/billing/useBilling', () => ({ useBilling: () => ({ data: null, isLoading: false }) }))
--jest.mock('../../../../components/LoadingDash', () => () => null)
-+jest.mock('../../../../components/LoadingDash', () => {
-+  function LoadingDashMock() {
-+    return null
-+  }
-+  LoadingDashMock.displayName = 'LoadingDashMock'
-+  return LoadingDashMock
-+})
- jest.mock('../../../../lib/scanLogs', () => ({
-   readScanLogs: jest.fn(async () => null),
-   writeScanLog: jest.fn(),
-@@ -51,4 +73,3 @@ describe('coaching sessions card view', () => {
-     expect(screen.queryByTestId('pprompt-badge')).toBeNull()
-   })
- })
--
-diff --git a/components/StudentDialog/PaymentHistory.test.tsx b/components/StudentDialog/PaymentHistory.test.tsx
-index e850e7a..e2560e9 100644
---- a/components/StudentDialog/PaymentHistory.test.tsx
-+++ b/components/StudentDialog/PaymentHistory.test.tsx
-@@ -6,7 +6,13 @@ import '@testing-library/jest-dom'
- import { render, screen, waitFor } from '@testing-library/react'
- import PaymentHistory from './PaymentHistory'
+diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
+index 3ba283a..abcdf45 100644
+--- a/components/SidebarLayout.tsx
++++ b/components/SidebarLayout.tsx
+@@ -95,6 +95,28 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
+                 </Button>
+               </Link>
+             </MenuItem>
++            <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
++              <Link
++                href="/dashboard/businesses/client-accounts-database"
++                passHref
++                style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
++              >
++                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
++                  Client Accounts (Database)
++                </Button>
++              </Link>
++            </MenuItem>
++            <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
++              <Link
++                href="/dashboard/businesses/company-bank-accounts-database"
++                passHref
++                style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
++              >
++                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
++                  Company Bank Accounts (Database)
++                </Button>
++              </Link>
++            </MenuItem>
+           </Menu>
+         </Box>
+         <Button color="secondary" onClick={() => signOut()} sx={{ mt: 3, justifyContent: 'flex-start' }}>
+diff --git a/components/clientdialog/NewClientDialog.tsx b/components/clientdialog/NewClientDialog.tsx
+index 93e3c87..eadb78a 100644
+--- a/components/clientdialog/NewClientDialog.tsx
++++ b/components/clientdialog/NewClientDialog.tsx
+@@ -52,10 +52,23 @@ export default function NewClientDialog({ open, onClose, onSubmitted }: NewClien
  
--jest.mock('./PaymentModal', () => () => <div />)
-+jest.mock('./PaymentModal', () => {
-+  function PaymentModalMock() {
-+    return <div />
-+  }
-+  PaymentModalMock.displayName = 'PaymentModalMock'
-+  return PaymentModalMock
-+})
- 
- jest.mock('firebase/firestore', () => ({
-   collection: jest.fn(),
-diff --git a/components/StudentDialog/PaymentModal.test.tsx b/components/StudentDialog/PaymentModal.test.tsx
-index 3d4b44f..81908ef 100644
---- a/components/StudentDialog/PaymentModal.test.tsx
-+++ b/components/StudentDialog/PaymentModal.test.tsx
-@@ -6,6 +6,8 @@ import '@testing-library/jest-dom'
- import { render, fireEvent, waitFor, screen } from '@testing-library/react'
- import PaymentModal from './PaymentModal'
- import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
-+import * as firestore from 'firebase/firestore'
-+import * as erlDirectory from '../../lib/erlDirectory'
- 
- jest.mock('../../lib/erlDirectory', () => ({
-   listBanks: jest
-@@ -46,6 +48,9 @@ jest.mock('../../lib/liveRefresh', () => ({ writeSummaryFromCache: jest.fn() }))
- 
- const noop = () => {}
- 
-+const mockedErlDirectory = jest.mocked(erlDirectory, { shallow: false })
-+const mockedFirestore = jest.mocked(firestore, { shallow: false })
-+
- describe('PaymentModal ERL cascade', () => {
-   test('populates banks/accounts and submits identifier with audit fields', async () => {
-     const qc = new QueryClient()
-@@ -65,14 +70,10 @@ describe('PaymentModal ERL cascade', () => {
-     const accountSelect = getByTestId('bank-account-select') as HTMLInputElement
-     fireEvent.change(accountSelect, { target: { value: 'a1' } })
-     await waitFor(() =>
--      expect(
--        require('../../lib/erlDirectory').buildAccountLabel,
--      ).toHaveBeenCalled(),
-+      expect(mockedErlDirectory.buildAccountLabel).toHaveBeenCalled(),
-     )
--    expect(require('../../lib/erlDirectory').listBanks).toHaveBeenCalled()
--    expect(
--      require('../../lib/erlDirectory').listAccounts,
--    ).toHaveBeenCalledWith({
-+    expect(mockedErlDirectory.listBanks).toHaveBeenCalled()
-+    expect(mockedErlDirectory.listAccounts).toHaveBeenCalledWith({
-       bankCode: '001',
-       bankName: 'Bank',
-       rawCodeSegment: '(001)',
-@@ -83,10 +84,10 @@ describe('PaymentModal ERL cascade', () => {
-     fireEvent.change(getByTestId('method-select'), { target: { value: 'FPS' } })
-     fireEvent.change(getByTestId('ref-input'), { target: { value: 'R1' } })
- 
--    expect(require('firebase/firestore').addDoc).not.toHaveBeenCalled()
-+    expect(mockedFirestore.addDoc).not.toHaveBeenCalled()
-     fireEvent.click(getByTestId('submit-payment'))
--    await waitFor(() => expect(require('firebase/firestore').addDoc).toHaveBeenCalled())
--    const data = (require('firebase/firestore').addDoc as jest.Mock).mock.calls[0][1]
-+    await waitFor(() => expect(mockedFirestore.addDoc).toHaveBeenCalled())
-+    const data = (mockedFirestore.addDoc as jest.Mock).mock.calls[0][1]
-     expect(data.identifier).toBe('a1')
-     expect(data.bankCode).toBeUndefined()
-     expect(data.accountDocId).toBeUndefined()
-diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
+   const handleSubmit = async () => {
+     try {
+-      const resp = await fetch('/api/clients', {
++      const resp = await fetch('/api/client-directory', {
+         method: 'POST',
+         headers: { 'Content-Type': 'application/json' },
+-        body: JSON.stringify({ data: newClient }),
++        body: JSON.stringify({
++          client: {
++            companyName: newClient.companyName,
++            title: newClient.title,
++            nameAddressed: newClient.nameAddressed,
++            emailAddress: newClient.emailAddress,
++            addressLine1: newClient.addressLine1,
++            addressLine2: newClient.addressLine2,
++            addressLine3: newClient.addressLine3,
++            addressLine4: newClient.addressLine4,
++            addressLine5: newClient.addressLine5,
++            name: newClient.nameAddressed,
++          },
++        }),
+       });
+       if (!resp.ok) {
+         const errJson = await resp.json().catch(() => ({}));
+diff --git a/components/database/ClientBankDatabasePage.tsx b/components/database/ClientBankDatabasePage.tsx
 new file mode 100644
-index 0000000..e136869
+index 0000000..62dbf53
 --- /dev/null
-+++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
-@@ -0,0 +1,178 @@
-+import { useMemo } from 'react'
++++ b/components/database/ClientBankDatabasePage.tsx
+@@ -0,0 +1,443 @@
++import { useEffect, useMemo, useState } from 'react'
++import { useRouter } from 'next/router'
++
++import SidebarLayout from '../SidebarLayout'
++import ViewClientDialog from '../clientdialog/ViewClientDialog'
++import EditClientDialog, { type Client as EditDialogClient } from '../clientdialog/EditClientDialog'
++import NewClientDialog from '../clientdialog/NewClientDialog'
 +
 +import {
++  Alert,
++  Accordion,
++  AccordionSummary,
++  AccordionDetails,
 +  Box,
++  Button,
 +  Chip,
-+  Divider,
-+  IconButton,
-+  Link,
-+  Stack,
++  List,
++  ListItem,
++  ListItemButton,
++  ListItemText,
++  ToggleButton,
++  ToggleButtonGroup,
 +  Typography,
 +} from '@mui/material'
-+import CloseIcon from '@mui/icons-material/Close'
-+import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
-+import { Cormorant_Infant } from 'next/font/google'
++import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
 +
-+import type { ProjectRecord } from '../../lib/projectsDatabase'
-+import type { ReactNode } from 'react'
++import type { ClientDirectoryRecord } from '../../lib/clientDirectory'
++import type { BankAccountDirectoryRecord } from '../../lib/bankAccountsDirectory'
 +
-+const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
++interface ClientBankDatabasePageProps {
++  clients: ClientDirectoryRecord[]
++  bankAccounts: BankAccountDirectoryRecord[]
++  initialView: 'clients' | 'bank'
++  error?: string
++}
 +
-+const textOrNA = (value: string | null | undefined) =>
-+  value && value.trim().length > 0 ? value : 'N/A'
++const convertToClientDetails = (record: ClientDirectoryRecord) => {
++  const title = record.title ?? ''
++  const nameAddressed = record.nameAddressed ?? record.name ?? ''
++  const cleanedTitle = title && nameAddressed.toLowerCase().startsWith(title.toLowerCase()) ? '' : title
 +
-+const formatAmount = (value: number | null | undefined) => {
-+  if (typeof value !== 'number' || Number.isNaN(value)) {
-+    return 'HK$0'
++  return {
++    companyName: record.companyName,
++    title: cleanedTitle,
++    nameAddressed,
++    emailAddress: record.emailAddress ?? '',
++    addressLine1: record.addressLine1 ?? '',
++    addressLine2: record.addressLine2 ?? '',
++    addressLine3: record.addressLine3 ?? '',
++    addressLine4: record.addressLine4 ?? '',
++    addressLine5: record.addressLine5 ?? record.region ?? '',
 +  }
-+  return `HK$${value.toLocaleString('en-US', {
-+    minimumFractionDigits: 0,
-+    maximumFractionDigits: 2,
-+  })}`
-+}
-+
-+const labelSx = {
-+  fontWeight: 400,
-+  fontSize: '0.9rem',
-+  letterSpacing: '0.02em',
-+} as const
-+
-+const valueSx = {
-+  fontSize: '1.2rem',
-+  lineHeight: 1.3,
-+} as const
-+
-+interface ProjectDatabaseDetailContentProps {
-+  project: ProjectRecord
-+  headerActions?: ReactNode
-+  onClose?: () => void
-+  onEdit?: () => void
 +}
 +
-+export default function ProjectDatabaseDetailContent({
-+  project,
-+  headerActions,
-+  onClose,
-+  onEdit,
-+}: ProjectDatabaseDetailContentProps) {
-+  const detailItems = useMemo(() => {
-+    const invoiceValue: ReactNode = project.invoice
-+      ? project.invoice.startsWith('http')
-+        ? (
-+            <Link
-+              href={project.invoice}
-+              target="_blank"
-+              rel="noopener"
-+              sx={{ fontFamily: 'inherit', fontWeight: 'inherit' }}
-+            >
-+              {project.invoice}
-+            </Link>
-+          )
-+        : textOrNA(project.invoice)
-+      : 'N/A'
-+
-+    return [
-+      { label: 'Client Company', value: textOrNA(project.clientCompany) },
-+      {
-+        label: 'Project Pickup Date',
-+        value: project.projectDateDisplay ?? '-',
-+      },
-+      { label: 'Amount', value: formatAmount(project.amount) },
-+      { label: 'Paid', value: project.paid ? '🤑' : '👎🏻' },
-+      {
-+        label: 'Paid On',
-+        value: project.paid ? project.onDateDisplay ?? '-' : '-',
-+      },
-+      { label: 'Pay To', value: textOrNA(project.paidTo) },
-+      { label: 'Invoice', value: invoiceValue },
-+    ] satisfies Array<{ label: string; value: ReactNode }>
-+  }, [project])
++const convertToEditClient = (record: ClientDirectoryRecord): EditDialogClient => ({
++  companyName: record.companyName,
++  title: record.title ?? 'Mr.',
++  nameAddressed: record.nameAddressed ?? record.name ?? '',
++  emailAddress: record.emailAddress ?? '',
++  addressLine1: record.addressLine1 ?? '',
++  addressLine2: record.addressLine2 ?? '',
++  addressLine3: record.addressLine3 ?? '',
++  addressLine4: record.addressLine4 ?? '',
++  addressLine5: record.addressLine5 ?? record.region ?? 'Kowloon',
++})
 +
-+  const rawPresenter = textOrNA(project.presenterWorkType)
-+  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
-+  const hasCjkCharacters = (value: string | null | undefined) =>
-+    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
++const formatBankName = (name: string) =>
++  name.split(/(-|\s+)/).map((segment, index) => {
++    if (segment === '-') {
++      return (
++        <span key={`hyphen-${index}`} className='federo-text' style={{ margin: '0 6px' }}>
++          -
++        </span>
++      )
++    }
++    if (segment.trim().length === 0) {
++      return (
++        <span key={`space-${index}`} className='federo-text'>
++          {segment}
++        </span>
++      )
++    }
++    return (
++      <span key={`word-${index}`} className='federo-text' style={{ marginRight: 6 }}>
++        {segment.split('').map((char, charIndex) => (
++          <span key={`char-${index}-${charIndex}`} style={charIndex === 0 ? { fontWeight: 700 } : undefined}>
++            {char}
++          </span>
++        ))}
++      </span>
++    )
++  })
 +
-+  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
-+  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
++const getContactSecondary = (client: ClientDirectoryRecord) => {
++  const contact = [client.title, client.nameAddressed ?? client.name]
++    .filter(Boolean)
++    .join(' ')
++    .trim()
 +
-+  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
++  const email = client.emailAddress ?? 'N/A'
++  return contact ? `${contact} - ${email}` : `N/A - ${email}`
++}
 +
++const getStatusChip = (active: boolean | null) => {
++  if (active === null) {
++    return null
++  }
 +  return (
-+    <Stack spacing={1.2}>
-+      <Stack
-+        direction={{ xs: 'column', sm: 'row' }}
-+        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
-+        spacing={1.5}
-+      >
-+        <Stack spacing={0.75} sx={{ flexGrow: 1, minWidth: 0 }}>
-+          <Stack
-+            direction='row'
-+            alignItems='center'
-+            spacing={1}
-+            sx={{ flexWrap: 'wrap', rowGap: 0.5 }}
-+          >
-+            <Typography variant='subtitle1' color='text.secondary'>
-+              {project.projectNumber}
-+            </Typography>
-+            {onEdit && (
-+              <IconButton onClick={onEdit} aria-label='Edit project' size='small'>
-+                <EditOutlinedIcon fontSize='small' />
-+              </IconButton>
-+            )}
-+          </Stack>
-+          <Typography
-+            variant='subtitle1'
-+            sx={{ color: 'text.primary' }}
-+            className={presenterClassName}
-+          >
-+            {presenterText}
-+          </Typography>
-+          <Typography
-+            variant='h4'
-+            className={hasCjkInTitle ? 'yuji-title' : undefined}
-+            sx={{ fontFamily: hasCjkInTitle ? undefined : 'Cantata One', lineHeight: 1.2 }}
-+          >
-+            {textOrNA(project.projectTitle)}
-+          </Typography>
-+          <Typography variant='body1' color='text.secondary'>
-+            {textOrNA(project.projectNature)}
-+          </Typography>
-+        </Stack>
-+        <Stack spacing={0.75} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
-+          <Stack direction='row' spacing={0.5} alignItems='center'>
-+            {headerActions}
-+            {onClose && (
-+              <IconButton onClick={onClose} aria-label='close project details' size='small'>
-+                <CloseIcon fontSize='small' />
-+              </IconButton>
-+            )}
-+          </Stack>
-+          {project.subsidiary && (
-+            <Chip
-+              label={textOrNA(project.subsidiary)}
-+              variant='outlined'
-+              size='small'
-+              sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}
-+            />
-+          )}
-+        </Stack>
-+      </Stack>
-+
-+      <Divider />
-+
-+      <Stack spacing={1.2}>
-+        {detailItems.map(({ label, value }) => (
-+          <Box key={label}>
-+            <Typography sx={labelSx} className='karla-label'>
-+              {label}:
-+            </Typography>
-+            <Typography component='div' sx={valueSx} className={cormorantSemi.className}>
-+              {value}
-+            </Typography>
-+          </Box>
-+        ))}
-+      </Stack>
-+    </Stack>
++    <Chip
++      size='small'
++      label={active ? 'Active' : 'Inactive'}
++      sx={{
++        bgcolor: active ? 'rgba(76, 175, 80, 0.18)' : 'rgba(244, 67, 54, 0.18)',
++        color: active ? 'success.main' : 'error.main',
++        border: '1px solid',
++        borderColor: active ? 'success.light' : 'error.light',
++      }}
++    />
 +  )
 +}
-diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
-new file mode 100644
-index 0000000..787fc34
---- /dev/null
-+++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
-@@ -0,0 +1,201 @@
-+import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
-+import { createPortal } from 'react-dom'
-+import { Rnd, type RndDragCallback, type RndResizeCallback } from 'react-rnd'
-+import { Backdrop, Box, Fade, useMediaQuery, useTheme } from '@mui/material'
-+
-+import type { ReactNode } from 'react'
-+
-+import type { ProjectRecord } from '../../lib/projectsDatabase'
-+import ProjectDatabaseDetailContent from './ProjectDatabaseDetailContent'
-+
-+interface ProjectDatabaseDetailDialogProps {
-+  open: boolean
-+  onClose: () => void
-+  project: ProjectRecord | null
-+  onEdit?: () => void
-+  headerActions?: ReactNode
-+}
 +
-+const MIN_WIDTH = 400
-+const MIN_HEIGHT = 200
-+
-+const clamp = (value: number, min: number, max: number) =>
-+  Math.min(Math.max(value, min), max)
-+
-+export default function ProjectDatabaseDetailDialog({
-+  open,
-+  onClose,
-+  project,
-+  onEdit,
-+  headerActions,
-+}: ProjectDatabaseDetailDialogProps) {
-+  const theme = useTheme()
-+  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
-+  const [mounted, setMounted] = useState(false)
-+  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
-+    width: 560,
-+    height: 480,
-+  }))
-+  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
-+    x: 80,
-+    y: 80,
-+  }))
-+  const [needsMeasurement, setNeedsMeasurement] = useState(true)
-+  const contentRef = useRef<HTMLDivElement | null>(null)
++export function ClientBankDatabasePage({
++  clients,
++  bankAccounts,
++  initialView,
++  error,
++}: ClientBankDatabasePageProps) {
++  const router = useRouter()
++  const [view, setView] = useState<'clients' | 'bank'>(initialView)
++  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
++  const [filteredClients, setFilteredClients] = useState<ClientDirectoryRecord[]>(clients)
++  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRecord | null>(null)
++  const [editableClient, setEditableClient] = useState<EditDialogClient | null>(null)
++  const [editingClientId, setEditingClientId] = useState<string | null>(null)
++  const [viewDialogOpen, setViewDialogOpen] = useState(false)
++  const [editDialogOpen, setEditDialogOpen] = useState(false)
++  const [addDialogOpen, setAddDialogOpen] = useState(false)
 +
 +  useEffect(() => {
-+    setMounted(true)
-+  }, [])
++    setView(initialView)
++  }, [initialView])
 +
 +  useEffect(() => {
-+    if (open) {
-+      const previous = document.body.style.overflow
-+      document.body.style.overflow = 'hidden'
-+      setNeedsMeasurement(true)
-+      return () => {
-+        document.body.style.overflow = previous
-+      }
++    if (view === 'bank') {
++      setSelectedLetter(null)
 +    }
-+    return undefined
-+  }, [open])
++  }, [view])
 +
-+  useLayoutEffect(() => {
-+    if (!open || !needsMeasurement || !contentRef.current || isSmallScreen) {
-+      return
++  const uniqueLetters = useMemo(
++    () => Array.from(new Set(clients.map((client) => client.companyName.charAt(0).toUpperCase()))).sort(),
++    [clients]
++  )
++
++  useEffect(() => {
++    if (selectedLetter) {
++      setFilteredClients(
++        clients.filter((client) => client.companyName.charAt(0).toUpperCase() === selectedLetter)
++      )
++    } else {
++      setFilteredClients(clients)
 +    }
++  }, [selectedLetter, clients])
 +
-+    const node = contentRef.current
-+    const viewportWidth = window.innerWidth || 1024
-+    const viewportHeight = window.innerHeight || 768
-+    const horizontalPadding = 64
-+    const verticalPadding = 96
++  const groupedBankAccounts = useMemo(() => {
++    const map = new Map<
++      string,
++      {
++        bankName: string
++        bankCode: string | null
++        entries: BankAccountDirectoryRecord[]
++        active: boolean
++      }
++    >()
 +
-+    const measuredWidth = node.scrollWidth + horizontalPadding
-+    const measuredHeight = node.scrollHeight + verticalPadding
++    bankAccounts.forEach((account) => {
++      const key = `${account.bankName}__${account.bankCode ?? 'unknown'}`
++      if (!map.has(key)) {
++        map.set(key, {
++          bankName: account.bankName,
++          bankCode: account.bankCode,
++          entries: [],
++          active: false,
++        })
++      }
++      const bucket = map.get(key)!
++      bucket.entries.push(account)
++      if (account.status === true) {
++        bucket.active = true
++      }
++    })
 +
-+    const width = clamp(
-+      measuredWidth,
-+      MIN_WIDTH,
-+      Math.max(MIN_WIDTH, viewportWidth - 48)
-+    )
-+    const height = clamp(
-+      measuredHeight,
-+      MIN_HEIGHT,
-+      Math.max(MIN_HEIGHT, viewportHeight - 48)
-+    )
++    return Array.from(map.values()).sort((a, b) => {
++      if (a.active !== b.active) {
++        return a.active ? -1 : 1
++      }
++      const codeA = a.bankCode ? Number(a.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
++      const codeB = b.bankCode ? Number(b.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
++      if (codeA !== codeB) {
++        return codeA - codeB
++      }
++      return a.bankName.localeCompare(b.bankName)
++    })
++  }, [bankAccounts])
 +
-+    const x = Math.max(24, Math.round((viewportWidth - width) / 2))
-+    const y = Math.max(32, Math.round((viewportHeight - height) / 2))
-+
-+    setSize({ width, height })
-+    setPosition({ x, y })
-+    setNeedsMeasurement(false)
-+  }, [open, needsMeasurement, isSmallScreen])
-+
-+  const handleResizeStop: RndResizeCallback = (
-+    _event,
-+    _direction,
-+    elementRef,
-+    _delta,
-+    nextPosition
-+  ) => {
-+    const width = elementRef.offsetWidth
-+    const height = elementRef.offsetHeight
-+    setSize({ width, height })
-+    setPosition(nextPosition)
++  const handleToggleView = (newView: 'clients' | 'bank') => {
++    setView(newView)
 +  }
 +
-+  const handleDragStop: RndDragCallback = (_event, data) => {
-+    setPosition({ x: data.x, y: data.y })
++  const handleClientClick = (client: ClientDirectoryRecord) => {
++    setSelectedClient(client)
++    setViewDialogOpen(true)
 +  }
 +
-+  const portalTarget = useMemo(() => (mounted ? document.body : null), [mounted])
++  const handleCloseViewDialog = () => {
++    setViewDialogOpen(false)
++    setSelectedClient(null)
++  }
 +
-+  if (!project || !open || !portalTarget) {
-+    return null
++  const handleEditFromView = () => {
++    if (!selectedClient) return
++    setViewDialogOpen(false)
++    setEditableClient(convertToEditClient(selectedClient))
++    setEditingClientId(selectedClient.companyName)
++    setEditDialogOpen(true)
 +  }
 +
-+  if (isSmallScreen) {
-+    return createPortal(
-+      <Fade in={open} appear unmountOnExit>
-+        <Box
-+          sx={{
-+            position: 'fixed',
-+            inset: 0,
-+            bgcolor: 'background.paper',
-+            zIndex: 1300,
-+            display: 'flex',
-+            flexDirection: 'column',
-+          }}
-+        >
-+          <Box ref={contentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
-+            <ProjectDatabaseDetailContent
-+              project={project}
-+              headerActions={headerActions}
-+              onClose={onClose}
-+              onEdit={onEdit}
-+            />
-+          </Box>
-+        </Box>
-+      </Fade>,
-+      portalTarget
-+    )
++  const handleCloseEditDialog = () => {
++    setEditDialogOpen(false)
++    setEditableClient(null)
++    setSelectedClient(null)
++    setEditingClientId(null)
++  }
++
++  const handleClientChange = (client: EditDialogClient) => {
++    setEditableClient(client)
++  }
++
++  const handleSaveClient = async () => {
++    if (!editableClient || !editingClientId) {
++      return
++    }
++
++    try {
++      const payload = {
++        ...editableClient,
++        name: editableClient.nameAddressed,
++      }
++
++      const response = await fetch(`/api/client-directory/${encodeURIComponent(editingClientId)}`, {
++        method: 'PATCH',
++        headers: { 'Content-Type': 'application/json' },
++        body: JSON.stringify({ updates: payload }),
++      })
++
++      if (!response.ok) {
++        const payload = await response.json().catch(() => ({}))
++        throw new Error(payload.error || 'Failed to update client')
++      }
++
++      setEditDialogOpen(false)
++      setEditableClient(null)
++      setSelectedClient(null)
++      setEditingClientId(null)
++      router.replace(router.asPath)
++      alert('Client updated successfully')
++    } catch (err) {
++      console.error('[ClientBankDatabasePage] failed to update client:', err)
++      alert(err instanceof Error ? err.message : 'Failed to update client')
++    }
++  }
++
++  const handleOpenAddDialog = () => {
++    setAddDialogOpen(true)
++  }
++
++  const handleCloseAddDialog = () => {
++    setAddDialogOpen(false)
++  }
++
++  const handleNewClientSubmitted = () => {
++    setAddDialogOpen(false)
++    router.replace(router.asPath)
 +  }
 +
-+  return createPortal(
-+    <Fade in={open} appear unmountOnExit>
++  return (
++    <SidebarLayout>
 +      <Box
 +        sx={{
-+          position: 'fixed',
-+          inset: 0,
-+          zIndex: 1300,
++          display: 'flex',
++          justifyContent: 'space-between',
++          alignItems: 'center',
++          flexWrap: 'wrap',
++          gap: 2,
++          mb: 2,
++        }}
++      >
++        <Typography variant='h4'>
++          {view === 'clients' ? 'Client Accounts (Database)' : 'Company Bank Accounts (Database)'}
++        </Typography>
++        {view === 'clients' && (
++          <Button variant='contained' onClick={handleOpenAddDialog}>
++            Add Client
++          </Button>
++        )}
++      </Box>
++      {error && (
++        <Alert severity='error' sx={{ mb: 2 }}>
++          Error: {error}
++        </Alert>
++      )}
++      <ToggleButtonGroup
++        exclusive
++        value={view}
++        onChange={(event, value) => {
++          if (value) {
++            handleToggleView(value)
++          }
 +        }}
++        sx={{ mb: 2 }}
 +      >
-+        <Backdrop
-+          open
-+          onClick={onClose}
-+          sx={{ position: 'absolute', inset: 0 }}
++        <ToggleButton value='clients'>Client Accounts</ToggleButton>
++        <ToggleButton value='bank'>Company Bank Accounts</ToggleButton>
++      </ToggleButtonGroup>
++
++      {view === 'clients' ? (
++        <Box>
++          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
++            {uniqueLetters.map((letter) => (
++              <Button
++                key={letter}
++                variant={selectedLetter === letter ? 'contained' : 'outlined'}
++                onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
++              >
++                {letter}
++              </Button>
++            ))}
++          </Box>
++          {filteredClients.length === 0 ? (
++            <Typography>No client data found.</Typography>
++          ) : (
++            <List>
++              {filteredClients.map((entry, idx) => (
++                <ListItem key={`${entry.companyName}-${idx}`} disablePadding>
++                  <ListItemButton onClick={() => handleClientClick(entry)}>
++                    <ListItemText
++                      primary={entry.companyName}
++                      secondary={getContactSecondary(entry)}
++                    />
++                  </ListItemButton>
++                </ListItem>
++              ))}
++            </List>
++          )}
++        </Box>
++      ) : groupedBankAccounts.length === 0 ? (
++        <Typography>No bank accounts found.</Typography>
++      ) : (
++        groupedBankAccounts.map((group) => (
++          <Accordion key={`${group.bankName}-${group.bankCode ?? 'unknown'}`} sx={{ mb: 2 }}>
++            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
++              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
++                <Typography
++                  variant='h5'
++                  component='div'
++                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
++                >
++                  {formatBankName(group.bankName)}
++                  {group.bankCode && (
++                    <Typography
++                      variant='h6'
++                      component='span'
++                      color='text.secondary'
++                      sx={{ fontSize: '0.7em' }}
++                    >
++                      {group.bankCode}
++                    </Typography>
++                  )}
++                </Typography>
++                {getStatusChip(group.active)}
++              </Box>
++            </AccordionSummary>
++            <AccordionDetails>
++              {group.entries
++                .slice()
++                .sort((a, b) => {
++                  if (a.status !== b.status) {
++                    return (b.status ? 1 : 0) - (a.status ? 1 : 0)
++                  }
++                  return a.accountId.localeCompare(b.accountId)
++                })
++                .map((entry) => (
++                  <Box
++                    key={entry.accountId}
++                    sx={{
++                      mb: 2,
++                      p: 2,
++                      border: '1px solid',
++                      borderColor: 'divider',
++                      borderRadius: 1,
++                      display: 'flex',
++                      flexDirection: 'column',
++                      gap: 1,
++                    }}
++                  >
++                    <Typography variant='h6'>
++                      {entry.accountType ? `${entry.accountType} Account` : 'Account'}
++                    </Typography>
++                    <Typography variant='body1'>
++                      {entry.accountNumber ?? 'Account number unavailable'}
++                    </Typography>
++                    <Typography variant='body2'>FPS ID: {entry.fpsId ?? 'N/A'}</Typography>
++                    <Typography variant='body2'>FPS Email: {entry.fpsEmail ?? 'N/A'}</Typography>
++                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
++                      <Chip label={entry.accountId} size='small' variant='outlined' />
++                    </Box>
++                  </Box>
++                ))}
++            </AccordionDetails>
++          </Accordion>
++        ))
++      )}
++
++      <ViewClientDialog
++        open={viewDialogOpen}
++        onClose={handleCloseViewDialog}
++        client={selectedClient ? convertToClientDetails(selectedClient) : null}
++        onEdit={handleEditFromView}
++      />
++      {editableClient && (
++        <EditClientDialog
++          open={editDialogOpen}
++          onClose={handleCloseEditDialog}
++          client={editableClient}
++          onClientChange={handleClientChange}
++          onSave={async () => handleSaveClient()}
++        />
++      )}
++      <NewClientDialog open={addDialogOpen} onClose={handleCloseAddDialog} onSubmitted={handleNewClientSubmitted} />
++    </SidebarLayout>
++  )
++}
++
++export default ClientBankDatabasePage
+diff --git a/components/projectdialog/ProjectDatabaseCreateDialog.tsx b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
+index 8152e21..c11fd9e 100644
+--- a/components/projectdialog/ProjectDatabaseCreateDialog.tsx
++++ b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
+@@ -19,7 +19,11 @@ import OpenInNewIcon from '@mui/icons-material/OpenInNew'
+ 
+ import ProjectDatabaseWindow from './ProjectDatabaseWindow'
+ import type { ProjectRecord } from '../../lib/projectsDatabase'
+-import { sanitizeText, toIsoUtcStringOrNull } from './projectFormUtils'
++import {
++  generateSequentialProjectNumber,
++  sanitizeText,
++  toIsoUtcStringOrNull,
++} from './projectFormUtils'
+ 
+ interface ProjectDatabaseCreateDialogProps {
+   open: boolean
+@@ -27,6 +31,7 @@ interface ProjectDatabaseCreateDialogProps {
+   onClose: () => void
+   onCreated: (created?: ProjectRecord) => void
+   onDetach?: () => void
++  existingProjectNumbers: readonly string[]
+ }
+ 
+ interface ProjectDatabaseCreateFormProps {
+@@ -37,6 +42,7 @@ interface ProjectDatabaseCreateFormProps {
+   variant: 'dialog' | 'page'
+   resetToken?: unknown
+   onBusyChange?: (busy: boolean) => void
++  existingProjectNumbers: readonly string[]
+ }
+ 
+ interface FormState {
+@@ -77,16 +83,40 @@ export function ProjectDatabaseCreateForm({
+   variant,
+   resetToken,
+   onBusyChange,
++  existingProjectNumbers,
+ }: ProjectDatabaseCreateFormProps) {
+   const [form, setForm] = useState<FormState>(EMPTY_FORM)
+   const [saving, setSaving] = useState(false)
+   const [error, setError] = useState<string | null>(null)
++  const [editingProjectNumber, setEditingProjectNumber] = useState(false)
++
++  const normalizedProjectNumbers = useMemo(
++    () => {
++      const trimmed = existingProjectNumbers
++        .map((value) => value.trim())
++        .filter((value) => value.length > 0)
++      return Array.from(new Set(trimmed))
++    },
++    [existingProjectNumbers]
++  )
++
++  const defaultProjectNumber = useMemo(
++    () => generateSequentialProjectNumber(year, normalizedProjectNumbers),
++    [year, normalizedProjectNumbers]
++  )
++
++  const defaultSubsidiary = 'Establish Records Limited'
+ 
+   useEffect(() => {
+-    setForm(EMPTY_FORM)
++    setForm({
++      ...EMPTY_FORM,
++      projectNumber: defaultProjectNumber,
++      subsidiary: defaultSubsidiary,
++    })
+     setError(null)
+     setSaving(false)
+-  }, [resetToken])
++    setEditingProjectNumber(false)
++  }, [resetToken, defaultProjectNumber, defaultSubsidiary])
+ 
+   useEffect(() => {
+     onBusyChange?.(saving)
+@@ -99,10 +129,31 @@ export function ProjectDatabaseCreateForm({
+       setForm((prev) => ({ ...prev, [field]: event.target.value }))
+     }
+ 
++  const updateProjectNumber = (value: string) => {
++    setForm((prev) => ({ ...prev, projectNumber: value }))
++  }
++
+   const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
+     setForm((prev) => ({ ...prev, paid: checked }))
+   }
+ 
++  const commitProjectNumber = () => {
++    const trimmed = form.projectNumber.trim()
++    updateProjectNumber(trimmed.length > 0 ? trimmed : defaultProjectNumber)
++    setEditingProjectNumber(false)
++  }
++
++  const handleProjectNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
++    if (event.key === 'Enter') {
++      event.preventDefault()
++      commitProjectNumber()
++    } else if (event.key === 'Escape') {
++      event.preventDefault()
++      updateProjectNumber(defaultProjectNumber)
++      setEditingProjectNumber(false)
++    }
++  }
++
+   const handleSubmit = async () => {
+     if (!year) {
+       setError('Select a year before creating a project')
+@@ -184,7 +235,7 @@ export function ProjectDatabaseCreateForm({
+   }
+ 
+   return (
+-    <Stack spacing={2}>
++    <Stack spacing={2} sx={{ width: '100%', maxWidth: 640, mx: 'auto' }}>
+       <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
+         <Box>
+           <Typography variant="h5" sx={{ fontFamily: 'Cantata One' }}>
+@@ -209,29 +260,36 @@ export function ProjectDatabaseCreateForm({
+           </IconButton>
+         </Stack>
+       </Stack>
+-      {year && (
+-        <Chip label={year} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }} />
+-      )}
+-      <Divider />
+-      {error && <Alert severity="error">{error}</Alert>}
+-      <Grid container spacing={2}>
+-        <Grid item xs={12} sm={6}>
++      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
++        {editingProjectNumber ? (
+           <TextField
+-            label="Project Number"
+             value={form.projectNumber}
+-            onChange={handleChange('projectNumber')}
+-            fullWidth
+-            required
++            onChange={(event) => updateProjectNumber(event.target.value)}
++            onBlur={commitProjectNumber}
++            onKeyDown={handleProjectNumberKeyDown}
++            size="small"
++            autoFocus
++            label="Project Number"
++            sx={{ minWidth: 160 }}
+           />
+-        </Grid>
+-        <Grid item xs={12} sm={6}>
+-          <TextField
+-            label="Client Company"
+-            value={form.clientCompany}
+-            onChange={handleChange('clientCompany')}
+-            fullWidth
++        ) : (
++          <Chip
++            label={form.projectNumber || defaultProjectNumber}
++            variant="outlined"
++            onClick={() => setEditingProjectNumber(true)}
++            sx={{ cursor: 'pointer' }}
+           />
+-        </Grid>
++        )}
++        <Chip
++          label={form.subsidiary || defaultSubsidiary}
++          color="primary"
++          variant="outlined"
++          size="small"
 +        />
-+        <Rnd
-+          size={size}
-+          position={position}
-+          bounds='window'
-+          minWidth={MIN_WIDTH}
-+          minHeight={MIN_HEIGHT}
-+          onDragStop={handleDragStop}
-+          onResizeStop={handleResizeStop}
-+          enableResizing
-+        >
++      </Stack>
++      <Divider />
++      {error && <Alert severity="error">{error}</Alert>}
++      <Grid container spacing={2}>
+         <Grid item xs={12}>
+           <TextField
+             label="Project Title"
+@@ -240,7 +298,7 @@ export function ProjectDatabaseCreateForm({
+             fullWidth
+           />
+         </Grid>
+-        <Grid item xs={12}>
++        <Grid item xs={12} sm={6}>
+           <TextField
+             label="Project Nature"
+             value={form.projectNature}
+@@ -258,9 +316,9 @@ export function ProjectDatabaseCreateForm({
+         </Grid>
+         <Grid item xs={12} sm={6}>
+           <TextField
+-            label="Subsidiary"
+-            value={form.subsidiary}
+-            onChange={handleChange('subsidiary')}
++            label="Client Company"
++            value={form.clientCompany}
++            onChange={handleChange('clientCompany')}
+             fullWidth
+           />
+         </Grid>
+@@ -274,17 +332,6 @@ export function ProjectDatabaseCreateForm({
+             InputLabelProps={{ shrink: true }}
+           />
+         </Grid>
+-        <Grid item xs={12} sm={6}>
+-          <TextField
+-            label="Paid On"
+-            type="date"
+-            value={form.onDate}
+-            onChange={handleChange('onDate')}
+-            fullWidth
+-            InputLabelProps={{ shrink: true }}
+-            disabled={!form.paid}
+-          />
+-        </Grid>
+         <Grid item xs={12} sm={6}>
+           <TextField
+             label="Amount"
+@@ -303,17 +350,38 @@ export function ProjectDatabaseCreateForm({
+         </Grid>
+         <Grid item xs={12} sm={6}>
+           <TextField
+-            label="Pay To"
+-            value={form.paidTo}
+-            onChange={handleChange('paidTo')}
++            label="Paid On"
++            type="date"
++            value={form.onDate}
++            onChange={handleChange('onDate')}
+             fullWidth
++            InputLabelProps={{ shrink: true }}
+             disabled={!form.paid}
+           />
+         </Grid>
+         <Grid item xs={12} sm={6}>
+-          <FormControlLabel
+-            control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
+-            label="Paid"
 +          <Box
 +            sx={{
-+              bgcolor: 'background.paper',
 +              height: '100%',
 +              display: 'flex',
-+              flexDirection: 'column',
-+              boxShadow: 6,
-+              borderRadius: 1,
-+              overflow: 'hidden',
++              alignItems: { xs: 'flex-start', sm: 'center' },
++              justifyContent: { xs: 'flex-start', sm: 'flex-start' },
++              pt: { xs: 1.5, sm: 0 },
 +            }}
 +          >
-+            <Box
-+              ref={contentRef}
-+              sx={{
-+                flexGrow: 1,
-+                overflow: 'auto',
-+                p: { xs: 2, sm: 3 },
-+              }}
-+            >
-+              <ProjectDatabaseDetailContent
-+                project={project}
-+                headerActions={headerActions}
-+                onClose={onClose}
-+                onEdit={onEdit}
-+              />
-+            </Box>
++            <FormControlLabel
++              control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
++              label="Paid"
++            />
 +          </Box>
-+        </Rnd>
-+      </Box>
-+    </Fade>,
-+    portalTarget
-+  )
-+}
-diff --git a/components/projectdialog/ProjectDatabaseEditDialog.tsx b/components/projectdialog/ProjectDatabaseEditDialog.tsx
-new file mode 100644
-index 0000000..8a75d5c
---- /dev/null
-+++ b/components/projectdialog/ProjectDatabaseEditDialog.tsx
-@@ -0,0 +1,297 @@
++        </Grid>
++        <Grid item xs={12}>
++          <TextField
++            label="Pay To"
++            value={form.paidTo}
++            onChange={handleChange('paidTo')}
++            fullWidth
++            disabled={!form.paid}
+           />
+         </Grid>
+       </Grid>
+@@ -336,6 +404,7 @@ export default function ProjectDatabaseCreateDialog({
+   onClose,
+   onCreated,
+   onDetach,
++  existingProjectNumbers,
+ }: ProjectDatabaseCreateDialogProps) {
+   const [busy, setBusy] = useState(false)
+ 
+@@ -347,7 +416,7 @@ export default function ProjectDatabaseCreateDialog({
+     <ProjectDatabaseWindow
+       open={open}
+       onClose={busy ? () => {} : onClose}
+-      contentSx={{ p: { xs: 2.5, sm: 3 } }}
++      contentSx={{ p: { xs: 2.5, sm: 3 }, maxWidth: 640, mx: 'auto' }}
+     >
+       <ProjectDatabaseCreateForm
+         year={year}
+@@ -357,6 +426,7 @@ export default function ProjectDatabaseCreateDialog({
+         variant="dialog"
+         resetToken={open}
+         onBusyChange={setBusy}
++        existingProjectNumbers={existingProjectNumbers}
+       />
+     </ProjectDatabaseWindow>
+   )
+diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
+index e136869..ddf58ab 100644
+--- a/components/projectdialog/ProjectDatabaseDetailContent.tsx
++++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
+@@ -1,4 +1,4 @@
+-import { useMemo } from 'react'
 +import { useEffect, useMemo, useState } from 'react'
+ 
+ import {
+   Box,
+@@ -12,12 +12,38 @@ import {
+ import CloseIcon from '@mui/icons-material/Close'
+ import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
+ import { Cormorant_Infant } from 'next/font/google'
++import { fetchBankAccountsDirectory, buildBankAccountLabel } from '../../lib/bankAccountsDirectory'
+ 
+ import type { ProjectRecord } from '../../lib/projectsDatabase'
+ import type { ReactNode } from 'react'
+ 
+ const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
+ 
++interface TextSegment {
++  text: string
++  isCjk: boolean
++}
 +
-+import {
-+  Alert,
-+  Box,
-+  Button,
-+  Dialog,
-+  DialogActions,
-+  DialogContent,
-+  DialogTitle,
-+  FormControlLabel,
-+  Grid,
-+  Switch,
-+  TextField,
-+  Typography,
-+} from '@mui/material'
-+import type { ProjectRecord } from '../../lib/projectsDatabase'
++const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/
 +
-+interface ProjectDatabaseEditDialogProps {
-+  open: boolean
-+  project: ProjectRecord | null
-+  onClose: () => void
-+  onSaved: () => void
-+}
++const splitByCjkSegments = (value: string | null | undefined): TextSegment[] => {
++  if (!value) {
++    return []
++  }
 +
-+interface FormState {
-+  projectNumber: string
-+  projectTitle: string
-+  projectNature: string
-+  clientCompany: string
-+  amount: string
-+  paid: boolean
-+  paidTo: string
-+  invoice: string
-+  presenterWorkType: string
-+  subsidiary: string
-+  projectDate: string
-+  onDate: string
++  const segments: TextSegment[] = []
++  for (const char of Array.from(value)) {
++    const isCjk = CJK_REGEX.test(char)
++    const last = segments[segments.length - 1]
++    if (last && last.isCjk === isCjk) {
++      last.text += char
++    } else {
++      segments.push({ text: char, isCjk })
++    }
++  }
++  return segments
 +}
 +
-+const toDateInputValue = (value: string | null) => {
-+  if (!value) return ''
-+  const parsed = new Date(value)
-+  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
-+}
+ const textOrNA = (value: string | null | undefined) =>
+   value && value.trim().length > 0 ? value : 'N/A'
+ 
+@@ -42,6 +68,28 @@ const valueSx = {
+   lineHeight: 1.3,
+ } as const
+ 
++let bankAccountLabelCache: Map<string, string> | null = null
++let bankAccountLabelPromise: Promise<Map<string, string>> | null = null
 +
-+const toIsoUtcStringOrNull = (value: string) => {
-+  if (!value) return null
-+  const isoLocalMidnight = `${value}T00:00:00+08:00`
-+  const date = new Date(isoLocalMidnight)
-+  return Number.isNaN(date.getTime()) ? null : date.toISOString()
++const getBankAccountLabelMap = async (): Promise<Map<string, string>> => {
++  if (bankAccountLabelCache) {
++    return bankAccountLabelCache
++  }
++  if (!bankAccountLabelPromise) {
++    bankAccountLabelPromise = fetchBankAccountsDirectory().then((records) => {
++      const map = new Map<string, string>()
++      records.forEach((record) => {
++        map.set(record.accountId, buildBankAccountLabel(record))
++      })
++      bankAccountLabelCache = map
++      return map
++    })
++  }
++  return bankAccountLabelPromise
 +}
 +
-+const sanitizeText = (value: string) => {
-+  const trimmed = value.trim()
-+  return trimmed.length === 0 ? null : trimmed
-+}
++void getBankAccountLabelMap()
 +
-+export default function ProjectDatabaseEditDialog({
-+  open,
-+  project,
-+  onClose,
-+  onSaved,
-+}: ProjectDatabaseEditDialogProps) {
-+  const [form, setForm] = useState<FormState | null>(null)
-+  const [saving, setSaving] = useState(false)
-+  const [error, setError] = useState<string | null>(null)
+ interface ProjectDatabaseDetailContentProps {
+   project: ProjectRecord
+   headerActions?: ReactNode
+@@ -55,6 +103,48 @@ export default function ProjectDatabaseDetailContent({
+   onClose,
+   onEdit,
+ }: ProjectDatabaseDetailContentProps) {
++  const [payToLabel, setPayToLabel] = useState<string | null>(() =>
++    project.paidTo && bankAccountLabelCache?.has(project.paidTo)
++      ? bankAccountLabelCache.get(project.paidTo) ?? null
++      : null
++  )
 +
 +  useEffect(() => {
-+    if (!project) {
-+      setForm(null)
-+      return
-+    }
++    let cancelled = false
 +
-+    setForm({
-+      projectNumber: project.projectNumber ?? '',
-+      projectTitle: project.projectTitle ?? '',
-+      projectNature: project.projectNature ?? '',
-+      clientCompany: project.clientCompany ?? '',
-+      amount:
-+        project.amount !== null && project.amount !== undefined
-+          ? String(project.amount)
-+          : '',
-+      paid: Boolean(project.paid),
-+      paidTo: project.paidTo ?? '',
-+      invoice: project.invoice ?? '',
-+      presenterWorkType: project.presenterWorkType ?? '',
-+      subsidiary: project.subsidiary ?? '',
-+      projectDate: toDateInputValue(project.projectDateIso),
-+      onDate: toDateInputValue(project.onDateIso),
-+    })
-+    setError(null)
-+  }, [project])
++    const load = async () => {
++      if (!project.paidTo) {
++        if (!cancelled) {
++          setPayToLabel(null)
++        }
++        return
++      }
 +
-+  const disabled = useMemo(() => saving || !form || !project, [saving, form, project])
++      if (bankAccountLabelCache?.has(project.paidTo)) {
++        setPayToLabel(bankAccountLabelCache.get(project.paidTo) ?? null)
++        return
++      }
 +
-+  const handleChange = (field: keyof FormState) =>
-+    (event: React.ChangeEvent<HTMLInputElement>) => {
-+      if (!form) return
-+      setForm({ ...form, [field]: event.target.value })
++      try {
++        const map = await getBankAccountLabelMap()
++        if (!cancelled) {
++          setPayToLabel(map.get(project.paidTo) ?? null)
++        }
++      } catch (err) {
++        console.error('[ProjectDatabaseDetailContent] failed to load bank account labels:', err)
++        if (!cancelled) {
++          setPayToLabel(null)
++        }
++      }
 +    }
 +
-+  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
-+    if (!form) return
-+    setForm({ ...form, paid: checked })
-+  }
-+
-+  const handleSubmit = async () => {
-+    if (!project || !form) return
++    load()
 +
-+    setSaving(true)
-+    setError(null)
-+
-+    const amountValue = form.amount.trim()
-+    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
-+    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
-+      setError('Amount must be a number')
-+      setSaving(false)
-+      return
++    return () => {
++      cancelled = true
 +    }
++  }, [project.paidTo])
 +
-+    const updates: Record<string, unknown> = {
-+      projectNumber: sanitizeText(form.projectNumber),
-+      projectTitle: sanitizeText(form.projectTitle),
-+      projectNature: sanitizeText(form.projectNature),
-+      clientCompany: sanitizeText(form.clientCompany),
-+      presenterWorkType: sanitizeText(form.presenterWorkType),
-+      subsidiary: sanitizeText(form.subsidiary),
-+      invoice: sanitizeText(form.invoice),
-+      paidTo: sanitizeText(form.paidTo),
-+      paid: form.paid,
-+    }
+   const detailItems = useMemo(() => {
+     const invoiceValue: ReactNode = project.invoice
+       ? project.invoice.startsWith('http')
+@@ -83,20 +173,20 @@ export default function ProjectDatabaseDetailContent({
+         label: 'Paid On',
+         value: project.paid ? project.onDateDisplay ?? '-' : '-',
+       },
+-      { label: 'Pay To', value: textOrNA(project.paidTo) },
++      {
++        label: 'Pay To',
++        value: payToLabel ?? textOrNA(project.paidTo),
++      },
+       { label: 'Invoice', value: invoiceValue },
+     ] satisfies Array<{ label: string; value: ReactNode }>
+-  }, [project])
++  }, [payToLabel, project])
+ 
+-  const rawPresenter = textOrNA(project.presenterWorkType)
+-  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
+-  const hasCjkCharacters = (value: string | null | undefined) =>
+-    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
++  const presenterBase = textOrNA(project.presenterWorkType)
++  const presenterText = presenterBase === 'N/A' ? presenterBase : `${presenterBase} -`
++  const presenterSegments = splitByCjkSegments(presenterText)
+ 
+-  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
+-  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
+-
+-  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
++  const projectTitleText = textOrNA(project.projectTitle)
++  const titleSegments = splitByCjkSegments(projectTitleText)
+ 
+   return (
+     <Stack spacing={1.2}>
+@@ -121,19 +211,32 @@ export default function ProjectDatabaseDetailContent({
+               </IconButton>
+             )}
+           </Stack>
+-          <Typography
+-            variant='subtitle1'
+-            sx={{ color: 'text.primary' }}
+-            className={presenterClassName}
+-          >
+-            {presenterText}
++          <Typography variant='subtitle1' sx={{ color: 'text.primary' }}>
++            {presenterSegments.length === 0
++              ? presenterText
++              : presenterSegments.map((segment, index) => (
++                  <span
++                    key={`presenter-segment-${index}`}
++                    className={segment.isCjk ? 'iansui-text' : 'federo-text'}
++                  >
++                    {segment.text}
++                  </span>
++                ))}
+           </Typography>
+           <Typography
+             variant='h4'
+-            className={hasCjkInTitle ? 'yuji-title' : undefined}
+-            sx={{ fontFamily: hasCjkInTitle ? undefined : 'Cantata One', lineHeight: 1.2 }}
++            sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}
+           >
+-            {textOrNA(project.projectTitle)}
++            {titleSegments.length === 0
++              ? projectTitleText
++              : titleSegments.map((segment, index) => (
++                  <span
++                    key={`title-segment-${index}`}
++                    className={segment.isCjk ? 'yuji-title' : undefined}
++                  >
++                    {segment.text}
++                  </span>
++                ))}
+           </Typography>
+           <Typography variant='body1' color='text.secondary'>
+             {textOrNA(project.projectNature)}
+diff --git a/components/projectdialog/projectFormUtils.ts b/components/projectdialog/projectFormUtils.ts
+index 0e0a19a..6dfc761 100644
+--- a/components/projectdialog/projectFormUtils.ts
++++ b/components/projectdialog/projectFormUtils.ts
+@@ -15,3 +15,82 @@ export const sanitizeText = (value: string) => {
+   const trimmed = value.trim()
+   return trimmed.length === 0 ? null : trimmed
+ }
 +
-+    if (form.amount.trim().length === 0) {
-+      updates.amount = null
-+    } else if (parsedAmount !== null) {
-+      updates.amount = parsedAmount
-+    }
++interface SequenceCandidate {
++  original: string
++  prefix: string
++  value: number
++  width: number
++  matchesYear: boolean
++}
 +
-+    updates.projectDate = toIsoUtcStringOrNull(form.projectDate)
-+    updates.onDate = toIsoUtcStringOrNull(form.onDate)
++const extractSequence = (text: string): Omit<SequenceCandidate, 'matchesYear'> | null => {
++  const match = text.match(/(\d+)(?!.*\d)/)
++  if (!match || match.index === undefined) {
++    return null
++  }
++  const digits = match[1]
++  const prefix = text.slice(0, match.index)
++  const value = Number.parseInt(digits, 10)
++  if (Number.isNaN(value)) {
++    return null
++  }
++  return {
++    original: text,
++    prefix,
++    value,
++    width: digits.length,
++  }
++}
 +
-+    try {
-+      const response = await fetch(
-+        `/api/projects-database/${encodeURIComponent(project.year)}/${encodeURIComponent(project.id)}`,
-+        {
-+          method: 'PATCH',
-+          headers: { 'Content-Type': 'application/json' },
-+          body: JSON.stringify({ updates }),
-+        }
-+      )
++export const generateSequentialProjectNumber = (
++  year: string | null,
++  existingNumbers: readonly string[]
++): string => {
++  const trimmedYear = year?.trim() ?? ''
++  const cleaned = existingNumbers
++    .map((value) => value?.trim())
++    .filter((value): value is string => Boolean(value))
 +
-+      if (!response.ok) {
-+        const payload = await response.json().catch(() => ({}))
-+        throw new Error(payload.error || 'Failed to update project')
++  const parsed = cleaned
++    .map((value) => {
++      const sequence = extractSequence(value)
++      if (!sequence) {
++        return null
 +      }
++      return {
++        ...sequence,
++        matchesYear:
++          trimmedYear.length > 0 &&
++          (value.startsWith(trimmedYear) || sequence.prefix.includes(trimmedYear)),
++      } satisfies SequenceCandidate
++    })
++    .filter((candidate): candidate is SequenceCandidate => Boolean(candidate))
 +
-+      onSaved()
-+    } catch (err) {
-+      const message = err instanceof Error ? err.message : 'Failed to update project'
-+      setError(message)
-+    } finally {
-+      setSaving(false)
++  const chooseCandidate = (candidates: SequenceCandidate[]): SequenceCandidate | null => {
++    if (candidates.length === 0) {
++      return null
 +    }
++    return candidates.reduce((highest, current) =>
++      current.value > highest.value ? current : highest
++    )
 +  }
 +
-+  if (!project || !form) {
-+    return null
++  const preferred = trimmedYear.length
++    ? chooseCandidate(parsed.filter((candidate) => candidate.matchesYear))
++    : null
++
++  const fallback = chooseCandidate(parsed)
++
++  const target = preferred ?? fallback
++
++  if (target) {
++    const nextValue = target.value + 1
++    const padded = String(nextValue).padStart(target.width, '0')
++    return `${target.prefix}${padded}`
 +  }
 +
-+  return (
-+    <Dialog open={open} onClose={disabled ? undefined : onClose} fullWidth maxWidth="sm">
-+      <DialogTitle>Edit Project</DialogTitle>
-+      <DialogContent dividers>
-+        <Typography variant="subtitle1" sx={{ mb: 2 }}>
-+          {project.projectNumber} — {project.projectTitle ?? 'Untitled'}
-+        </Typography>
-+        {error && (
-+          <Alert severity="error" sx={{ mb: 2 }}>
-+            {error}
-+          </Alert>
-+        )}
-+        <Grid container spacing={2}>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Project Number"
-+              value={form.projectNumber}
-+              onChange={handleChange('projectNumber')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Client Company"
-+              value={form.clientCompany}
-+              onChange={handleChange('clientCompany')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12}>
-+            <TextField
-+              label="Project Title"
-+              value={form.projectTitle}
-+              onChange={handleChange('projectTitle')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12}>
-+            <TextField
-+              label="Project Nature"
-+              value={form.projectNature}
-+              onChange={handleChange('projectNature')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Project Date"
-+              type="date"
-+              value={form.projectDate}
-+              onChange={handleChange('projectDate')}
-+              fullWidth
-+              InputLabelProps={{ shrink: true }}
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Paid On"
-+              type="date"
-+              value={form.onDate}
-+              onChange={handleChange('onDate')}
-+              fullWidth
-+              InputLabelProps={{ shrink: true }}
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Amount (HKD)"
-+              value={form.amount}
-+              onChange={handleChange('amount')}
-+              fullWidth
-+              inputMode="decimal"
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Paid To"
-+              value={form.paidTo}
-+              onChange={handleChange('paidTo')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Invoice"
-+              value={form.invoice}
-+              onChange={handleChange('invoice')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12} sm={6}>
-+            <TextField
-+              label="Presenter Work Type"
-+              value={form.presenterWorkType}
-+              onChange={handleChange('presenterWorkType')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12}>
-+            <TextField
-+              label="Subsidiary"
-+              value={form.subsidiary}
-+              onChange={handleChange('subsidiary')}
-+              fullWidth
-+            />
-+          </Grid>
-+          <Grid item xs={12}>
-+            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
-+              <FormControlLabel
-+                control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
-+                label="Paid"
-+              />
-+            </Box>
-+          </Grid>
-+        </Grid>
-+      </DialogContent>
-+      <DialogActions>
-+        <Button onClick={onClose} disabled={disabled}>
-+          Cancel
-+        </Button>
-+        <Button onClick={handleSubmit} variant="contained" disabled={disabled}>
-+          {saving ? 'Saving…' : 'Save Changes'}
-+        </Button>
-+      </DialogActions>
-+    </Dialog>
-+  )
++  const defaultPrefix = trimmedYear ? `${trimmedYear}-` : ''
++  const defaultWidth = trimmedYear ? 3 : 3
++  return `${defaultPrefix}${String(1).padStart(defaultWidth, '0')}`
 +}
 diff --git a/context-bundle.md b/context-bundle.md
-index 8756e36..6a287ad 100644
+index 3adfa99..d490d89 100644
 --- a/context-bundle.md
 +++ b/context-bundle.md
-@@ -1,810 +1,4071 @@
--# PR #249 — Diff Summary
-+# PR #252 — Diff Summary
+@@ -1,4075 +1,4047 @@
+-# PR #252 — Diff Summary
++# PR #253 — Diff Summary
  
--- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
--- **Head (source)**: `8073fcbf79fae18bc77fc3ba6aff45ef1c2659b1`
-+- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
-+- **Head (source)**: `b49d9dc07d37173d09473023cd2c0992a490e501`
+-- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
+-- **Head (source)**: `2a053e23f15309c445dcb84277e01827d6ad2eb4`
++- **Base (target)**: `7b9894aa8b8fb7fe78d46cf4b6d0cf752f0ad3da`
++- **Head (source)**: `f7a6c25336c28868c6a3fd5d9c0a6c9d4e57fee2`
  - **Repo**: `girafeev1/ArtifactoftheEstablisher`
  
  ## Changed Files
  
  ```txt
--M	components/SidebarLayout.tsx
--M	lib/firebase.ts
--A	lib/projectsDatabase.ts
--M	pages/dashboard/businesses/index.tsx
--A	pages/dashboard/businesses/projects-database/[groupId].tsx
--A	pages/dashboard/businesses/projects-database/index.tsx
-+M	.github/workflows/context-bundle-pr.yml
-+M	.github/workflows/deploy-to-vercel-prod.yml
-+M	.github/workflows/pr-diff-file.yml
-+M	.github/workflows/pr-diff-refresh.yml
-+M	.gitignore
-+D	.vercel/README.txt
-+D	.vercel/project.json
-+M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
-+M	components/StudentDialog/PaymentHistory.test.tsx
-+M	components/StudentDialog/PaymentModal.test.tsx
-+A	components/projectdialog/ProjectDatabaseDetailContent.tsx
-+A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
-+A	components/projectdialog/ProjectDatabaseEditDialog.tsx
-+M	context-bundle.md
-+M	cypress/e2e/add_payment_cascade.cy.tsx
-+A	docs/context/PR-251.md
-+A	docs/context/PR-252.md
-+M	jest.config.cjs
-+M	lib/erlDirectory.test.ts
-+M	lib/projectsDatabase.ts
-+A	lib/projectsDatabaseSelection.ts
-+A	pages/api/projects-database/[year]/[projectId].ts
-+M	pages/dashboard/businesses/projects-database/[groupId].tsx
-+A	pages/dashboard/businesses/projects-database/window.tsx
-+A	vercel.json
+-M	.github/workflows/context-bundle-pr.yml
+ M	.github/workflows/deploy-to-vercel-prod.yml
+-M	.github/workflows/pr-diff-file.yml
+-M	.github/workflows/pr-diff-refresh.yml
+-M	.gitignore
+-D	.vercel/README.txt
+-D	.vercel/project.json
+-M	__tests__/pages/dashboard/businesses/coaching-sessions.test.tsx
+-M	components/StudentDialog/PaymentHistory.test.tsx
+-M	components/StudentDialog/PaymentModal.test.tsx
+-A	components/projectdialog/ProjectDatabaseDetailContent.tsx
+-A	components/projectdialog/ProjectDatabaseDetailDialog.tsx
+-A	components/projectdialog/ProjectDatabaseEditDialog.tsx
++M	components/SidebarLayout.tsx
++M	components/projectdialog/ProjectDatabaseCreateDialog.tsx
++M	components/projectdialog/ProjectDatabaseDetailContent.tsx
++M	components/projectdialog/projectFormUtils.ts
+ M	context-bundle.md
+-M	cypress/e2e/add_payment_cascade.cy.tsx
+-A	docs/context/PR-251.md
+-A	docs/context/PR-252.md
+-M	jest.config.cjs
+-M	lib/erlDirectory.test.ts
+-M	lib/projectsDatabase.ts
+-A	lib/projectsDatabaseSelection.ts
+-M	pages/_app.tsx
+-A	pages/api/projects-database/[year]/[projectId].ts
++A	docs/context/PR-253.md
++A	lib/bankAccountsDirectory.ts
++A	lib/clientDirectory.ts
++A	pages/dashboard/businesses/client-accounts-database/index.tsx
++A	pages/dashboard/businesses/company-bank-accounts-database/index.tsx
+ M	pages/dashboard/businesses/projects-database/[groupId].tsx
+-A	pages/dashboard/businesses/projects-database/window.tsx
+-A	styles/project-dialog.css
+-A	vercel.json
++M	pages/dashboard/businesses/projects-database/new-window.tsx
  ```
  
  ## Stats
  
  ```txt
-- components/SidebarLayout.tsx                       |   7 +
-- lib/firebase.ts                                    |  12 +-
-- lib/projectsDatabase.ts                            | 220 ++++++++++++
-- pages/dashboard/businesses/index.tsx               |  43 +--
-- .../businesses/projects-database/[groupId].tsx     | 400 +++++++++++++++++++++
-- .../businesses/projects-database/index.tsx         |  14 +
-- 6 files changed, 666 insertions(+), 30 deletions(-)
-+ .github/workflows/context-bundle-pr.yml            |   36 +-
-+ .github/workflows/deploy-to-vercel-prod.yml        |   35 +-
-+ .github/workflows/pr-diff-file.yml                 |   51 -
-+ .github/workflows/pr-diff-refresh.yml              |   73 +-
-+ .gitignore                                         |    1 +
-+ .vercel/README.txt                                 |   11 -
-+ .vercel/project.json                               |    1 -
-+ .../businesses/coaching-sessions.test.tsx          |   35 +-
-+ components/StudentDialog/PaymentHistory.test.tsx   |    8 +-
-+ components/StudentDialog/PaymentModal.test.tsx     |   21 +-
-+ .../projectdialog/ProjectDatabaseDetailContent.tsx |  170 +
-+ .../projectdialog/ProjectDatabaseDetailDialog.tsx  |   44 +
-+ .../projectdialog/ProjectDatabaseEditDialog.tsx    |  295 ++
-+ context-bundle.md                                  | 4707 +++++++++++++++++---
-+ cypress/e2e/add_payment_cascade.cy.tsx             |  104 +-
-+ docs/context/PR-251.md                             | 4067 +++++++++++++++++
-+ docs/context/PR-252.md                             | 4071 +++++++++++++++++
-+ jest.config.cjs                                    |    2 +
-+ lib/erlDirectory.test.ts                           |    4 +-
-+ lib/projectsDatabase.ts                            |  109 +-
-+ lib/projectsDatabaseSelection.ts                   |   30 +
-+ pages/api/projects-database/[year]/[projectId].ts  |   63 +
-+ .../businesses/projects-database/[groupId].tsx     |  111 +-
-+ .../businesses/projects-database/window.tsx        |  107 +
-+ vercel.json                                        |    6 +
-+ 25 files changed, 13155 insertions(+), 1007 deletions(-)
+- .github/workflows/context-bundle-pr.yml            |   36 +-
+- .github/workflows/deploy-to-vercel-prod.yml        |   35 +-
+- .github/workflows/pr-diff-file.yml                 |   51 -
+- .github/workflows/pr-diff-refresh.yml              |   73 +-
+- .gitignore                                         |    1 +
+- .vercel/README.txt                                 |   11 -
+- .vercel/project.json                               |    1 -
+- .../businesses/coaching-sessions.test.tsx          |   35 +-
+- components/StudentDialog/PaymentHistory.test.tsx   |    8 +-
+- components/StudentDialog/PaymentModal.test.tsx     |   21 +-
+- .../projectdialog/ProjectDatabaseDetailContent.tsx |  178 +
+- .../projectdialog/ProjectDatabaseDetailDialog.tsx  |  201 +
+- .../projectdialog/ProjectDatabaseEditDialog.tsx    |  297 ++
+- context-bundle.md                                  | 4707 +++++++++++++++++---
+- cypress/e2e/add_payment_cascade.cy.tsx             |  104 +-
+- docs/context/PR-251.md                             | 4067 +++++++++++++++++
+- docs/context/PR-252.md                             |    1 +
+- jest.config.cjs                                    |    2 +
+- lib/erlDirectory.test.ts                           |    4 +-
+- lib/projectsDatabase.ts                            |  147 +-
+- lib/projectsDatabaseSelection.ts                   |   30 +
+- pages/_app.tsx                                     |   34 +-
+- pages/api/projects-database/[year]/[projectId].ts  |   63 +
+- .../businesses/projects-database/[groupId].tsx     |  111 +-
+- .../businesses/projects-database/window.tsx        |  177 +
+- styles/project-dialog.css                          |   20 +
+- vercel.json                                        |    6 +
+- 27 files changed, 9401 insertions(+), 1020 deletions(-)
++ .github/workflows/deploy-to-vercel-prod.yml        |   10 +-
++ components/SidebarLayout.tsx                       |   22 +
++ .../projectdialog/ProjectDatabaseCreateDialog.tsx  |  158 +-
++ .../projectdialog/ProjectDatabaseDetailContent.tsx |  135 +-
++ components/projectdialog/projectFormUtils.ts       |   79 +
++ context-bundle.md                                  | 7762 ++++++++++----------
++ docs/context/PR-253.md                             |    1 +
++ lib/bankAccountsDirectory.ts                       |  124 +
++ lib/clientDirectory.ts                             |   59 +
++ .../businesses/client-accounts-database/index.tsx  |  244 +
++ .../company-bank-accounts-database/index.tsx       |  236 +
++ .../businesses/projects-database/[groupId].tsx     |    5 +
++ .../businesses/projects-database/new-window.tsx    |   38 +-
++ 13 files changed, 4902 insertions(+), 3971 deletions(-)
  ```
  
  ## Unified Diff (truncated to first 4000 lines)
  
  ```diff
--diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
--index 9b9a192..3ba283a 100644
----- a/components/SidebarLayout.tsx
--+++ b/components/SidebarLayout.tsx
--@@ -62,6 +62,13 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
--                 </Button>
--               </Link>
--             </MenuItem>
--+            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
--+              <Link href="/dashboard/businesses/projects-database/select" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
--+                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
--+                  Projects (Database)
--+                </Button>
--+              </Link>
--+            </MenuItem>
--             <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
--               <Link href="/dashboard/businesses/coaching-sessions" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
--                 <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
--diff --git a/lib/firebase.ts b/lib/firebase.ts
--index 5fe04d2..35c04e9 100644
----- a/lib/firebase.ts
--+++ b/lib/firebase.ts
--@@ -17,13 +17,19 @@ Object.entries(firebaseConfig).forEach(([k, v]) => {
--   console.log(`   ${k}: ${v}`)
-- })
-+diff --git a/.github/workflows/context-bundle-pr.yml b/.github/workflows/context-bundle-pr.yml
-+index eae6a8a..73f53ce 100644
-+--- a/.github/workflows/context-bundle-pr.yml
-++++ b/.github/workflows/context-bundle-pr.yml
-+@@ -53,31 +53,11 @@ jobs:
-+           git commit -m "chore(context): update PR #${{ github.event.number }}"
-+           git push origin HEAD:${{ github.head_ref }}
+-diff --git a/.github/workflows/context-bundle-pr.yml b/.github/workflows/context-bundle-pr.yml
+-index eae6a8a..73f53ce 100644
+---- a/.github/workflows/context-bundle-pr.yml
+-+++ b/.github/workflows/context-bundle-pr.yml
+-@@ -53,31 +53,11 @@ jobs:
+-           git commit -m "chore(context): update PR #${{ github.event.number }}"
+-           git push origin HEAD:${{ github.head_ref }}
+- 
+--      # 🔗 Upsert a single comment with evergreen & snapshot links
+--      - name: Comment links on PR
+--        if: always()
+--        uses: actions/github-script@v7
+--        with:
+--          script: |
+--            const pr = context.payload.pull_request;
+--            const owner = context.repo.owner;
+--            const repo  = context.repo.repo;
+--            const headRef = pr.head.ref;
+--            const headSha = pr.head.sha;
+--            const n = pr.number;
+--            const evergreen = `https://github.com/${owner}/${repo}/blob/${headRef}/docs/context/PR-${n}.md`;
+--            const snapshot  = `https://raw.githubusercontent.com/${owner}/${repo}/${headSha}/docs/context/PR-${n}.md`;
+--            const body = [
+--              `**Diff file generated ✅**`,
+--              ``,
+--              `Evergreen: ${evergreen}`,
+--              `Snapshot: ${snapshot}`,
+--              `File path: docs/context/PR-${n}.md`
+--            ].join('\n');
+--            const { data: comments } = await github.rest.issues.listComments({ owner, repo, issue_number: n });
+--            const mine = comments.find(c => c.user.type === 'Bot' && c.body?.includes('Diff file generated ✅'));
+--            if (mine) {
+--              await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
+--            } else {
+--              await github.rest.issues.createComment({ owner, repo, issue_number: n, body });
+--            }
+-+      - name: Log context bundle update
+-+        if: steps.ctxdiff.outputs.changed == 'true'
+-+        run: |
+-+          {
+-+            echo "## Context bundle updated"
+-+            echo "- PR: #${{ github.event.number }}"
+-+            echo "- File: docs/context/PR-${{ github.event.number }}.md"
+-+          } >> "$GITHUB_STEP_SUMMARY"
+ diff --git a/.github/workflows/deploy-to-vercel-prod.yml b/.github/workflows/deploy-to-vercel-prod.yml
+-index 542388b..abbe8c4 100644
++index abbe8c4..e5d0142 100644
+ --- a/.github/workflows/deploy-to-vercel-prod.yml
+ +++ b/.github/workflows/deploy-to-vercel-prod.yml
+-@@ -1,36 +1,22 @@
+--name: Deploy Codex PR to Vercel Production
+-+name: Deploy to Vercel Production
++@@ -1,22 +1,20 @@
++ name: Deploy to Vercel Production
   
---const databaseId = 'mel-sessions'
---console.log('📚 Firestore database ID:', databaseId)
--+const DEFAULT_DATABASE_ID = 'mel-sessions'
--+const PROJECTS_DATABASE_ID = 'epl-projects'
--+
--+console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
--+console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
-+-      # 🔗 Upsert a single comment with evergreen & snapshot links
-+-      - name: Comment links on PR
-+-        if: always()
-+-        uses: actions/github-script@v7
-+-        with:
-+-          script: |
-+-            const pr = context.payload.pull_request;
-+-            const owner = context.repo.owner;
-+-            const repo  = context.repo.repo;
-+-            const headRef = pr.head.ref;
-+-            const headSha = pr.head.sha;
-+-            const n = pr.number;
-+-            const evergreen = `https://github.com/${owner}/${repo}/blob/${headRef}/docs/context/PR-${n}.md`;
-+-            const snapshot  = `https://raw.githubusercontent.com/${owner}/${repo}/${headSha}/docs/context/PR-${n}.md`;
-+-            const body = [
-+-              `**Diff file generated ✅**`,
-+-              ``,
-+-              `Evergreen: ${evergreen}`,
-+-              `Snapshot: ${snapshot}`,
-+-              `File path: docs/context/PR-${n}.md`
-+-            ].join('\n');
-+-            const { data: comments } = await github.rest.issues.listComments({ owner, repo, issue_number: n });
-+-            const mine = comments.find(c => c.user.type === 'Bot' && c.body?.includes('Diff file generated ✅'));
-+-            if (mine) {
-+-              await github.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
-+-            } else {
-+-              await github.rest.issues.createComment({ owner, repo, issue_number: n, body });
-+-            }
-++      - name: Log context bundle update
-++        if: steps.ctxdiff.outputs.changed == 'true'
-++        run: |
-++          {
-++            echo "## Context bundle updated"
-++            echo "- PR: #${{ github.event.number }}"
-++            echo "- File: docs/context/PR-${{ github.event.number }}.md"
-++          } >> "$GITHUB_STEP_SUMMARY"
-+diff --git a/.github/workflows/deploy-to-vercel-prod.yml b/.github/workflows/deploy-to-vercel-prod.yml
-+index 542388b..abbe8c4 100644
-+--- a/.github/workflows/deploy-to-vercel-prod.yml
-++++ b/.github/workflows/deploy-to-vercel-prod.yml
-+@@ -1,36 +1,22 @@
-+-name: Deploy Codex PR to Vercel Production
-++name: Deploy to Vercel Production
+  on:
+--  push:
+--    branches:
+--      - main
+--      - shwdtf-*          # your Codex PRs
+--      - codex/*           # additional Codex-style branches
+--    # BLACKLIST ONLY: if a push changes ONLY these paths, the job won't run
+--    paths-ignore:
+--      - 'docs/**'
+--      - 'prompts/**'
+--      - '.github/**'      # editing workflows should NOT deploy your app
+--      - '**/*.md'         # any markdown-only change (README, etc.)
+--
+--  # keep manual runs available (optional)
+--  workflow_dispatch: {}
+-+  pull_request:
+-+    types: [opened, synchronize, reopened, ready_for_review]
++-  pull_request:
++-    types: [opened, synchronize, reopened, ready_for_review]
+++  push:
+++    branches: ['**']
   
-- export const app = !getApps().length
--   ? initializeApp(firebaseConfig)
--   : getApp()
---export const db = getFirestore(app, databaseId)
--+export const db = getFirestore(app, DEFAULT_DATABASE_ID)
--+export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
--+export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
--+export const getFirestoreForDatabase = (databaseId: string) => getFirestore(app, databaseId)
-- // after you create/export `db`...
-- if (typeof window !== 'undefined') {
--   // @ts-expect-error attach for debugging
--diff --git a/lib/projectsDatabase.ts b/lib/projectsDatabase.ts
--new file mode 100644
--index 0000000..4c054ce
----- /dev/null
--+++ b/lib/projectsDatabase.ts
--@@ -0,0 +1,220 @@
--+// lib/projectsDatabase.ts
--+
--+import { collection, getDocs, Timestamp } from 'firebase/firestore'
--+
--+import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from './firebase'
--+
--+const YEAR_ID_PATTERN = /^\d{4}$/
--+const FALLBACK_YEAR_IDS = ['2025', '2024', '2023', '2022', '2021']
--+
--+interface ListCollectionIdsResponse {
--+  collectionIds?: string[]
--+  error?: { message?: string }
--+}
--+
--+export interface ProjectRecord {
--+  id: string
--+  year: string
--+  amount: number | null
--+  clientCompany: string | null
--+  invoice: string | null
--+  onDateDisplay: string | null
--+  onDateIso: string | null
--+  paid: boolean | null
--+  paidTo: string | null
--+  presenterWorkType: string | null
--+  projectDateDisplay: string | null
--+  projectDateIso: string | null
--+  projectNature: string | null
--+  projectNumber: string
--+  projectTitle: string | null
--+  subsidiary: string | null
--+}
--+
--+export interface ProjectsDatabaseResult {
--+  projects: ProjectRecord[]
--+  years: string[]
--+}
--+
--+const toTimestamp = (value: unknown): Timestamp | null => {
--+  if (value instanceof Timestamp) {
--+    return value
-+ on:
-+-  push:
-+-    branches:
-+-      - main
-+-      - shwdtf-*          # your Codex PRs
-+-      - codex/*           # additional Codex-style branches
-+-    # BLACKLIST ONLY: if a push changes ONLY these paths, the job won't run
-+-    paths-ignore:
-+-      - 'docs/**'
-+-      - 'prompts/**'
-+-      - '.github/**'      # editing workflows should NOT deploy your app
-+-      - '**/*.md'         # any markdown-only change (README, etc.)
-+-
-+-  # keep manual runs available (optional)
-+-  workflow_dispatch: {}
-++  pull_request:
-++    types: [opened, synchronize, reopened, ready_for_review]
-+ 
-+ permissions:
-+   contents: read
-+   deployments: write
-+ 
-+ concurrency:
-+-  group: vercel-prod-${{ github.ref }}
-++  group: vercel-prod-${{ github.event.pull_request.number }}
-+   cancel-in-progress: true
-+ 
-+ jobs:
-+   deploy:
-+-      if: |
-+-      !contains(github.event.head_commit.message, 'chore(context)') &&
-+-      !contains(github.event.head_commit.message, 'archive PR')
-+-    runs-on: ubuntu-latest
-+-    steps:
-++    if: >-
-++      github.event.pull_request.head.repo.full_name == github.repository &&
-++      github.event.pull_request.draft == false
-+     runs-on: ubuntu-latest
-+     steps:
-+       - uses: actions/checkout@v4
-+@@ -39,27 +25,24 @@ jobs:
-+         with:
-+           node-version: 20
-+ 
-+-      - name: Install deps
-++      - name: Install dependencies
-+         run: npm ci
-+ 
-+       - name: Install Vercel CLI
-+         run: npm i -g vercel@latest
-+ 
-+-      # Pull environment (Production)
-+-      - name: Link Vercel project (prod)
-++      - name: Pull production environment
-+         run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
-+         env:
-+           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-+           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
-+ 
-+-      # Build locally using Vercel build (produces .vercel/output)
-+       - name: Build
-+         run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
-+         env:
-+           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-+           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
-+ 
-+-      # Deploy the prebuilt output as Production
-+       - name: Deploy to Production
-+         run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
-+         env:
-+diff --git a/.github/workflows/pr-diff-file.yml b/.github/workflows/pr-diff-file.yml
-+index e341d18..c7b5809 100644
-+--- a/.github/workflows/pr-diff-file.yml
-++++ b/.github/workflows/pr-diff-file.yml
-+@@ -99,54 +99,3 @@ jobs:
-+           fi
-+           # Capture post-commit SHA so Snapshot points to the commit that actually contains the file
-+           echo "post_commit_sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
-+-
-+-      - name: Compose links
-+-        id: links
-+-        shell: bash
-+-        env:
-+-          OWNER_REPO: ${{ github.repository }}
-+-          BRANCH: ${{ github.event.pull_request.head.ref }}
-+-          PR_NUMBER: ${{ github.event.number }}
-+-          HEAD_SHA: ${{ steps.diff.outputs.head_sha }}          # pre-commit head
-+-          POST_SHA: ${{ steps.commit.outputs.post_commit_sha }} # post-commit head (if same-repo)
-+-        run: |
-+-          FILE="docs/context/PR-${PR_NUMBER}.md"
-+-          echo "evergreen=https://github.com/${OWNER_REPO}/blob/${BRANCH}/${FILE}" >> "$GITHUB_OUTPUT"
-+-          SNAP="${POST_SHA:-$HEAD_SHA}"
-+-          echo "snapshot=https://raw.githubusercontent.com/${OWNER_REPO}/${SNAP}/${FILE}" >> "$GITHUB_OUTPUT"
-+-
-+-      - name: Post sticky comment with links (or inline preview for forks)
-+-        uses: actions/github-script@v7
-+-        env:
-+-          EVERGREEN: ${{ steps.links.outputs.evergreen }}
-+-          SNAPSHOT: ${{ steps.links.outputs.snapshot }}
-+-          FROM_SAME_REPO: ${{ steps.ownership.outputs.same_repo }}
-+-        with:
-+-          script: |
-+-            const pr = context.payload.pull_request;
-+-            const sameRepo = process.env.FROM_SAME_REPO === 'true';
-+-
-+-            // Small inline preview (first 250 lines)
-+-            const fs = require('fs');
-+-            let inline = '';
-+-            try {
-+-              const preview = fs.readFileSync(`docs/context/PR-${pr.number}.md`, 'utf8')
-+-                .split('\n').slice(0, 250).join('\n');
-+-              inline = `\n<details><summary>Preview (first 250 lines)</summary>\n\n\`\`\`md\n${preview}\n\`\`\`\n\n</details>\n`;
-+-            } catch {}
-+-
-+-            const marker = '<!-- pr-diff-file-sticky -->';
-+-            const body = sameRepo
-+-              ? `**Diff file generated** ✅\n\n- **Evergreen:** ${process.env.EVERGREEN}\n- **Snapshot:** ${process.env.SNAPSHOT}\n\n_File path:_ \`docs/context/PR-${pr.number}.md\`${inline}\n${marker}`
-+-              : `**Diff generated (fork PR)** ⚠️\nWorkflows cannot push files back to fork branches.\n${inline}\n${marker}`;
-+-
-+-            const { data: comments } = await github.rest.issues.listComments({
-+-              ...context.repo, issue_number: pr.number, per_page: 100
-+-            });
-+-
-+-            const existing = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker));
-+-            if (existing) {
-+-              await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
-+-            } else {
-+-              await github.rest.issues.createComment({ ...context.repo, issue_number: pr.number, body });
-+-            }
-+diff --git a/.github/workflows/pr-diff-refresh.yml b/.github/workflows/pr-diff-refresh.yml
-+index b45ba7a..e33b1cb 100644
-+--- a/.github/workflows/pr-diff-refresh.yml
-++++ b/.github/workflows/pr-diff-refresh.yml
-+@@ -158,74 +158,13 @@ jobs:
-+             /tmp/diff.patch
-+           if-no-files-found: ignore
-+ 
-+-      - name: Compose links
-+-        id: links
-+-        env:
-+-          OWNER_REPO: ${{ github.repository }}
-+-          BRANCH: ${{ needs.resolve.outputs.head_ref }}
-+-          PR_NUMBER: ${{ needs.resolve.outputs.pr_number }}
-+-          # Prefer the new commit SHA if we made one, else the original head SHA
-+-          HEAD_SHA: ${{ steps.commit.outputs.head_after || needs.resolve.outputs.head_sha }}
-++      - name: Log diff refresh location
-+         run: |
-+-          FILE="docs/context/PR-${PR_NUMBER}.md"
-+-          echo "evergreen=https://github.com/${OWNER_REPO}/blob/${BRANCH}/${FILE}" >> "$GITHUB_OUTPUT"
-+-          echo "snapshot=https://raw.githubusercontent.com/${OWNER_REPO}/${HEAD_SHA}/${FILE}" >> "$GITHUB_OUTPUT"
-+-          echo "run_url=https://github.com/${OWNER_REPO}/actions/runs/${GITHUB_RUN_ID}" >> "$GITHUB_OUTPUT"
-+-
-+-      - name: Post sticky comment
-+-        uses: actions/github-script@v7
-+-        env:
-+-          EVERGREEN: ${{ steps.links.outputs.evergreen }}
-+-          SNAPSHOT:  ${{ steps.links.outputs.snapshot }}
-+-          RUN_URL:   ${{ steps.links.outputs.run_url }}
-+-          IS_SAME:   ${{ needs.resolve.outputs.same_repo }}
-+-        with:
-+-          script: |
-+-            const prNumber = Number("${{ needs.resolve.outputs.pr_number }}");
-+-            const marker = "<!-- pr-diff-refresh-sticky -->";
-+-
-+-            let body;
-+-            if (process.env.IS_SAME === 'true') {
-+-              body = [
-+-                `**Diff file refreshed** ✅`,
-+-                ``,
-+-                `- Evergreen: ${process.env.EVERGREEN}`,
-+-                `- Snapshot: ${process.env.SNAPSHOT}`,
-+-                ``,
-+-                `_File path:_ docs/context/PR-${prNumber}.md`,
-+-                marker
-+-              ].join('\n');
-+-            } else {
-+-              body = [
-+-                `**Diff refreshed (fork PR)** ⚠️`,
-+-                `Artifacts (download): ${process.env.RUN_URL}`,
-+-                ``,
-+-                `_Note:_ Workflows cannot push files back to fork branches.`,
-+-                marker
-+-              ].join('\n');
-+-            }
-+-
-+-            const { data: comments } = await github.rest.issues.listComments({
-+-              owner: context.repo.owner,
-+-              repo: context.repo.repo,
-+-              issue_number: prNumber
-+-            });
-+-            const existing = comments.find(c => c.user?.type === 'Bot' && c.body?.includes(marker));
-+-            if (existing) {
-+-              await github.rest.issues.updateComment({
-+-                owner: context.repo.owner,
-+-                repo: context.repo.repo,
-+-                comment_id: existing.id,
-+-                body
-+-              });
-+-            } else {
-+-              await github.rest.issues.createComment({
-+-                owner: context.repo.owner,
-+-                repo: context.repo.repo,
-+-                issue_number: prNumber,
-+-                body
-+-              });
-+-            }
-++          {
-++            echo "## Diff refreshed"
-++            echo "- PR: #${{ needs.resolve.outputs.pr_number }}"
-++            echo "- File: docs/context/PR-${{ needs.resolve.outputs.pr_number }}.md"
-++          } >> "$GITHUB_STEP_SUMMARY"
-+ 
-+       - name: Inline preview (append to comment when possible)
-+         if: always()
-+diff --git a/.gitignore b/.gitignore
-+index 588810e..2587906 100644
-+--- a/.gitignore
-++++ b/.gitignore
-+@@ -8,3 +8,4 @@
-+ *.DS_Store
-+ Invoice.JSON
-+ tsconfig.tsbuildinfo
```
