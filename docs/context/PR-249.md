# PR #249 — Diff Summary

- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
- **Head (source)**: `8073fcbf79fae18bc77fc3ba6aff45ef1c2659b1`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/SidebarLayout.tsx
M	lib/firebase.ts
A	lib/projectsDatabase.ts
M	pages/dashboard/businesses/index.tsx
A	pages/dashboard/businesses/projects-database/[groupId].tsx
A	pages/dashboard/businesses/projects-database/index.tsx
```

## Stats

```txt
 components/SidebarLayout.tsx                       |   7 +
 lib/firebase.ts                                    |  12 +-
 lib/projectsDatabase.ts                            | 220 ++++++++++++
 pages/dashboard/businesses/index.tsx               |  43 +--
 .../businesses/projects-database/[groupId].tsx     | 400 +++++++++++++++++++++
 .../businesses/projects-database/index.tsx         |  14 +
 6 files changed, 666 insertions(+), 30 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
index 9b9a192..3ba283a 100644
--- a/components/SidebarLayout.tsx
+++ b/components/SidebarLayout.tsx
@@ -62,6 +62,13 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
                 </Button>
               </Link>
             </MenuItem>
+            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
+              <Link href="/dashboard/businesses/projects-database/select" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
+                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
+                  Projects (Database)
+                </Button>
+              </Link>
+            </MenuItem>
             <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
               <Link href="/dashboard/businesses/coaching-sessions" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                 <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
diff --git a/lib/firebase.ts b/lib/firebase.ts
index 5fe04d2..35c04e9 100644
--- a/lib/firebase.ts
+++ b/lib/firebase.ts
@@ -17,13 +17,19 @@ Object.entries(firebaseConfig).forEach(([k, v]) => {
   console.log(`   ${k}: ${v}`)
 })
 
-const databaseId = 'mel-sessions'
-console.log('📚 Firestore database ID:', databaseId)
+const DEFAULT_DATABASE_ID = 'mel-sessions'
+const PROJECTS_DATABASE_ID = 'epl-projects'
+
+console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
+console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
 
 export const app = !getApps().length
   ? initializeApp(firebaseConfig)
   : getApp()
