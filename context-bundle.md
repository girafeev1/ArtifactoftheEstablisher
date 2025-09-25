# PR #245 — Diff Summary

- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
- **Head (source)**: `0daac341ee0faa93de3bd13e5f999c3d79f97043`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/SidebarLayout.tsx
A	lib/projectsDatabase.ts
A	pages/dashboard/businesses/projects-database.tsx
```

## Stats

```txt
 components/SidebarLayout.tsx                     |  11 +
 lib/projectsDatabase.ts                          | 172 ++++++++++++++
 pages/dashboard/businesses/projects-database.tsx | 287 +++++++++++++++++++++++
 3 files changed, 470 insertions(+)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/SidebarLayout.tsx b/components/SidebarLayout.tsx
index 9b9a192..c97b165 100644
--- a/components/SidebarLayout.tsx
+++ b/components/SidebarLayout.tsx
@@ -62,6 +62,17 @@ export default function SidebarLayout({ children }: { children: React.ReactNode
                 </Button>
               </Link>
             </MenuItem>
+            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
+              <Link
+                href="/dashboard/businesses/projects-database"
+                passHref
+                style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
+              >
+                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
+                  Projects (Database)
+                </Button>
+              </Link>
+            </MenuItem>
             <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
               <Link href="/dashboard/businesses/coaching-sessions" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                 <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
diff --git a/lib/projectsDatabase.ts b/lib/projectsDatabase.ts
new file mode 100644
index 0000000..6d230ee
--- /dev/null
+++ b/lib/projectsDatabase.ts
@@ -0,0 +1,172 @@
+// lib/projectsDatabase.ts
+
+import {
+  collection,
+  doc,
+  getDoc,
+  getDocs,
+  getFirestore,
+  initializeFirestore,
+  QueryDocumentSnapshot,
+  Timestamp,
+} from 'firebase/firestore'
+import { app } from './firebase'
+
+const PROJECTS_DATABASE_ID = 'epl-projects'
+
+export const dbProjects = (() => {
+  try {
+    return getFirestore(app, PROJECTS_DATABASE_ID)
+  } catch {
+    return initializeFirestore(app, {}, PROJECTS_DATABASE_ID)
+  }
+})()
+
+const FALLBACK_YEARS = (process.env.NEXT_PUBLIC_PROJECT_YEARS || '')
+  .split(',')
+  .map((value) => value.trim())
+  .filter(Boolean)
+
+export interface FirestoreProjectRecord {
+  id: string
+  year: string
+  projectNumber: string
+  projectTitle: string
+  clientCompany: string
+  projectNature: string
+  presenterWorkType: string
+  subsidiary: string
+  amount: number | null
+  invoice: string
+  paid: boolean | null
+  paidTo: string
+  projectDate: Date | null
+  onDate: Date | null
+  invoiceCompany?: string
+}
+
+function parseTimestamp(value: unknown): Date | null {
+  if (!value) return null
+  if (value instanceof Timestamp) {
+    return value.toDate()
+  }
+  if (value instanceof Date) {
+    return value
+  }
+  if (
+    typeof value === 'object' &&
+    value !== null &&
+    'seconds' in value &&
+    'nanoseconds' in value
+  ) {
+    const seconds = (value as { seconds: number; nanoseconds: number }).seconds
+    const nanoseconds = (value as { seconds: number; nanoseconds: number }).nanoseconds
+    return Timestamp.fromMillis(seconds * 1000 + Math.floor(nanoseconds / 1_000_000)).toDate()
+  }
+  if (typeof value === 'string') {
+    const parsed = new Date(value)
+    if (!Number.isNaN(parsed.getTime())) {
+      return parsed
+    }
+  }
+  return null
+}
+
+function parseBoolean(value: unknown): boolean | null {
+  if (typeof value === 'boolean') return value
+  if (typeof value === 'string') {
+    if (value.toLowerCase() === 'true') return true
+    if (value.toLowerCase() === 'false') return false
+  }
+  return null
+}
+
+function parseAmount(value: unknown): number | null {
+  if (typeof value === 'number') return value
+  if (typeof value === 'string') {
+    const numeric = Number(value.replace(/[^\d.-]+/g, ''))
+    return Number.isFinite(numeric) ? numeric : null
+  }
+  return null
+}
+
+function parseProjectDocument(
+  year: string,
+  snapshot: QueryDocumentSnapshot,
+): FirestoreProjectRecord {
+  const data = snapshot.data() as Record<string, unknown>
+
+  return {
+    id: snapshot.id,
+    year,
+    projectNumber: typeof data.projectNumber === 'string' ? data.projectNumber : snapshot.id,
+    projectTitle: typeof data.projectTitle === 'string' ? data.projectTitle : '',
+    clientCompany: typeof data.clientCompany === 'string' ? data.clientCompany : '',
+    projectNature: typeof data.projectNature === 'string' ? data.projectNature : '',
+    presenterWorkType:
+      typeof data.presenterWorkType === 'string' ? data.presenterWorkType : '',
+    subsidiary: typeof data.subsidiary === 'string' ? data.subsidiary : '',
+    amount: parseAmount(data.amount),
+    invoice: typeof data.invoice === 'string' ? data.invoice : '',
+    paid: parseBoolean(data.paid),
+    paidTo: typeof data.paidTo === 'string' ? data.paidTo : '',
+    projectDate: parseTimestamp(data.projectDate),
+    onDate: parseTimestamp(data.onDate),
+    invoiceCompany:
+      typeof data.invoiceCompany === 'string' ? data.invoiceCompany : undefined,
+  }
+}
+
+async function loadYearCollection(year: string) {
+  const directSnapshot = await getDocs(collection(dbProjects, year))
+  if (!directSnapshot.empty) {
+    return directSnapshot
+  }
+  return getDocs(collection(dbProjects, 'data', year))
+}
+
+async function loadYearsFromMetadata(): Promise<string[]> {
+  try {
+    const metaDoc = await getDoc(doc(dbProjects, '__meta__', 'years'))
+    if (!metaDoc.exists()) return []
+    const data = metaDoc.data() as Record<string, unknown>
+    const candidates = Array.isArray(data.list)
+      ? data.list
+      : Array.isArray(data.years)
+        ? data.years
+        : Array.isArray(data.values)
+          ? data.values
+          : []
+    return candidates
+      .map((value) => String(value).trim())
+      .filter(Boolean)
+  } catch (error) {
+    if (process.env.NODE_ENV !== 'production') {
+      console.warn('Unable to load project years metadata:', error)
+    }
+    return []
+  }
+}
+
+export async function fetchProjectYears(): Promise<string[]> {
+  const fromMetadata = await loadYearsFromMetadata()
+  const combined = new Set<string>([...fromMetadata, ...FALLBACK_YEARS])
+
+  if (combined.size === 0) {
+    combined.add('2025')
+  }
+
+  return Array.from(combined).sort((a, b) =>
+    b.localeCompare(a, undefined, { numeric: true }),
+  )
+}
+
+export async function fetchProjectsForYear(
+  year: string,
+): Promise<FirestoreProjectRecord[]> {
+  const snapshot = await loadYearCollection(year)
+  return snapshot.docs
+    .map((docSnapshot) => parseProjectDocument(year, docSnapshot))
+    .sort((a, b) => a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true }))
+}
+
diff --git a/pages/dashboard/businesses/projects-database.tsx b/pages/dashboard/businesses/projects-database.tsx
new file mode 100644
index 0000000..bcf4c81
--- /dev/null
+++ b/pages/dashboard/businesses/projects-database.tsx
@@ -0,0 +1,287 @@
+// pages/dashboard/businesses/projects-database.tsx
+
+import { useEffect, useMemo, useState } from 'react'
+import SidebarLayout from '../../../components/SidebarLayout'
+import {
+  Box,
+  Button,
+  CircularProgress,
+  FormControl,
+  InputLabel,
+  MenuItem,
+  Paper,
+  Select,
+  SelectChangeEvent,
+  Table,
+  TableBody,
+  TableCell,
+  TableContainer,
+  TableHead,
+  TableRow,
+  Typography,
+  Alert,
+} from '@mui/material'
+import {
+  fetchProjectYears,
+  fetchProjectsForYear,
+  FirestoreProjectRecord,
+} from '../../../lib/projectsDatabase'
+import { useRouter } from 'next/router'
+
+interface YearLoadResult {
+  year: string
+  projects: FirestoreProjectRecord[]
+  error?: string
+}
+
+function formatCurrency(value: number | null): string {
+  if (value === null || Number.isNaN(value)) return '-'
+  return new Intl.NumberFormat('en-US', {
+    style: 'currency',
+    currency: 'HKD',
+    maximumFractionDigits: 2,
+    minimumFractionDigits: 2,
+  }).format(value)
+}
+
+function formatText(value: string | undefined | null): string {
+  if (value === null || value === undefined || value === '') {
+    return 'N/A'
+  }
+  return value
+}
+
+function formatBoolean(value: boolean | null): string {
+  if (value === null) {
+    return 'N/A'
+  }
+  return value ? 'Yes' : 'No'
+}
+
+function formatDate(value: Date | null): string {
+  if (!value) return '-'
+  if (Number.isNaN(value.getTime())) return '-'
+  return value.toLocaleDateString('en-US', {
+    month: 'short',
+    day: '2-digit',
+    year: 'numeric',
+  })
+}
+
+export default function ProjectsDatabasePage() {
+  const router = useRouter()
+  const [isLoading, setIsLoading] = useState(true)
+  const [generalError, setGeneralError] = useState<string | null>(null)
+  const [years, setYears] = useState<string[]>([])
+  const [selectedYear, setSelectedYear] = useState('')
+  const [projectsByYear, setProjectsByYear] = useState<Record<string, FirestoreProjectRecord[]>>({})
+  const [yearErrors, setYearErrors] = useState<Record<string, string>>({})
+
+  useEffect(() => {
+    let cancelled = false
+
+    const load = async () => {
+      setIsLoading(true)
+      setGeneralError(null)
+      try {
+        const availableYears = await fetchProjectYears()
+        if (cancelled) return
+
+        setYears(availableYears)
+        setSelectedYear((current) =>
+          current && availableYears.includes(current) ? current : availableYears[0] || '',
+        )
+
+        if (availableYears.length === 0) {
+          setProjectsByYear({})
+          setYearErrors({})
+          return
+        }
+
+        const results = await Promise.all(
+          availableYears.map(async (year) => {
+            try {
+              const projects = await fetchProjectsForYear(year)
+              return { year, projects } satisfies YearLoadResult
+            } catch (error) {
+              const message =
+                error instanceof Error ? error.message : 'Unable to load project data.'
+              return { year, projects: [], error: message } satisfies YearLoadResult
+            }
+          }),
+        )
+
+        if (cancelled) return
+
+        const nextProjects: Record<string, FirestoreProjectRecord[]> = {}
+        const nextErrors: Record<string, string> = {}
+
+        results.forEach(({ year, projects, error }) => {
+          nextProjects[year] = projects
+          if (error) {
+            nextErrors[year] = error
+          }
+        })
+
+        setProjectsByYear(nextProjects)
+        setYearErrors(nextErrors)
+      } catch (error) {
+        if (!cancelled) {
+          const message =
+            error instanceof Error ? error.message : 'Failed to load project data.'
+          setGeneralError(message)
+        }
+      } finally {
+        if (!cancelled) {
+          setIsLoading(false)
+        }
+      }
+    }
+
+    load()
+
+    return () => {
+      cancelled = true
+    }
+  }, [])
+
+  const selectedProjects = useMemo(() => {
+    if (!selectedYear) return []
+    return projectsByYear[selectedYear] || []
+  }, [projectsByYear, selectedYear])
+
+  const selectedYearError = selectedYear ? yearErrors[selectedYear] : undefined
+
+  const handleYearChange = (event: SelectChangeEvent<string>) => {
+    const value = event.target.value
+    setSelectedYear(value)
+  }
+
+  return (
+    <SidebarLayout>
+      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
+        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
+          <Typography variant="h4" sx={{ fontFamily: 'Cantata One' }}>
+            Projects (Database)
+          </Typography>
+          <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
+            New Project
+          </Button>
+        </Box>
+
+        {generalError && (
+          <Alert severity="error" sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+            {generalError}
+          </Alert>
+        )}
+
+        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
+          <FormControl sx={{ minWidth: 160 }}>
+            <InputLabel id="projects-database-year-label" sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}>
+              Year
+            </InputLabel>
+            <Select
+              labelId="projects-database-year-label"
+              value={selectedYear}
+              label="Year"
+              onChange={handleYearChange}
+              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
+            >
+              {years.map((year) => (
+                <MenuItem key={year} value={year} sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                  {year}
+                </MenuItem>
+              ))}
+            </Select>
+          </FormControl>
+        </Box>
+
+        {isLoading ? (
+          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
+            <CircularProgress />
+          </Box>
+        ) : (
+          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
+            <Table>
+              <TableHead>
+                <TableRow>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Project #</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Title</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Client</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Nature</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Presenter Work Type</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Subsidiary</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Amount</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Invoice #</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Invoice Company</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Paid</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Paid To</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Project Date</TableCell>
+                  <TableCell sx={{ fontFamily: 'Cantata One' }}>On Date</TableCell>
+                </TableRow>
+              </TableHead>
+              <TableBody>
+                {selectedProjects.length === 0 ? (
+                  <TableRow>
+                    <TableCell
+                      colSpan={13}
+                      align="center"
+                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
+                    >
+                      {selectedYearError ? `Error: ${selectedYearError}` : 'No projects found for this year.'}
+                    </TableCell>
+                  </TableRow>
+                ) : (
+                  selectedProjects.map((project) => (
+                    <TableRow key={`${project.year}-${project.id}`} hover>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.projectNumber)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.projectTitle)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.clientCompany)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.projectNature)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.presenterWorkType)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.subsidiary)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatCurrency(project.amount)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.invoice)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.invoiceCompany ?? null)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatBoolean(project.paid)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatText(project.paidTo)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatDate(project.projectDate)}
+                      </TableCell>
+                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
+                        {formatDate(project.onDate)}
+                      </TableCell>
+                    </TableRow>
+                  ))
+                )}
+              </TableBody>
+            </Table>
+          </TableContainer>
+        )}
+      </Box>
+    </SidebarLayout>
+  )
+}
+
```
