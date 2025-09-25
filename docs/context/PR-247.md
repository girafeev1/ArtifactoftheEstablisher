# PR #247 — Diff Summary

- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
- **Head (source)**: `db49df6f998211721a88c0a8e330cca8c5c6aff7`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/SidebarLayout.tsx
M	lib/firebase.ts
A	lib/projectsDatabase.ts
M	pages/dashboard/businesses/index.tsx
A	pages/dashboard/businesses/projects-database.tsx
```

## Stats

```txt
 components/SidebarLayout.tsx                     |   7 +
 lib/firebase.ts                                  |  12 +-
 lib/projectsDatabase.ts                          | 220 +++++++++++++++++++
 pages/dashboard/businesses/index.tsx             |  43 ++--
 pages/dashboard/businesses/projects-database.tsx | 268 +++++++++++++++++++++++
 5 files changed, 520 insertions(+), 30 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
index 9b9a192..f4d0876 100644
--- a/components/SidebarLayout.tsx
+++ b/components/SidebarLayout.tsx
@@ -62,6 +62,13 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
                 </Button>
               </Link>
             </MenuItem>
+            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
+              <Link href="/dashboard/businesses/projects-database" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
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
index 505c235..39585da 100644
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
+          href: '/dashboard/businesses/projects-database',
+        },
+      ],
     },
   };
 };