-export const db = getFirestore(app, databaseId)
+export const db = getFirestore(app, DEFAULT_DATABASE_ID)
+export const projectsDb = getFirestore(app, PROJECTS_DATABASE_ID)
+export const PROJECTS_FIRESTORE_DATABASE_ID = PROJECTS_DATABASE_ID
+export const getFirestoreForDatabase = (databaseId: string) => getFirestore(app, databaseId)
 // after you create/export `db`...
 if (typeof window !== 'undefined') {
   // @ts-expect-error attach for debugging
diff --git a/lib/projectsDatabase.ts b/lib/projectsDatabase.ts
new file mode 100644
index 0000000..4c054ce
--- /dev/null
+++ b/lib/projectsDatabase.ts
@@ -0,0 +1,220 @@
+// lib/projectsDatabase.ts
+
+import { collection, getDocs, Timestamp } from 'firebase/firestore'
+
+import { projectsDb, PROJECTS_FIRESTORE_DATABASE_ID } from './firebase'
+
+const YEAR_ID_PATTERN = /^\d{4}$/
+const FALLBACK_YEAR_IDS = ['2025', '2024', '2023', '2022', '2021']
+
+interface ListCollectionIdsResponse {
+  collectionIds?: string[]
+  error?: { message?: string }
+}
+
+export interface ProjectRecord {
+  id: string
+  year: string
+  amount: number | null
+  clientCompany: string | null
+  invoice: string | null
+  onDateDisplay: string | null
+  onDateIso: string | null
+  paid: boolean | null
+  paidTo: string | null
+  presenterWorkType: string | null
+  projectDateDisplay: string | null
+  projectDateIso: string | null
+  projectNature: string | null
+  projectNumber: string
+  projectTitle: string | null
+  subsidiary: string | null
+}
+
+export interface ProjectsDatabaseResult {
+  projects: ProjectRecord[]
+  years: string[]
+}
+
+const toTimestamp = (value: unknown): Timestamp | null => {
+  if (value instanceof Timestamp) {
+    return value
+  }
+  if (
+    value &&
+    typeof value === 'object' &&
+    'seconds' in value &&
+    'nanoseconds' in value &&
+    typeof (value as any).seconds === 'number' &&
+    typeof (value as any).nanoseconds === 'number'
+  ) {
+    return new Timestamp((value as any).seconds, (value as any).nanoseconds)
+  }
+  return null
+}
+
+const toDate = (value: unknown): Date | null => {
+  const ts = toTimestamp(value)
+  if (ts) {
+    const date = ts.toDate()
+    return isNaN(date.getTime()) ? null : date
+  }
+  if (typeof value === 'string' || value instanceof String) {
+    const parsed = new Date(value as string)
+    return isNaN(parsed.getTime()) ? null : parsed
+  }
+  if (value instanceof Date) {
+    return isNaN(value.getTime()) ? null : value
+  }
+  return null
+}
+
+const formatDisplayDate = (value: unknown): string | null => {
+  const date = toDate(value)
+  if (!date) return null
+  return date.toLocaleDateString('en-US', {
+    month: 'short',
+    day: '2-digit',
+    year: 'numeric',
+  })
+}
+
+const toIsoDate = (value: unknown): string | null => {
+  const date = toDate(value)
+  if (!date) return null
+  return date.toISOString()
+}
+
+const toStringValue = (value: unknown): string | null => {
+  if (typeof value === 'string') {
+    return value.trim() || null
+  }
+  if (value instanceof String) {
+    const trimmed = value.toString().trim()
+    return trimmed || null
+  }
+  return null
+}
+
+const toNumberValue = (value: unknown): number | null => {
+  if (typeof value === 'number' && !Number.isNaN(value)) {
+    return value
+  }
+  if (typeof value === 'string') {
+    const parsed = Number(value)
+    return Number.isNaN(parsed) ? null : parsed
+  }
+  return null
+}
+
+const toBooleanValue = (value: unknown): boolean | null => {
+  if (typeof value === 'boolean') {
+    return value
+  }
+  return null
+}
+
+const uniqueSortedYears = (values: Iterable<string>) =>
+  Array.from(new Set(values)).sort((a, b) =>
+    b.localeCompare(a, undefined, { numeric: true })
+  )
+
+const listYearCollections = async (): Promise<string[]> => {
+  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
+  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
+
+  if (!apiKey || !projectId) {
+    console.warn('[projectsDatabase] Missing Firebase configuration, falling back to defaults')
+    return [...FALLBACK_YEAR_IDS]
+  }
+
+  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents:listCollectionIds?key=${apiKey}`
+
+  try {
+    const response = await fetch(url, {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/json' },
+      body: JSON.stringify({
+        parent: `projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents`,
+        pageSize: 200,
+      }),
+    })
+
+    if (!response.ok) {
+      console.warn('[projectsDatabase] Failed to list collection IDs:', response.status, response.statusText)
+      return [...FALLBACK_YEAR_IDS]
+    }
+
+    const json = (await response.json()) as ListCollectionIdsResponse
+    if (json.error) {
+      console.warn('[projectsDatabase] Firestore responded with error:', json.error.message)
+      return [...FALLBACK_YEAR_IDS]
+    }
+
+    const ids = json.collectionIds?.filter((id) => YEAR_ID_PATTERN.test(id)) ?? []
+    if (ids.length === 0) {
+      console.warn('[projectsDatabase] No year collections found, falling back to defaults')
+      return [...FALLBACK_YEAR_IDS]
+    }
+    return uniqueSortedYears(ids)
+  } catch (err) {
+    console.warn('[projectsDatabase] listYearCollections failed:', err)
+    return [...FALLBACK_YEAR_IDS]
+  }
+}
+
+export const fetchProjectsFromDatabase = async (): Promise<ProjectsDatabaseResult> => {
+  const yearIds = await listYearCollections()
+  const projects: ProjectRecord[] = []
+  const yearsWithData = new Set<string>()
+
+  await Promise.all(
+    yearIds.map(async (year) => {
+      const snapshot = await getDocs(collection(projectsDb, year))
+      snapshot.forEach((doc) => {
+        const data = doc.data() as Record<string, unknown>
+        const projectNumber = toStringValue(data.projectNumber) ?? doc.id
+
+        const amount = toNumberValue(data.amount)
+        const projectDateIso = toIsoDate(data.projectDate)
+        const projectDateDisplay = formatDisplayDate(data.projectDate)
+        const onDateIso = toIsoDate(data.onDate)
+        const onDateDisplay = formatDisplayDate(data.onDate)
+
+        projects.push({
+          id: doc.id,
+          year,
+          amount,
+          clientCompany: toStringValue(data.clientCompany),
+          invoice: toStringValue(data.invoice),
+          onDateDisplay,
+          onDateIso,
+          paid: toBooleanValue(data.paid),
+          paidTo: toStringValue(data.paidTo),
+          presenterWorkType: toStringValue(data.presenterWorkType),
+          projectDateDisplay,
+          projectDateIso,
+          projectNature: toStringValue(data.projectNature),
+          projectNumber,
+          projectTitle: toStringValue(data.projectTitle),
+          subsidiary: toStringValue(data.subsidiary),
+        })
+
+        yearsWithData.add(year)
+      })
+    })
+  )
+
+  projects.sort((a, b) => {
+    if (a.year !== b.year) {
+      return b.year.localeCompare(a.year, undefined, { numeric: true })
+    }
+    return a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true })
+  })
+
+  return {
+    projects,
+    years: uniqueSortedYears(yearsWithData),
+  }
+}
+
diff --git a/pages/dashboard/businesses/index.tsx b/pages/dashboard/businesses/index.tsx
index 505c235..135484d 100644
--- a/pages/dashboard/businesses/index.tsx
+++ b/pages/dashboard/businesses/index.tsx
@@ -3,33 +3,22 @@
 import { GetServerSideProps } from 'next';
 import { getSession } from 'next-auth/react';
 import SidebarLayout from '../../../components/SidebarLayout';
-import { initializeApis } from '../../../lib/googleApi';
-import { listProjectOverviewFiles } from '../../../lib/projectOverview';
 import { useRouter } from 'next/router';
 import { Box, Typography, List, ListItemButton, ListItemText, Button } from '@mui/material';
-import { drive_v3 } from 'googleapis';
 
-interface BusinessFile {
-  companyIdentifier: string;
-  fullCompanyName: string;
-  file: drive_v3.Schema$File;
+interface BusinessLink {
+  title: string;
+  description: string;
+  href: string;
 }
 
 interface BusinessesPageProps {
-  projectsByCategory: Record<string, BusinessFile[]>;
+  businessLinks: BusinessLink[];
 }
 
-export default function BusinessesPage({ projectsByCategory }: BusinessesPageProps) {
+export default function BusinessesPage({ businessLinks }: BusinessesPageProps) {
   const router = useRouter();
 
-  // Flatten the grouped projects into a single array.
-  // (The original code grouped them by subsidiary code; now we sort them alphabetically by fullCompanyName.)
-  const files: BusinessFile[] = [];
-  for (const key in projectsByCategory) {
-    projectsByCategory[key].forEach((file) => files.push(file));
-  }
-  files.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));
-
   return (
     <SidebarLayout>
       <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
@@ -43,12 +32,9 @@ export default function BusinessesPage({ projectsByCategory }: BusinessesPagePro
         Select a project overview file:
       </Typography>
       <List>
-        {files.map((file) => (
-          <ListItemButton
-            key={file.file.id}
-            onClick={() => router.push(`/dashboard/businesses/${file.file.id}`)}
-          >
-            <ListItemText primary={file.fullCompanyName} secondary={file.file.name} />
+        {businessLinks.map((link) => (
+          <ListItemButton key={link.href} onClick={() => router.push(link.href)}>
+            <ListItemText primary={link.title} secondary={link.description} />
           </ListItemButton>
         ))}
       </List>
@@ -61,12 +47,15 @@ export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async
   if (!session?.accessToken) {
     return { redirect: { destination: '/api/auth/signin', permanent: false } };
   }
-  const { drive } = initializeApis('user', { accessToken: session.accessToken as string });
-  // Get the grouped project files using your existing sorting utility
-  const projectsByCategory = await listProjectOverviewFiles(drive, []);
   return {
     props: {
-      projectsByCategory,
+      businessLinks: [
+        {
+          title: 'Establish Productions Limited',
+          description: 'Projects (Database)',
+          href: '/dashboard/businesses/projects-database/select',
+        },
+      ],
     },
   };
 };
diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
new file mode 100644
index 0000000..3823567
--- /dev/null
+++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
@@ -0,0 +1,400 @@
+import { GetServerSideProps } from 'next'
+import { getSession } from 'next-auth/react'
+import { useRouter } from 'next/router'
+import { useEffect, useState } from 'react'
+
+import SidebarLayout from '../../../../components/SidebarLayout'
+import {
+  fetchProjectsFromDatabase,
+  ProjectRecord,
+} from '../../../../lib/projectsDatabase'
+
+import {
+  Box,
+  Button,
+  Card,
+  CardContent,
+  FormControl,
+  Grid,
+  IconButton,
+  InputLabel,
+  List,
+  ListItem,
+  ListItemText,
+  MenuItem,
+  Select,
+  ToggleButton,
+  ToggleButtonGroup,
+  Typography,
+} from '@mui/material'
+import type { SelectChangeEvent } from '@mui/material/Select'
+import ArrowBackIcon from '@mui/icons-material/ArrowBack'
+
+const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
+const headingSx = { fontFamily: 'Cantata One' }
+
+type SortMethod = 'year' | 'subsidiary'
+
+type Mode = 'select' | 'detail'
+
+interface DetailSelection {
+  type: SortMethod
+  year: string
+}
+
+interface ProjectsDatabasePageProps {
+  mode: Mode
+  years: string[]
+  error?: string
+  detailSelection?: DetailSelection
+  projects?: ProjectRecord[]
+}
+
+const encodeSelectionId = (type: SortMethod, year: string) => {
+  const yearPart = encodeURIComponent(year)
+  return `${type}--${yearPart}`
+}
+
+const decodeSelectionId = (value: string): DetailSelection | null => {
+  const [typePart, yearPart] = value.split('--')
+  if (!typePart || !yearPart) {
+    return null
+  }
+
+  if (typePart !== 'year' && typePart !== 'subsidiary') {
+    return null
+  }
+
+  try {
+    return { type: typePart, year: decodeURIComponent(yearPart) }
+  } catch (err) {
+    console.warn('[projects-database] Failed to decode selection id', err)
+    return null
+  }
+}
+
+const stringOrNA = (value: string | null | undefined) =>
+  value && value.trim().length > 0 ? value : 'N/A'
+
+const amountText = (value: number | null | undefined) => {
+  if (value === null || value === undefined) {
+    return '-'
+  }
+
+  return `HK$${value.toLocaleString('en-US', {
+    minimumFractionDigits: 0,
+    maximumFractionDigits: 2,
+  })}`
+}
+
+const paidStatusText = (value: boolean | null | undefined) => {
+  if (value === null || value === undefined) {
+    return 'N/A'
+  }
+  return value ? 'Paid' : 'Unpaid'
+}
+
+const paidDateText = (
+  paid: boolean | null | undefined,
+  date: string | null | undefined
+) => {
+  if (!paid) {
+    return null
+  }
+
+  return date && date.trim().length > 0 ? date : '-'
+}
+
+export default function ProjectsDatabasePage({
+  mode,
+  years,
+  error,
+  detailSelection,
+  projects = [],
+}: ProjectsDatabasePageProps) {
+  const router = useRouter()
+
+  const [sortMethod, setSortMethod] = useState<SortMethod>(
+    detailSelection?.type ?? 'year'
+  )
+  const [selectedYear, setSelectedYear] = useState<string>(
+    detailSelection?.year ?? years[0] ?? ''
+  )
+
+  const handleYearChange = (event: SelectChangeEvent<string>) => {
+    setSelectedYear(event.target.value)
+  }
+
+  useEffect(() => {
+    if (!selectedYear && years.length > 0) {
+      setSelectedYear(years[0])
+    }
+  }, [years, selectedYear])
+
+  useEffect(() => {
+    if (detailSelection) {
+      setSortMethod(detailSelection.type)
+      setSelectedYear(detailSelection.year)
+    }
+  }, [detailSelection])
+
+  const handleNavigate = (type: SortMethod, year: string) => {
+    if (!year) {
+      return
+    }
+
+    router.push(
+      `/dashboard/businesses/projects-database/${encodeSelectionId(type, year)}`
+    )
+  }
+
+  if (mode === 'select') {
+    return (
+      <SidebarLayout>
+        <Box sx={{ mb: 3 }}>
+          <Typography variant="h4" sx={headingSx} gutterBottom>
+            Projects (Database)
+          </Typography>
+          <Typography variant="h6" sx={{ ...headingSx, mt: 2 }}>
+            Establish Productions Limited
+          </Typography>
+        </Box>
+        {error && (
+          <Typography color="error" sx={{ mb: 2 }}>
+            {error}
+          </Typography>
+        )}
+        <Box
+          sx={{
+            display: 'flex',
+            flexWrap: 'wrap',
+            gap: 2,
+            alignItems: 'center',
+            mb: 3,
+          }}
+        >
+          <ToggleButtonGroup
+            value={sortMethod}
+            exclusive
+            onChange={(event, value: SortMethod | null) => {
+              if (value) {
+                setSortMethod(value)
+              }
+            }}
+            size="small"
+          >
+            <ToggleButton value="year">By Year</ToggleButton>
+            <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
+          </ToggleButtonGroup>
+          {sortMethod === 'year' && years.length > 0 && (
+            <FormControl sx={{ minWidth: 160 }}>
+              <InputLabel>Year</InputLabel>
+              <Select
+                value={selectedYear}
+                label="Year"
+                onChange={handleYearChange}
+              >
+                {years.map((year) => (
+                  <MenuItem key={year} value={year}>
+                    {year}
+                  </MenuItem>
+                ))}
+              </Select>
+            </FormControl>
+          )}
+        </Box>
+        {sortMethod === 'year' ? (
+          years.length === 0 ? (
+            <Typography>No project collections available.</Typography>
+          ) : selectedYear ? (
+            <Grid container spacing={2}>
+              <Grid item xs={12} sm={6} md={4}>
+                <Card
+                  sx={{ cursor: 'pointer', height: '100%' }}
+                  onClick={() => handleNavigate('year', selectedYear)}
+                >
+                  <CardContent>
+                    <Typography variant="h6" sx={headingSx} gutterBottom>
+                      Establish Productions Limited
+                    </Typography>
+                    <Typography sx={valueSx}>{selectedYear} Projects</Typography>
+                  </CardContent>
+                </Card>
+              </Grid>
+            </Grid>
+          ) : (
+            <Typography>Please choose a year to continue.</Typography>
+          )
+        ) : years.length === 0 ? (
+          <Typography>No project collections available.</Typography>
+        ) : (
+          <Grid container spacing={2}>
+            {years.map((year) => (
+              <Grid item xs={12} sm={6} md={4} key={year}>
+                <Card
+                  sx={{ cursor: 'pointer', height: '100%' }}
+                  onClick={() => handleNavigate('subsidiary', year)}
+                >
+                  <CardContent>
+                    <Typography variant="h6" sx={headingSx} gutterBottom>
+                      {year}
+                    </Typography>
+                    <Typography sx={valueSx}>Project Collection</Typography>
+                  </CardContent>
+                </Card>
+              </Grid>
+            ))}
+          </Grid>
+        )}
+      </SidebarLayout>
+    )
+  }
+
+  const handleBack = () => {
+    router.push('/dashboard/businesses/projects-database/select')
+  }
+
+  const headerLabel = detailSelection
+    ? detailSelection.type === 'year'
+      ? `Establish Productions Limited — ${detailSelection.year}`
+      : `${detailSelection.year} Projects`
+    : 'Projects'
+
+  return (
+    <SidebarLayout>
+      <Box
+        sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
+      >
+        <IconButton onClick={handleBack}>
+          <ArrowBackIcon />
+        </IconButton>
+        <Box sx={{ textAlign: 'center' }}>
+          <Typography variant="h5" sx={headingSx}>
+            {headerLabel}
+          </Typography>
+          <Typography sx={valueSx}>Project Overview</Typography>
+        </Box>
+        <Button
+          variant="contained"
+          onClick={() => router.push('/dashboard/businesses/new')}
+        >
+          New Project
+        </Button>
+      </Box>
+      {error && (
+        <Typography color="error" sx={{ mb: 2 }}>
+          {error}
+        </Typography>
+      )}
+      <Card>
+        <CardContent>
+          <Typography variant="h6" sx={headingSx} gutterBottom>
+            Project List
+          </Typography>
+          {projects.length === 0 ? (
+            <Typography>No project records available.</Typography>
+          ) : (
+            <List>
+              {projects.map((project) => {
+                const primary = `${stringOrNA(project.projectNumber)} — ${stringOrNA(
+                  project.projectTitle
+                )}`
+                const segments = [
+                  amountText(project.amount),
+                  paidStatusText(project.paid),
+                ]
+                const paidDate = paidDateText(project.paid, project.onDateDisplay)
+                if (paidDate) {
+                  segments.push(paidDate)
+                }
+
+                return (
+                  <ListItem
+                    key={`${project.year}-${project.projectNumber}`}
+                    alignItems="flex-start"
+                    sx={{ cursor: 'default' }}
+                  >
+                    <ListItemText
+                      primary={primary}
+                      primaryTypographyProps={{ sx: valueSx }}
+                      secondary={segments.join(' | ')}
+                      secondaryTypographyProps={{ sx: valueSx }}
+                    />
+                  </ListItem>
+                )
+              })}
+            </List>
+          )}
+        </CardContent>
+      </Card>
+    </SidebarLayout>
+  )
+}
+
+export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
+  ctx
+) => {
+  const session = await getSession(ctx)
+  if (!session?.accessToken) {
+    return { redirect: { destination: '/api/auth/signin', permanent: false } }
+  }
+
+  const groupParam = ctx.params?.groupId as string | undefined
+
+  try {
+    const { projects, years } = await fetchProjectsFromDatabase()
+
+    if (!groupParam || groupParam === 'select') {
+      return {
+        props: {
+          mode: 'select',
+          years,
+        },
+      }
+    }
+
+    const selection = decodeSelectionId(groupParam)
+    if (!selection) {
+      return {
+        props: {
+          mode: 'select',
+          years,
+          error: 'Invalid project selection, please choose again.',
+        },
+      }
+    }
+
+    if (!years.includes(selection.year)) {
+      return {
+        props: {
+          mode: 'select',
+          years,
+          error: 'Project collection not found, please choose again.',
+        },
+      }
+    }
+
+    const matchingProjects = projects.filter(
+      (project) => project.year === selection.year
+    )
+
+    return {
+      props: {
+        mode: 'detail',
+        years,
+        detailSelection: selection,
+        projects: matchingProjects,
+      },
+    }
+  } catch (err) {
+    console.error('[projects-database] Failed to load projects:', err)
+    return {
+      props: {
+        mode: 'select',
+        years: [],
+        error:
+          err instanceof Error ? err.message : 'Error retrieving project records',
+      },
+    }
+  }
+}
diff --git a/pages/dashboard/businesses/projects-database/index.tsx b/pages/dashboard/businesses/projects-database/index.tsx
new file mode 100644
index 0000000..51c3a8a
--- /dev/null
+++ b/pages/dashboard/businesses/projects-database/index.tsx
@@ -0,0 +1,14 @@
+import { GetServerSideProps } from 'next'
+
+const ProjectsDatabaseIndex = () => null
+
+export const getServerSideProps: GetServerSideProps = async () => {
+  return {
+    redirect: {
+      destination: '/dashboard/businesses/projects-database/select',
+      permanent: false,
+    },
+  }
+}
+
+export default ProjectsDatabaseIndex
```