diff --git a/pages/dashboard/businesses/projects-database.tsx b/pages/dashboard/businesses/projects-database.tsx
new file mode 100644
index 0000000..3a77d8a
--- /dev/null
+++ b/pages/dashboard/businesses/projects-database.tsx
@@ -0,0 +1,268 @@
+// pages/dashboard/businesses/projects-database.tsx
+
+import { GetServerSideProps } from 'next'
+import { getSession } from 'next-auth/react'
+import { useEffect, useMemo, useState } from 'react'
+
+import SidebarLayout from '../../../components/SidebarLayout'
+import { fetchProjectsFromDatabase, ProjectRecord } from '../../../lib/projectsDatabase'
+
+import {
+  Box,
+  Card,
+  CardContent,
+  FormControl,
+  Grid,
+  InputLabel,
+  MenuItem,
+  Select,
+  ToggleButton,
+  ToggleButtonGroup,
+  Typography,
+} from '@mui/material'
+
+type SortMethod = 'year' | 'subsidiary'
+
+interface ProjectsDatabasePageProps {
+  projects: ProjectRecord[]
+  years: string[]
+  error?: string
+}
+
+const labelSx = { fontFamily: 'Newsreader', fontWeight: 200 }
+const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
+const titleSx = { fontFamily: 'Cantata One' }
+
+const stringOrNA = (value: string | null | undefined) =>
+  value && value.trim().length > 0 ? value : 'N/A'
+
+const numberOrDash = (value: number | null | undefined) =>
+  value === null || value === undefined
+    ? '-'
+    : `HK$${value.toLocaleString('en-US', {
+        minimumFractionDigits: 2,
+        maximumFractionDigits: 2,
+      })}`
+
+const dateOrDash = (value: string | null | undefined) => (value ? value : '-')
+
+const paidStatus = (value: boolean | null | undefined) => {
+  if (value === null || value === undefined) {
+    return 'N/A'
+  }
+  return value ? 'Paid' : 'Unpaid'
+}
+
+const projectCardKey = (project: ProjectRecord) =>
+  `${project.year}-${project.id}`
+
+export default function ProjectsDatabasePage({
+  projects,
+  years,
+  error,
+}: ProjectsDatabasePageProps) {
+  const [sortMethod, setSortMethod] = useState<SortMethod>('year')
+  const [selectedYear, setSelectedYear] = useState<string>('')
+  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>('')
+
+  const availableYears = useMemo(() => {
+    if (years.length > 0) return years
+    const derived = Array.from(new Set(projects.map((p) => p.year)))
+    return derived.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
+  }, [projects, years])
+
+  const subsidiaries = useMemo(() => {
+    const unique = new Set(
+      projects
+        .map((p) => p.subsidiary)
+        .filter((value): value is string => Boolean(value && value.trim()))
+    )
+    return Array.from(unique).sort((a, b) => a.localeCompare(b))
+  }, [projects])
+
+  useEffect(() => {
+    if (sortMethod === 'year') {
+      if (!selectedYear && availableYears.length > 0) {
+        setSelectedYear(availableYears[0])
+      }
+    } else if (sortMethod === 'subsidiary') {
+      if (!selectedSubsidiary && subsidiaries.length > 0) {
+        setSelectedSubsidiary(subsidiaries[0])
+      }
+    }
+  }, [sortMethod, availableYears, subsidiaries, selectedYear, selectedSubsidiary])
+
+  const filteredProjects = useMemo(() => {
+    if (sortMethod === 'year') {
+      return projects.filter((project) =>
+        selectedYear ? project.year === selectedYear : true
+      )
+    }
+    return projects.filter((project) =>
+      selectedSubsidiary ? project.subsidiary === selectedSubsidiary : true
+    )
+  }, [projects, sortMethod, selectedYear, selectedSubsidiary])
+
+  const sortedProjects = useMemo(
+    () =>
+      filteredProjects.slice().sort((a, b) => {
+        if (sortMethod === 'year') {
+          if (a.year !== b.year) {
+            return b.year.localeCompare(a.year, undefined, { numeric: true })
+          }
+        } else {
+          if ((a.subsidiary || '') !== (b.subsidiary || '')) {
+            return stringOrNA(a.subsidiary).localeCompare(
+              stringOrNA(b.subsidiary)
+            )
+          }
+        }
+        return a.projectNumber.localeCompare(b.projectNumber, undefined, {
+          numeric: true,
+        })
+      }),
+    [filteredProjects, sortMethod]
+  )
+
+  const renderField = (label: string, value: string) => (
+    <Box sx={{ mb: 1 }}>
+      <Typography sx={labelSx}>{label}:</Typography>
+      <Typography sx={valueSx}>{value}</Typography>
+    </Box>
+  )
+
+  return (
+    <SidebarLayout>
+      <Box sx={{ mb: 3 }}>
+        <Typography variant="h4" sx={titleSx} gutterBottom>
+          Projects (Database)
+        </Typography>
+        <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+          Review project records synchronized from Firestore.
+        </Typography>
+      </Box>
+      {error && (
+        <Typography color="error" sx={{ mb: 2 }}>
+          {error}
+        </Typography>
+      )}
+      <Box
+        sx={{
+          display: 'flex',
+          flexWrap: 'wrap',
+          gap: 2,
+          alignItems: 'center',
+          mb: 3,
+        }}
+      >
+        <ToggleButtonGroup
+          value={sortMethod}
+          exclusive
+          onChange={(event, value: SortMethod | null) => {
+            if (value) {
+              setSortMethod(value)
+            }
+          }}
+          size="small"
+        >
+          <ToggleButton value="year">By Year</ToggleButton>
+          <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
+        </ToggleButtonGroup>
+        {sortMethod === 'year' && availableYears.length > 0 && (
+          <FormControl sx={{ minWidth: 160 }}>
+            <InputLabel>Year</InputLabel>
+            <Select
+              value={selectedYear}
+              label="Year"
+              onChange={(event) => setSelectedYear(event.target.value)}
+            >
+              {availableYears.map((year) => (
+                <MenuItem key={year} value={year}>
+                  {year}
+                </MenuItem>
+              ))}
+            </Select>
+          </FormControl>
+        )}
+        {sortMethod === 'subsidiary' && subsidiaries.length > 0 && (
+          <FormControl sx={{ minWidth: 220 }}>
+            <InputLabel>Subsidiary</InputLabel>
+            <Select
+              value={selectedSubsidiary}
+              label="Subsidiary"
+              onChange={(event) => setSelectedSubsidiary(event.target.value)}
+            >
+              {subsidiaries.map((name) => (
+                <MenuItem key={name} value={name}>
+                  {name}
+                </MenuItem>
+              ))}
+            </Select>
+          </FormControl>
+        )}
+      </Box>
+      {sortedProjects.length === 0 ? (
+        <Typography>No projects available for the selected filters.</Typography>
+      ) : (
+        <Grid container spacing={2}>
+          {sortedProjects.map((project) => (
+            <Grid item xs={12} md={6} lg={4} key={projectCardKey(project)}>
+              <Card sx={{ height: '100%' }}>
+                <CardContent>
+                  <Typography
+                    variant="h6"
+                    sx={{ fontFamily: 'Cantata One', mb: 1 }}
+                  >
+                    {stringOrNA(project.projectNumber)}
+                  </Typography>
+                  <Typography sx={{ ...valueSx, mb: 2 }}>
+                    {stringOrNA(project.projectTitle)}
+                  </Typography>
+                  {renderField('Client Company', stringOrNA(project.clientCompany))}
+                  {renderField('Subsidiary', stringOrNA(project.subsidiary))}
+                  {renderField('Project Nature', stringOrNA(project.projectNature))}
+                  {renderField('Presenter Work Type', stringOrNA(project.presenterWorkType))}
+                  {renderField('Invoice Number', stringOrNA(project.invoice))}
+                  {renderField('Paid To', stringOrNA(project.paidTo))}
+                  {renderField('Project Date', dateOrDash(project.projectDateDisplay))}
+                  {renderField('Payment On', dateOrDash(project.onDateDisplay))}
+                  {renderField('Amount', numberOrDash(project.amount))}
+                  {renderField('Status', paidStatus(project.paid))}
+                </CardContent>
+              </Card>
+            </Grid>
+          ))}
+        </Grid>
+      )}
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
+  try {
+    const { projects, years } = await fetchProjectsFromDatabase()
+    return {
+      props: {
+        projects,
+        years,
+      },
+    }
+  } catch (err) {
+    console.error('[projects-database] Failed to load projects:', err)
+    return {
+      props: {
+        projects: [],
+        years: [],
+        error: err instanceof Error ? err.message : 'Error retrieving projects',
+      },
+    }
+  }
+}
+
```
