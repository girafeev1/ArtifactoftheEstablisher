# PR #253 — Diff Summary

- **Base (target)**: `7b9894aa8b8fb7fe78d46cf4b6d0cf752f0ad3da`
- **Head (source)**: `17d6e1ba35fce1fbf18b7ed80e8e6383b0e8b287`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
M	components/projectdialog/ProjectDatabaseCreateDialog.tsx
M	components/projectdialog/ProjectDatabaseDetailContent.tsx
M	components/projectdialog/projectFormUtils.ts
M	context-bundle.md
A	docs/context/PR-253.md
M	pages/dashboard/businesses/projects-database/[groupId].tsx
M	pages/dashboard/businesses/projects-database/new-window.tsx
```

## Stats

```txt
 .../projectdialog/ProjectDatabaseCreateDialog.tsx  |  158 +-
 .../projectdialog/ProjectDatabaseDetailContent.tsx |   69 +-
 components/projectdialog/projectFormUtils.ts       |   79 +
 context-bundle.md                                  | 3952 ++++++++++---------
 docs/context/PR-253.md                             | 4035 ++++++++++++++++++++
 .../businesses/projects-database/[groupId].tsx     |    5 +
 .../businesses/projects-database/new-window.tsx    |   38 +-
 7 files changed, 6272 insertions(+), 2064 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/components/projectdialog/ProjectDatabaseCreateDialog.tsx b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
index 8152e21..ec3a41f 100644
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
 
@@ -357,6 +426,7 @@ export default function ProjectDatabaseCreateDialog({
         variant="dialog"
         resetToken={open}
         onBusyChange={setBusy}
+        existingProjectNumbers={existingProjectNumbers}
       />
     </ProjectDatabaseWindow>
   )
diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
index e136869..5b32d98 100644
--- a/components/projectdialog/ProjectDatabaseDetailContent.tsx
+++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
@@ -18,6 +18,31 @@ import type { ReactNode } from 'react'
 
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
 
@@ -88,15 +113,12 @@ export default function ProjectDatabaseDetailContent({
     ] satisfies Array<{ label: string; value: ReactNode }>
   }, [project])
 
-  const rawPresenter = textOrNA(project.presenterWorkType)
-  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
-  const hasCjkCharacters = (value: string | null | undefined) =>
-    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
-
-  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
-  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
+  const presenterBase = textOrNA(project.presenterWorkType)
+  const presenterText = presenterBase === 'N/A' ? presenterBase : `${presenterBase} -`
+  const presenterSegments = splitByCjkSegments(presenterText)
 
-  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
+  const projectTitleText = textOrNA(project.projectTitle)
+  const titleSegments = splitByCjkSegments(projectTitleText)
 
   return (
     <Stack spacing={1.2}>
@@ -121,19 +143,32 @@ export default function ProjectDatabaseDetailContent({
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
index 3adfa99..e568e82 100644
--- a/context-bundle.md
+++ b/context-bundle.md
@@ -1,1221 +1,512 @@
-# PR #252 — Diff Summary
+# PR #253 — Diff Summary
 
-- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
-- **Head (source)**: `2a053e23f15309c445dcb84277e01827d6ad2eb4`
+- **Base (target)**: `7b9894aa8b8fb7fe78d46cf4b6d0cf752f0ad3da`
+- **Head (source)**: `698ba00af717d5683dc4d402a53bd4ccf609cf0b`
 - **Repo**: `girafeev1/ArtifactoftheEstablisher`
 
 ## Changed Files
 
 ```txt
-M	.github/workflows/context-bundle-pr.yml
-M	.github/workflows/deploy-to-vercel-prod.yml
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
-M	context-bundle.md
-M	cypress/e2e/add_payment_cascade.cy.tsx
-A	docs/context/PR-251.md
-A	docs/context/PR-252.md
-M	jest.config.cjs
-M	lib/erlDirectory.test.ts
-M	lib/projectsDatabase.ts
-A	lib/projectsDatabaseSelection.ts
-M	pages/_app.tsx
-A	pages/api/projects-database/[year]/[projectId].ts
+M	components/projectdialog/ProjectDatabaseCreateDialog.tsx
+M	components/projectdialog/ProjectDatabaseDetailContent.tsx
+M	components/projectdialog/projectFormUtils.ts
+M	docs/context/PR-252.md
+M	docs/context/index.md
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
+ .../projectdialog/ProjectDatabaseCreateDialog.tsx  |  158 +-
+ .../projectdialog/ProjectDatabaseDetailContent.tsx |   69 +-
+ components/projectdialog/projectFormUtils.ts       |   79 +
+ docs/context/PR-252.md                             | 4076 +++++++++++++++++++-
+ docs/context/index.md                              |    1 -
+ .../businesses/projects-database/[groupId].tsx     |    5 +
+ .../businesses/projects-database/new-window.tsx    |   38 +-
+ 7 files changed, 4356 insertions(+), 70 deletions(-)
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
+diff --git a/components/projectdialog/ProjectDatabaseCreateDialog.tsx b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
+index 8152e21..ec3a41f 100644
+--- a/components/projectdialog/ProjectDatabaseCreateDialog.tsx
++++ b/components/projectdialog/ProjectDatabaseCreateDialog.tsx
+@@ -19,7 +19,11 @@ import OpenInNewIcon from '@mui/icons-material/OpenInNew'
  
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
-diff --git a/.github/workflows/deploy-to-vercel-prod.yml b/.github/workflows/deploy-to-vercel-prod.yml
-index 542388b..abbe8c4 100644
---- a/.github/workflows/deploy-to-vercel-prod.yml
-+++ b/.github/workflows/deploy-to-vercel-prod.yml
-@@ -1,36 +1,22 @@
--name: Deploy Codex PR to Vercel Production
-+name: Deploy to Vercel Production
- 
- on:
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
- 
- permissions:
-   contents: read
-   deployments: write
- 
- concurrency:
--  group: vercel-prod-${{ github.ref }}
-+  group: vercel-prod-${{ github.event.pull_request.number }}
-   cancel-in-progress: true
- 
- jobs:
-   deploy:
--      if: |
--      !contains(github.event.head_commit.message, 'chore(context)') &&
--      !contains(github.event.head_commit.message, 'archive PR')
--    runs-on: ubuntu-latest
--    steps:
-+    if: >-
-+      github.event.pull_request.head.repo.full_name == github.repository &&
-+      github.event.pull_request.draft == false
-     runs-on: ubuntu-latest
-     steps:
-       - uses: actions/checkout@v4
-@@ -39,27 +25,24 @@ jobs:
-         with:
-           node-version: 20
- 
--      - name: Install deps
-+      - name: Install dependencies
-         run: npm ci
+ import ProjectDatabaseWindow from './ProjectDatabaseWindow'
+ import type { ProjectRecord } from '../../lib/projectsDatabase'
+-import { sanitizeText, toIsoUtcStringOrNull } from './projectFormUtils'
++import {
++  generateSequentialProjectNumber,
++  sanitizeText,
++  toIsoUtcStringOrNull,
++} from './projectFormUtils'
  
-       - name: Install Vercel CLI
-         run: npm i -g vercel@latest
+ interface ProjectDatabaseCreateDialogProps {
+   open: boolean
+@@ -27,6 +31,7 @@ interface ProjectDatabaseCreateDialogProps {
+   onClose: () => void
+   onCreated: (created?: ProjectRecord) => void
+   onDetach?: () => void
++  existingProjectNumbers: readonly string[]
+ }
  
--      # Pull environment (Production)
--      - name: Link Vercel project (prod)
-+      - name: Pull production environment
-         run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
-         env:
-           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
+ interface ProjectDatabaseCreateFormProps {
+@@ -37,6 +42,7 @@ interface ProjectDatabaseCreateFormProps {
+   variant: 'dialog' | 'page'
+   resetToken?: unknown
+   onBusyChange?: (busy: boolean) => void
++  existingProjectNumbers: readonly string[]
+ }
  
--      # Build locally using Vercel build (produces .vercel/output)
-       - name: Build
-         run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
-         env:
-           VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
-           VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
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
+   useEffect(() => {
+     onBusyChange?.(saving)
+@@ -99,10 +129,31 @@ export function ProjectDatabaseCreateForm({
+       setForm((prev) => ({ ...prev, [field]: event.target.value }))
+     }
  
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
++  const updateProjectNumber = (value: string) => {
++    setForm((prev) => ({ ...prev, projectNumber: value }))
 +  }
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
- 
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
 +
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
+   const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
+     setForm((prev) => ({ ...prev, paid: checked }))
+   }
  
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
-new file mode 100644
-index 0000000..e136869
---- /dev/null
-+++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
-@@ -0,0 +1,178 @@
-+import { useMemo } from 'react'
-+
-+import {
-+  Box,
-+  Chip,
-+  Divider,
-+  IconButton,
-+  Link,
-+  Stack,
-+  Typography,
-+} from '@mui/material'
-+import CloseIcon from '@mui/icons-material/Close'
-+import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
-+import { Cormorant_Infant } from 'next/font/google'
-+
-+import type { ProjectRecord } from '../../lib/projectsDatabase'
-+import type { ReactNode } from 'react'
-+
-+const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
-+
-+const textOrNA = (value: string | null | undefined) =>
-+  value && value.trim().length > 0 ? value : 'N/A'
-+
-+const formatAmount = (value: number | null | undefined) => {
-+  if (typeof value !== 'number' || Number.isNaN(value)) {
-+    return 'HK$0'
++  const commitProjectNumber = () => {
++    const trimmed = form.projectNumber.trim()
++    updateProjectNumber(trimmed.length > 0 ? trimmed : defaultProjectNumber)
++    setEditingProjectNumber(false)
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
 +
-+interface ProjectDatabaseDetailContentProps {
-+  project: ProjectRecord
-+  headerActions?: ReactNode
-+  onClose?: () => void
-+  onEdit?: () => void
-+}
-+
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
-+
-+  const rawPresenter = textOrNA(project.presenterWorkType)
-+  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
-+  const hasCjkCharacters = (value: string | null | undefined) =>
-+    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
-+
-+  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
-+  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
-+
-+  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
-+
-+  return (
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
-+  )
-+}
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
-+
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
-+
-+  useEffect(() => {
-+    setMounted(true)
-+  }, [])
-+
-+  useEffect(() => {
-+    if (open) {
-+      const previous = document.body.style.overflow
-+      document.body.style.overflow = 'hidden'
-+      setNeedsMeasurement(true)
-+      return () => {
-+        document.body.style.overflow = previous
-+      }
-+    }
-+    return undefined
-+  }, [open])
-+
-+  useLayoutEffect(() => {
-+    if (!open || !needsMeasurement || !contentRef.current || isSmallScreen) {
-+      return
++  const handleProjectNumberKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
++    if (event.key === 'Enter') {
++      event.preventDefault()
++      commitProjectNumber()
++    } else if (event.key === 'Escape') {
++      event.preventDefault()
++      updateProjectNumber(defaultProjectNumber)
++      setEditingProjectNumber(false)
 +    }
-+
-+    const node = contentRef.current
-+    const viewportWidth = window.innerWidth || 1024
-+    const viewportHeight = window.innerHeight || 768
-+    const horizontalPadding = 64
-+    const verticalPadding = 96
-+
-+    const measuredWidth = node.scrollWidth + horizontalPadding
-+    const measuredHeight = node.scrollHeight + verticalPadding
-+
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
-+
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
-+  }
-+
-+  const handleDragStop: RndDragCallback = (_event, data) => {
-+    setPosition({ x: data.x, y: data.y })
-+  }
-+
-+  const portalTarget = useMemo(() => (mounted ? document.body : null), [mounted])
-+
-+  if (!project || !open || !portalTarget) {
-+    return null
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
-+  }
-+
-+  return createPortal(
-+    <Fade in={open} appear unmountOnExit>
-+      <Box
-+        sx={{
-+          position: 'fixed',
-+          inset: 0,
-+          zIndex: 1300,
-+        }}
-+      >
-+        <Backdrop
-+          open
-+          onClick={onClose}
-+          sx={{ position: 'absolute', inset: 0 }}
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
+@@ -357,6 +426,7 @@ export default function ProjectDatabaseCreateDialog({
+         variant="dialog"
+         resetToken={open}
+         onBusyChange={setBusy}
++        existingProjectNumbers={existingProjectNumbers}
+       />
+     </ProjectDatabaseWindow>
+   )
+diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
+index e136869..5b32d98 100644
+--- a/components/projectdialog/ProjectDatabaseDetailContent.tsx
++++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
+@@ -18,6 +18,31 @@ import type { ReactNode } from 'react'
+ 
+ const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
+ 
++interface TextSegment {
++  text: string
++  isCjk: boolean
 +}
-diff --git a/components/projectdialog/ProjectDatabaseEditDialog.tsx b/components/projectdialog/ProjectDatabaseEditDialog.tsx
-new file mode 100644
-index 0000000..8a75d5c
---- /dev/null
-+++ b/components/projectdialog/ProjectDatabaseEditDialog.tsx
-@@ -0,0 +1,297 @@
-+import { useEffect, useMemo, useState } from 'react'
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
+@@ -88,15 +113,12 @@ export default function ProjectDatabaseDetailContent({
+     ] satisfies Array<{ label: string; value: ReactNode }>
+   }, [project])
+ 
+-  const rawPresenter = textOrNA(project.presenterWorkType)
+-  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
+-  const hasCjkCharacters = (value: string | null | undefined) =>
+-    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
+-
+-  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
+-  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
++  const presenterBase = textOrNA(project.presenterWorkType)
++  const presenterText = presenterBase === 'N/A' ? presenterBase : `${presenterBase} -`
++  const presenterSegments = splitByCjkSegments(presenterText)
+ 
+-  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
++  const projectTitleText = textOrNA(project.projectTitle)
++  const titleSegments = splitByCjkSegments(projectTitleText)
+ 
+   return (
+     <Stack spacing={1.2}>
+@@ -121,19 +143,32 @@ export default function ProjectDatabaseDetailContent({
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
-+const toIsoUtcStringOrNull = (value: string) => {
-+  if (!value) return null
-+  const isoLocalMidnight = `${value}T00:00:00+08:00`
-+  const date = new Date(isoLocalMidnight)
-+  return Number.isNaN(date.getTime()) ? null : date.toISOString()
++interface SequenceCandidate {
++  original: string
++  prefix: string
++  value: number
++  width: number
++  matchesYear: boolean
 +}
 +
-+const sanitizeText = (value: string) => {
-+  const trimmed = value.trim()
-+  return trimmed.length === 0 ? null : trimmed
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
 +}
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
-+
-+  useEffect(() => {
-+    if (!project) {
-+      setForm(null)
-+      return
-+    }
++export const generateSequentialProjectNumber = (
++  year: string | null,
++  existingNumbers: readonly string[]
++): string => {
++  const trimmedYear = year?.trim() ?? ''
++  const cleaned = existingNumbers
++    .map((value) => value?.trim())
++    .filter((value): value is string => Boolean(value))
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
++  const parsed = cleaned
++    .map((value) => {
++      const sequence = extractSequence(value)
++      if (!sequence) {
++        return null
++      }
++      return {
++        ...sequence,
++        matchesYear:
++          trimmedYear.length > 0 &&
++          (value.startsWith(trimmedYear) || sequence.prefix.includes(trimmedYear)),
++      } satisfies SequenceCandidate
 +    })
-+    setError(null)
-+  }, [project])
-+
-+  const disabled = useMemo(() => saving || !form || !project, [saving, form, project])
++    .filter((candidate): candidate is SequenceCandidate => Boolean(candidate))
 +
-+  const handleChange = (field: keyof FormState) =>
-+    (event: React.ChangeEvent<HTMLInputElement>) => {
-+      if (!form) return
-+      setForm({ ...form, [field]: event.target.value })
++  const chooseCandidate = (candidates: SequenceCandidate[]): SequenceCandidate | null => {
++    if (candidates.length === 0) {
++      return null
 +    }
-+
-+  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
-+    if (!form) return
-+    setForm({ ...form, paid: checked })
++    return candidates.reduce((highest, current) =>
++      current.value > highest.value ? current : highest
++    )
 +  }
 +
-+  const handleSubmit = async () => {
-+    if (!project || !form) return
-+
-+    setSaving(true)
-+    setError(null)
++  const preferred = trimmedYear.length
++    ? chooseCandidate(parsed.filter((candidate) => candidate.matchesYear))
++    : null
 +
-+    const amountValue = form.amount.trim()
-+    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
-+    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
-+      setError('Amount must be a number')
-+      setSaving(false)
-+      return
-+    }
-+
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
-+
-+    if (form.amount.trim().length === 0) {
-+      updates.amount = null
-+    } else if (parsedAmount !== null) {
-+      updates.amount = parsedAmount
-+    }
-+
-+    updates.projectDate = toIsoUtcStringOrNull(form.projectDate)
-+    updates.onDate = toIsoUtcStringOrNull(form.onDate)
++  const fallback = chooseCandidate(parsed)
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
++  const target = preferred ?? fallback
 +
-+      if (!response.ok) {
-+        const payload = await response.json().catch(() => ({}))
-+        throw new Error(payload.error || 'Failed to update project')
-+      }
-+
-+      onSaved()
-+    } catch (err) {
-+      const message = err instanceof Error ? err.message : 'Failed to update project'
-+      setError(message)
-+    } finally {
-+      setSaving(false)
-+    }
-+  }
-+
-+  if (!project || !form) {
-+    return null
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
-diff --git a/context-bundle.md b/context-bundle.md
-index 8756e36..6a287ad 100644
---- a/context-bundle.md
-+++ b/context-bundle.md
-@@ -1,810 +1,4071 @@
--# PR #249 — Diff Summary
+diff --git a/docs/context/PR-252.md b/docs/context/PR-252.md
+index b9178c3..3adfa99 100644
+--- a/docs/context/PR-252.md
++++ b/docs/context/PR-252.md
+@@ -1 +1,4075 @@
+-# Context for PR #252
 +# PR #252 — Diff Summary
- 
--- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
--- **Head (source)**: `8073fcbf79fae18bc77fc3ba6aff45ef1c2659b1`
++
 +- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
-+- **Head (source)**: `b49d9dc07d37173d09473023cd2c0992a490e501`
- - **Repo**: `girafeev1/ArtifactoftheEstablisher`
- 
- ## Changed Files
- 
- ```txt
--M	components/SidebarLayout.tsx
--M	lib/firebase.ts
--A	lib/projectsDatabase.ts
--M	pages/dashboard/businesses/index.tsx
--A	pages/dashboard/businesses/projects-database/[groupId].tsx
--A	pages/dashboard/businesses/projects-database/index.tsx
++- **Head (source)**: `2a053e23f15309c445dcb84277e01827d6ad2eb4`
++- **Repo**: `girafeev1/ArtifactoftheEstablisher`
++
++## Changed Files
++
++```txt
 +M	.github/workflows/context-bundle-pr.yml
 +M	.github/workflows/deploy-to-vercel-prod.yml
 +M	.github/workflows/pr-diff-file.yml
@@ -1237,22 +528,17 @@ index 8756e36..6a287ad 100644
 +M	lib/erlDirectory.test.ts
 +M	lib/projectsDatabase.ts
 +A	lib/projectsDatabaseSelection.ts
++M	pages/_app.tsx
 +A	pages/api/projects-database/[year]/[projectId].ts
 +M	pages/dashboard/businesses/projects-database/[groupId].tsx
 +A	pages/dashboard/businesses/projects-database/window.tsx
++A	styles/project-dialog.css
 +A	vercel.json
- ```
- 
- ## Stats
- 
- ```txt
-- components/SidebarLayout.tsx                       |   7 +
-- lib/firebase.ts                                    |  12 +-
-- lib/projectsDatabase.ts                            | 220 ++++++++++++
-- pages/dashboard/businesses/index.tsx               |  43 +--
-- .../businesses/projects-database/[groupId].tsx     | 400 +++++++++++++++++++++
-- .../businesses/projects-database/index.tsx         |  14 +
-- 6 files changed, 666 insertions(+), 30 deletions(-)
++```
++
++## Stats
++
++```txt
 + .github/workflows/context-bundle-pr.yml            |   36 +-
 + .github/workflows/deploy-to-vercel-prod.yml        |   35 +-
 + .github/workflows/pr-diff-file.yml                 |   51 -
@@ -1263,52 +549,29 @@ index 8756e36..6a287ad 100644
 + .../businesses/coaching-sessions.test.tsx          |   35 +-
 + components/StudentDialog/PaymentHistory.test.tsx   |    8 +-
 + components/StudentDialog/PaymentModal.test.tsx     |   21 +-
-+ .../projectdialog/ProjectDatabaseDetailContent.tsx |  170 +
-+ .../projectdialog/ProjectDatabaseDetailDialog.tsx  |   44 +
-+ .../projectdialog/ProjectDatabaseEditDialog.tsx    |  295 ++
++ .../projectdialog/ProjectDatabaseDetailContent.tsx |  178 +
++ .../projectdialog/ProjectDatabaseDetailDialog.tsx  |  201 +
++ .../projectdialog/ProjectDatabaseEditDialog.tsx    |  297 ++
 + context-bundle.md                                  | 4707 +++++++++++++++++---
 + cypress/e2e/add_payment_cascade.cy.tsx             |  104 +-
 + docs/context/PR-251.md                             | 4067 +++++++++++++++++
-+ docs/context/PR-252.md                             | 4071 +++++++++++++++++
++ docs/context/PR-252.md                             |    1 +
 + jest.config.cjs                                    |    2 +
 + lib/erlDirectory.test.ts                           |    4 +-
-+ lib/projectsDatabase.ts                            |  109 +-
++ lib/projectsDatabase.ts                            |  147 +-
 + lib/projectsDatabaseSelection.ts                   |   30 +
++ pages/_app.tsx                                     |   34 +-
 + pages/api/projects-database/[year]/[projectId].ts  |   63 +
 + .../businesses/projects-database/[groupId].tsx     |  111 +-
-+ .../businesses/projects-database/window.tsx        |  107 +
++ .../businesses/projects-database/window.tsx        |  177 +
++ styles/project-dialog.css                          |   20 +
 + vercel.json                                        |    6 +
-+ 25 files changed, 13155 insertions(+), 1007 deletions(-)
- ```
- 
- ## Unified Diff (truncated to first 4000 lines)
- 
- ```diff
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
++ 27 files changed, 9401 insertions(+), 1020 deletions(-)
++```
++
++## Unified Diff (truncated to first 4000 lines)
++
++```diff
 +diff --git a/.github/workflows/context-bundle-pr.yml b/.github/workflows/context-bundle-pr.yml
 +index eae6a8a..73f53ce 100644
 +--- a/.github/workflows/context-bundle-pr.yml
@@ -1316,14 +579,7 @@ index 8756e36..6a287ad 100644
 +@@ -53,31 +53,11 @@ jobs:
 +           git commit -m "chore(context): update PR #${{ github.event.number }}"
 +           git push origin HEAD:${{ github.head_ref }}
-  
---const databaseId = 'mel-sessions'
---console.log('📚 Firestore database ID:', databaseId)
--+const DEFAULT_DATABASE_ID = 'mel-sessions'
--+const PROJECTS_DATABASE_ID = 'epl-projects'
--+
--+console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
--+console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
++ 
 +-      # 🔗 Upsert a single comment with evergreen & snapshot links
 +-      - name: Comment links on PR
 +-        if: always()
@@ -1367,65 +623,7 @@ index 8756e36..6a287ad 100644
 +@@ -1,36 +1,22 @@
 +-name: Deploy Codex PR to Vercel Production
 ++name: Deploy to Vercel Production
-  
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
++ 
 + on:
 +-  push:
 +-    branches:
@@ -1690,41 +888,21 @@ index 8756e36..6a287ad 100644
 ++jest.mock('../../../../components/StudentDialog/OverviewTab', () => {
 ++  function OverviewTabMock() {
 ++    return null
- +  }
--+  if (
--+    value &&
--+    typeof value === 'object' &&
--+    'seconds' in value &&
--+    'nanoseconds' in value &&
--+    typeof (value as any).seconds === 'number' &&
--+    typeof (value as any).nanoseconds === 'number'
--+  ) {
--+    return new Timestamp((value as any).seconds, (value as any).nanoseconds)
+++  }
 ++  OverviewTabMock.displayName = 'OverviewTabMock'
 ++  return OverviewTabMock
 ++})
 ++jest.mock('../../../../components/StudentDialog/SessionDetail', () => {
 ++  function SessionDetailMock() {
 ++    return null
- +  }
--+  return null
--+}
--+
--+const toDate = (value: unknown): Date | null => {
--+  const ts = toTimestamp(value)
--+  if (ts) {
--+    const date = ts.toDate()
--+    return isNaN(date.getTime()) ? null : date
+++  }
 ++  SessionDetailMock.displayName = 'SessionDetailMock'
 ++  return SessionDetailMock
 ++})
 ++jest.mock('../../../../components/StudentDialog/FloatingWindow', () => {
 ++  function FloatingWindowMock({ children }: any) {
 ++    return <div>{children}</div>
- +  }
--+  if (typeof value === 'string' || value instanceof String) {
--+    const parsed = new Date(value as string)
--+    return isNaN(parsed.getTime()) ? null : parsed
+++  }
 ++  FloatingWindowMock.displayName = 'FloatingWindowMock'
 ++  return FloatingWindowMock
 ++})
@@ -1735,9 +913,7 @@ index 8756e36..6a287ad 100644
 ++jest.mock('../../../../components/LoadingDash', () => {
 ++  function LoadingDashMock() {
 ++    return null
- +  }
--+  if (value instanceof Date) {
--+    return isNaN(value.getTime()) ? null : value
+++  }
 ++  LoadingDashMock.displayName = 'LoadingDashMock'
 ++  return LoadingDashMock
 ++})
@@ -1761,9 +937,7 @@ index 8756e36..6a287ad 100644
 ++jest.mock('./PaymentModal', () => {
 ++  function PaymentModalMock() {
 ++    return <div />
- +  }
--+  return null
--+}
+++  }
 ++  PaymentModalMock.displayName = 'PaymentModalMock'
 ++  return PaymentModalMock
 ++})
@@ -1827,21 +1001,12 @@ index 8756e36..6a287ad 100644
 +     expect(data.accountDocId).toBeUndefined()
 +diff --git a/components/projectdialog/ProjectDatabaseDetailContent.tsx b/components/projectdialog/ProjectDatabaseDetailContent.tsx
 +new file mode 100644
-+index 0000000..a9a4bce
++index 0000000..e136869
 +--- /dev/null
 ++++ b/components/projectdialog/ProjectDatabaseDetailContent.tsx
-+@@ -0,0 +1,170 @@
++@@ -0,0 +1,178 @@
 ++import { useMemo } from 'react'
- +
--+const formatDisplayDate = (value: unknown): string | null => {
--+  const date = toDate(value)
--+  if (!date) return null
--+  return date.toLocaleDateString('en-US', {
--+    month: 'short',
--+    day: '2-digit',
--+    year: 'numeric',
--+  })
--+}
+++
 ++import {
 ++  Box,
 ++  Chip,
@@ -1853,57 +1018,27 @@ index 8756e36..6a287ad 100644
 ++} from '@mui/material'
 ++import CloseIcon from '@mui/icons-material/Close'
 ++import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
-++import { Cormorant_Infant, Yuji_Mai } from 'next/font/google'
- +
--+const toIsoDate = (value: unknown): string | null => {
--+  const date = toDate(value)
--+  if (!date) return null
--+  return date.toISOString()
--+}
+++import { Cormorant_Infant } from 'next/font/google'
+++
 ++import type { ProjectRecord } from '../../lib/projectsDatabase'
 ++import type { ReactNode } from 'react'
- +
--+const toStringValue = (value: unknown): string | null => {
--+  if (typeof value === 'string') {
--+    return value.trim() || null
--+  }
--+  if (value instanceof String) {
--+    const trimmed = value.toString().trim()
--+    return trimmed || null
--+  }
--+  return null
--+}
-++const yujiMai = Yuji_Mai({ subsets: ['latin'], weight: '400', display: 'swap' })
+++
 ++const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600', display: 'swap' })
- +
--+const toNumberValue = (value: unknown): number | null => {
--+  if (typeof value === 'number' && !Number.isNaN(value)) {
--+    return value
--+  }
--+  if (typeof value === 'string') {
--+    const parsed = Number(value)
--+    return Number.isNaN(parsed) ? null : parsed
+++
 ++const textOrNA = (value: string | null | undefined) =>
 ++  value && value.trim().length > 0 ? value : 'N/A'
 ++
 ++const formatAmount = (value: number | null | undefined) => {
 ++  if (typeof value !== 'number' || Number.isNaN(value)) {
 ++    return 'HK$0'
- +  }
--+  return null
+++  }
 ++  return `HK$${value.toLocaleString('en-US', {
 ++    minimumFractionDigits: 0,
 ++    maximumFractionDigits: 2,
 ++  })}`
- +}
- +
--+const toBooleanValue = (value: unknown): boolean | null => {
--+  if (typeof value === 'boolean') {
--+    return value
--+  }
--+  return null
+++}
+++
 ++const labelSx = {
-++  fontFamily: "Calibri, 'Segoe UI', sans-serif",
 ++  fontWeight: 400,
 ++  fontSize: '0.9rem',
 ++  letterSpacing: '0.02em',
@@ -1919,11 +1054,8 @@ index 8756e36..6a287ad 100644
 ++  headerActions?: ReactNode
 ++  onClose?: () => void
 ++  onEdit?: () => void
- +}
- +
--+const uniqueSortedYears = (values: Iterable<string>) =>
--+  Array.from(new Set(values)).sort((a, b) =>
--+    b.localeCompare(a, undefined, { numeric: true })
+++}
+++
 ++export default function ProjectDatabaseDetailContent({
 ++  project,
 ++  headerActions,
@@ -1965,20 +1097,14 @@ index 8756e36..6a287ad 100644
 ++
 ++  const rawPresenter = textOrNA(project.presenterWorkType)
 ++  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`
-++  const hasCjkInTitle = Boolean(
-++    project.projectTitle && /[぀-ヿ㐀-䶿一-鿿]/.test(project.projectTitle)
- +  )
- +
--+const listYearCollections = async (): Promise<string[]> => {
--+  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
--+  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
--+
--+  if (!apiKey || !projectId) {
--+    console.warn('[projectsDatabase] Missing Firebase configuration, falling back to defaults')
--+    return [...FALLBACK_YEAR_IDS]
--+  }
--+
--+  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents:listCollectionIds?key=${apiKey}`
+++  const hasCjkCharacters = (value: string | null | undefined) =>
+++    Boolean(value && /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(value))
+++
+++  const hasCjkInTitle = hasCjkCharacters(project.projectTitle)
+++  const hasCjkPresenter = hasCjkCharacters(project.presenterWorkType)
+++
+++  const presenterClassName = hasCjkPresenter ? 'iansui-text' : 'federo-text'
+++
 ++  return (
 ++    <Stack spacing={1.2}>
 ++      <Stack
@@ -2002,12 +1128,16 @@ index 8756e36..6a287ad 100644
 ++              </IconButton>
 ++            )}
 ++          </Stack>
-++          <Typography variant='subtitle1' sx={{ color: 'text.primary' }}>
+++          <Typography
+++            variant='subtitle1'
+++            sx={{ color: 'text.primary' }}
+++            className={presenterClassName}
+++          >
 ++            {presenterText}
 ++          </Typography>
 ++          <Typography
 ++            variant='h4'
-++            className={hasCjkInTitle ? yujiMai.className : undefined}
+++            className={hasCjkInTitle ? 'yuji-title' : undefined}
 ++            sx={{ fontFamily: hasCjkInTitle ? undefined : 'Cantata One', lineHeight: 1.2 }}
 ++          >
 ++            {textOrNA(project.projectTitle)}
@@ -2041,7 +1171,9 @@ index 8756e36..6a287ad 100644
 ++      <Stack spacing={1.2}>
 ++        {detailItems.map(({ label, value }) => (
 ++          <Box key={label}>
-++            <Typography sx={labelSx}>{label}:</Typography>
+++            <Typography sx={labelSx} className='karla-label'>
+++              {label}:
+++            </Typography>
 ++            <Typography component='div' sx={valueSx} className={cormorantSemi.className}>
 ++              {value}
 ++            </Typography>
@@ -2053,35 +1185,20 @@ index 8756e36..6a287ad 100644
 ++}
 +diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
 +new file mode 100644
-+index 0000000..34283e5
++index 0000000..787fc34
 +--- /dev/null
 ++++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
-+@@ -0,0 +1,44 @@
-++import { Dialog, DialogContent } from '@mui/material'
- +
--+  try {
--+    const response = await fetch(url, {
--+      method: 'POST',
--+      headers: { 'Content-Type': 'application/json' },
--+      body: JSON.stringify({
--+        parent: `projects/${projectId}/databases/${PROJECTS_FIRESTORE_DATABASE_ID}/documents`,
--+        pageSize: 200,
--+      }),
--+    })
++@@ -0,0 +1,201 @@
+++import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
+++import { createPortal } from 'react-dom'
+++import { Rnd, type RndDragCallback, type RndResizeCallback } from 'react-rnd'
+++import { Backdrop, Box, Fade, useMediaQuery, useTheme } from '@mui/material'
+++
 ++import type { ReactNode } from 'react'
- +
--+    if (!response.ok) {
--+      console.warn('[projectsDatabase] Failed to list collection IDs:', response.status, response.statusText)
--+      return [...FALLBACK_YEAR_IDS]
--+    }
+++
 ++import type { ProjectRecord } from '../../lib/projectsDatabase'
 ++import ProjectDatabaseDetailContent from './ProjectDatabaseDetailContent'
- +
--+    const json = (await response.json()) as ListCollectionIdsResponse
--+    if (json.error) {
--+      console.warn('[projectsDatabase] Firestore responded with error:', json.error.message)
--+      return [...FALLBACK_YEAR_IDS]
--+    }
+++
 ++interface ProjectDatabaseDetailDialogProps {
 ++  open: boolean
 ++  onClose: () => void
@@ -2089,16 +1206,13 @@ index 8756e36..6a287ad 100644
 ++  onEdit?: () => void
 ++  headerActions?: ReactNode
 ++}
- +
--+    const ids = json.collectionIds?.filter((id) => YEAR_ID_PATTERN.test(id)) ?? []
--+    if (ids.length === 0) {
--+      console.warn('[projectsDatabase] No year collections found, falling back to defaults')
--+      return [...FALLBACK_YEAR_IDS]
--+    }
--+    return uniqueSortedYears(ids)
--+  } catch (err) {
--+    console.warn('[projectsDatabase] listYearCollections failed:', err)
--+    return [...FALLBACK_YEAR_IDS]
+++
+++const MIN_WIDTH = 400
+++const MIN_HEIGHT = 200
+++
+++const clamp = (value: number, min: number, max: number) =>
+++  Math.min(Math.max(value, min), max)
+++
 ++export default function ProjectDatabaseDetailDialog({
 ++  open,
 ++  onClose,
@@ -2106,238 +1220,207 @@ index 8756e36..6a287ad 100644
 ++  onEdit,
 ++  headerActions,
 ++}: ProjectDatabaseDetailDialogProps) {
-++  if (!project) {
+++  const theme = useTheme()
+++  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
+++  const [mounted, setMounted] = useState(false)
+++  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
+++    width: 560,
+++    height: 480,
+++  }))
+++  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
+++    x: 80,
+++    y: 80,
+++  }))
+++  const [needsMeasurement, setNeedsMeasurement] = useState(true)
+++  const contentRef = useRef<HTMLDivElement | null>(null)
+++
+++  useEffect(() => {
+++    setMounted(true)
+++  }, [])
+++
+++  useEffect(() => {
+++    if (open) {
+++      const previous = document.body.style.overflow
+++      document.body.style.overflow = 'hidden'
+++      setNeedsMeasurement(true)
+++      return () => {
+++        document.body.style.overflow = previous
+++      }
+++    }
+++    return undefined
+++  }, [open])
+++
+++  useLayoutEffect(() => {
+++    if (!open || !needsMeasurement || !contentRef.current || isSmallScreen) {
+++      return
+++    }
+++
+++    const node = contentRef.current
+++    const viewportWidth = window.innerWidth || 1024
+++    const viewportHeight = window.innerHeight || 768
+++    const horizontalPadding = 64
+++    const verticalPadding = 96
+++
+++    const measuredWidth = node.scrollWidth + horizontalPadding
+++    const measuredHeight = node.scrollHeight + verticalPadding
+++
+++    const width = clamp(
+++      measuredWidth,
+++      MIN_WIDTH,
+++      Math.max(MIN_WIDTH, viewportWidth - 48)
+++    )
+++    const height = clamp(
+++      measuredHeight,
+++      MIN_HEIGHT,
+++      Math.max(MIN_HEIGHT, viewportHeight - 48)
+++    )
+++
+++    const x = Math.max(24, Math.round((viewportWidth - width) / 2))
+++    const y = Math.max(32, Math.round((viewportHeight - height) / 2))
+++
+++    setSize({ width, height })
+++    setPosition({ x, y })
+++    setNeedsMeasurement(false)
+++  }, [open, needsMeasurement, isSmallScreen])
+++
+++  const handleResizeStop: RndResizeCallback = (
+++    _event,
+++    _direction,
+++    elementRef,
+++    _delta,
+++    nextPosition
+++  ) => {
+++    const width = elementRef.offsetWidth
+++    const height = elementRef.offsetHeight
+++    setSize({ width, height })
+++    setPosition(nextPosition)
+++  }
+++
+++  const handleDragStop: RndDragCallback = (_event, data) => {
+++    setPosition({ x: data.x, y: data.y })
+++  }
+++
+++  const portalTarget = useMemo(() => (mounted ? document.body : null), [mounted])
+++
+++  if (!project || !open || !portalTarget) {
 ++    return null
- +  }
--+}
- +
--+export const fetchProjectsFromDatabase = async (): Promise<ProjectsDatabaseResult> => {
--+  const yearIds = await listYearCollections()
--+  const projects: ProjectRecord[] = []
--+  const yearsWithData = new Set<string>()
--+
--+  await Promise.all(
--+    yearIds.map(async (year) => {
--+      const snapshot = await getDocs(collection(projectsDb, year))
--+      snapshot.forEach((doc) => {
--+        const data = doc.data() as Record<string, unknown>
--+        const projectNumber = toStringValue(data.projectNumber) ?? doc.id
--+
--+        const amount = toNumberValue(data.amount)
--+        const projectDateIso = toIsoDate(data.projectDate)
--+        const projectDateDisplay = formatDisplayDate(data.projectDate)
--+        const onDateIso = toIsoDate(data.onDate)
--+        const onDateDisplay = formatDisplayDate(data.onDate)
--+
--+        projects.push({
--+          id: doc.id,
--+          year,
--+          amount,
--+          clientCompany: toStringValue(data.clientCompany),
--+          invoice: toStringValue(data.invoice),
--+          onDateDisplay,
--+          onDateIso,
--+          paid: toBooleanValue(data.paid),
--+          paidTo: toStringValue(data.paidTo),
--+          presenterWorkType: toStringValue(data.presenterWorkType),
--+          projectDateDisplay,
--+          projectDateIso,
--+          projectNature: toStringValue(data.projectNature),
--+          projectNumber,
--+          projectTitle: toStringValue(data.projectTitle),
--+          subsidiary: toStringValue(data.subsidiary),
--+        })
--+
--+        yearsWithData.add(year)
--+      })
--+    })
-++  return (
-++    <Dialog
-++      open={open}
-++      onClose={onClose}
-++      fullWidth
-++      maxWidth="sm"
-++    >
-++      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
-++        <ProjectDatabaseDetailContent
-++          project={project}
-++          headerActions={headerActions}
-++          onClose={onClose}
-++          onEdit={onEdit}
+++  }
+++
+++  if (isSmallScreen) {
+++    return createPortal(
+++      <Fade in={open} appear unmountOnExit>
+++        <Box
+++          sx={{
+++            position: 'fixed',
+++            inset: 0,
+++            bgcolor: 'background.paper',
+++            zIndex: 1300,
+++            display: 'flex',
+++            flexDirection: 'column',
+++          }}
+++        >
+++          <Box ref={contentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
+++            <ProjectDatabaseDetailContent
+++              project={project}
+++              headerActions={headerActions}
+++              onClose={onClose}
+++              onEdit={onEdit}
+++            />
+++          </Box>
+++        </Box>
+++      </Fade>,
+++      portalTarget
+++    )
+++  }
+++
+++  return createPortal(
+++    <Fade in={open} appear unmountOnExit>
+++      <Box
+++        sx={{
+++          position: 'fixed',
+++          inset: 0,
+++          zIndex: 1300,
+++        }}
+++      >
+++        <Backdrop
+++          open
+++          onClick={onClose}
+++          sx={{ position: 'absolute', inset: 0 }}
 ++        />
-++      </DialogContent>
-++    </Dialog>
- +  )
--+
--+  projects.sort((a, b) => {
--+    if (a.year !== b.year) {
--+      return b.year.localeCompare(a.year, undefined, { numeric: true })
--+    }
--+    return a.projectNumber.localeCompare(b.projectNumber, undefined, { numeric: true })
--+  })
--+
--+  return {
--+    projects,
--+    years: uniqueSortedYears(yearsWithData),
--+  }
- +}
--+
--diff --git a/pages/dashboard/businesses/index.tsx b/pages/dashboard/businesses/index.tsx
--index 505c235..135484d 100644
----- a/pages/dashboard/businesses/index.tsx
--+++ b/pages/dashboard/businesses/index.tsx
--@@ -3,33 +3,22 @@
-- import { GetServerSideProps } from 'next';
-- import { getSession } from 'next-auth/react';
-- import SidebarLayout from '../../../components/SidebarLayout';
---import { initializeApis } from '../../../lib/googleApi';
---import { listProjectOverviewFiles } from '../../../lib/projectOverview';
-- import { useRouter } from 'next/router';
-- import { Box, Typography, List, ListItemButton, ListItemText, Button } from '@mui/material';
---import { drive_v3 } from 'googleapis';
-- 
---interface BusinessFile {
---  companyIdentifier: string;
---  fullCompanyName: string;
---  file: drive_v3.Schema$File;
--+interface BusinessLink {
--+  title: string;
--+  description: string;
--+  href: string;
-- }
-- 
-- interface BusinessesPageProps {
---  projectsByCategory: Record<string, BusinessFile[]>;
--+  businessLinks: BusinessLink[];
-- }
-- 
---export default function BusinessesPage({ projectsByCategory }: BusinessesPageProps) {
--+export default function BusinessesPage({ businessLinks }: BusinessesPageProps) {
--   const router = useRouter();
-- 
---  // Flatten the grouped projects into a single array.
---  // (The original code grouped them by subsidiary code; now we sort them alphabetically by fullCompanyName.)
---  const files: BusinessFile[] = [];
---  for (const key in projectsByCategory) {
---    projectsByCategory[key].forEach((file) => files.push(file));
---  }
---  files.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));
---
--   return (
--     <SidebarLayout>
--       <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
--@@ -43,12 +32,9 @@ export default function BusinessesPage({ projectsByCategory }: BusinessesPagePro
--         Select a project overview file:
--       </Typography>
--       <List>
---        {files.map((file) => (
---          <ListItemButton
---            key={file.file.id}
---            onClick={() => router.push(`/dashboard/businesses/${file.file.id}`)}
---          >
---            <ListItemText primary={file.fullCompanyName} secondary={file.file.name} />
--+        {businessLinks.map((link) => (
--+          <ListItemButton key={link.href} onClick={() => router.push(link.href)}>
--+            <ListItemText primary={link.title} secondary={link.description} />
--           </ListItemButton>
--         ))}
--       </List>
--@@ -61,12 +47,15 @@ export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async
--   if (!session?.accessToken) {
--     return { redirect: { destination: '/api/auth/signin', permanent: false } };
--   }
---  const { drive } = initializeApis('user', { accessToken: session.accessToken as string });
---  // Get the grouped project files using your existing sorting utility
---  const projectsByCategory = await listProjectOverviewFiles(drive, []);
--   return {
--     props: {
---      projectsByCategory,
--+      businessLinks: [
--+        {
--+          title: 'Establish Productions Limited',
--+          description: 'Projects (Database)',
--+          href: '/dashboard/businesses/projects-database/select',
--+        },
--+      ],
--     },
--   };
-- };
--diff --git a/pages/dashboard/businesses/projects-database/[groupId].tsx b/pages/dashboard/businesses/projects-database/[groupId].tsx
+++        <Rnd
+++          size={size}
+++          position={position}
+++          bounds='window'
+++          minWidth={MIN_WIDTH}
+++          minHeight={MIN_HEIGHT}
+++          onDragStop={handleDragStop}
+++          onResizeStop={handleResizeStop}
+++          enableResizing
+++        >
+++          <Box
+++            sx={{
+++              bgcolor: 'background.paper',
+++              height: '100%',
+++              display: 'flex',
+++              flexDirection: 'column',
+++              boxShadow: 6,
+++              borderRadius: 1,
+++              overflow: 'hidden',
+++            }}
+++          >
+++            <Box
+++              ref={contentRef}
+++              sx={{
+++                flexGrow: 1,
+++                overflow: 'auto',
+++                p: { xs: 2, sm: 3 },
+++              }}
+++            >
+++              <ProjectDatabaseDetailContent
+++                project={project}
+++                headerActions={headerActions}
+++                onClose={onClose}
+++                onEdit={onEdit}
+++              />
+++            </Box>
+++          </Box>
+++        </Rnd>
+++      </Box>
+++    </Fade>,
+++    portalTarget
+++  )
+++}
 +diff --git a/components/projectdialog/ProjectDatabaseEditDialog.tsx b/components/projectdialog/ProjectDatabaseEditDialog.tsx
- new file mode 100644
--index 0000000..3823567
-+index 0000000..a13c7f7
- --- /dev/null
--+++ b/pages/dashboard/businesses/projects-database/[groupId].tsx
--@@ -0,0 +1,400 @@
--+import { GetServerSideProps } from 'next'
--+import { getSession } from 'next-auth/react'
--+import { useRouter } from 'next/router'
--+import { useEffect, useState } from 'react'
--+
--+import SidebarLayout from '../../../../components/SidebarLayout'
--+import {
--+  fetchProjectsFromDatabase,
--+  ProjectRecord,
--+} from '../../../../lib/projectsDatabase'
++new file mode 100644
++index 0000000..8a75d5c
++--- /dev/null
 ++++ b/components/projectdialog/ProjectDatabaseEditDialog.tsx
-+@@ -0,0 +1,295 @@
++@@ -0,0 +1,297 @@
 ++import { useEffect, useMemo, useState } from 'react'
- +
- +import {
+++
+++import {
 ++  Alert,
- +  Box,
- +  Button,
--+  Card,
--+  CardContent,
--+  FormControl,
+++  Box,
+++  Button,
 ++  Dialog,
 ++  DialogActions,
 ++  DialogContent,
 ++  DialogTitle,
 ++  FormControlLabel,
- +  Grid,
--+  IconButton,
--+  InputLabel,
--+  List,
--+  ListItem,
--+  ListItemText,
--+  MenuItem,
--+  Select,
--+  ToggleButton,
--+  ToggleButtonGroup,
+++  Grid,
 ++  Switch,
 ++  TextField,
- +  Typography,
- +} from '@mui/material'
--+import type { SelectChangeEvent } from '@mui/material/Select'
--+import ArrowBackIcon from '@mui/icons-material/ArrowBack'
--+
--+const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
--+const headingSx = { fontFamily: 'Cantata One' }
--+
--+type SortMethod = 'year' | 'subsidiary'
-++import { Timestamp } from 'firebase/firestore'
- +
--+type Mode = 'select' | 'detail'
+++  Typography,
+++} from '@mui/material'
 ++import type { ProjectRecord } from '../../lib/projectsDatabase'
- +
--+interface DetailSelection {
--+  type: SortMethod
--+  year: string
+++
 ++interface ProjectDatabaseEditDialogProps {
 ++  open: boolean
 ++  project: ProjectRecord | null
 ++  onClose: () => void
 ++  onSaved: () => void
- +}
- +
--+interface ProjectsDatabasePageProps {
--+  mode: Mode
--+  years: string[]
--+  error?: string
--+  detailSelection?: DetailSelection
--+  projects?: ProjectRecord[]
+++}
+++
 ++interface FormState {
 ++  projectNumber: string
 ++  projectTitle: string
@@ -2351,42 +1434,26 @@ index 8756e36..6a287ad 100644
 ++  subsidiary: string
 ++  projectDate: string
 ++  onDate: string
- +}
- +
--+const encodeSelectionId = (type: SortMethod, year: string) => {
--+  const yearPart = encodeURIComponent(year)
--+  return `${type}--${yearPart}`
+++}
+++
 ++const toDateInputValue = (value: string | null) => {
 ++  if (!value) return ''
 ++  const parsed = new Date(value)
 ++  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
- +}
- +
--+const decodeSelectionId = (value: string): DetailSelection | null => {
--+  const [typePart, yearPart] = value.split('--')
--+  if (!typePart || !yearPart) {
--+    return null
--+  }
--+
--+  if (typePart !== 'year' && typePart !== 'subsidiary') {
--+    return null
--+  }
-++const toTimestampOrNull = (value: string) =>
-++  value ? Timestamp.fromDate(new Date(`${value}T00:00:00`)) : null
- +
--+  try {
--+    return { type: typePart, year: decodeURIComponent(yearPart) }
--+  } catch (err) {
--+    console.warn('[projects-database] Failed to decode selection id', err)
--+    return null
--+  }
+++}
+++
+++const toIsoUtcStringOrNull = (value: string) => {
+++  if (!value) return null
+++  const isoLocalMidnight = `${value}T00:00:00+08:00`
+++  const date = new Date(isoLocalMidnight)
+++  return Number.isNaN(date.getTime()) ? null : date.toISOString()
+++}
+++
 ++const sanitizeText = (value: string) => {
 ++  const trimmed = value.trim()
 ++  return trimmed.length === 0 ? null : trimmed
- +}
- +
--+const stringOrNA = (value: string | null | undefined) =>
--+  value && value.trim().length > 0 ? value : 'N/A'
+++}
+++
 ++export default function ProjectDatabaseEditDialog({
 ++  open,
 ++  project,
@@ -2396,22 +1463,13 @@ index 8756e36..6a287ad 100644
 ++  const [form, setForm] = useState<FormState | null>(null)
 ++  const [saving, setSaving] = useState(false)
 ++  const [error, setError] = useState<string | null>(null)
- +
--+const amountText = (value: number | null | undefined) => {
--+  if (value === null || value === undefined) {
--+    return '-'
--+  }
+++
 ++  useEffect(() => {
 ++    if (!project) {
 ++      setForm(null)
 ++      return
 ++    }
- +
--+  return `HK$${value.toLocaleString('en-US', {
--+    minimumFractionDigits: 0,
--+    maximumFractionDigits: 2,
--+  })}`
--+}
+++
 ++    setForm({
 ++      projectNumber: project.projectNumber ?? '',
 ++      projectTitle: project.projectTitle ?? '',
@@ -2431,21 +1489,9 @@ index 8756e36..6a287ad 100644
 ++    })
 ++    setError(null)
 ++  }, [project])
- +
--+const paidStatusText = (value: boolean | null | undefined) => {
--+  if (value === null || value === undefined) {
--+    return 'N/A'
--+  }
--+  return value ? 'Paid' : 'Unpaid'
--+}
+++
 ++  const disabled = useMemo(() => saving || !form || !project, [saving, form, project])
- +
--+const paidDateText = (
--+  paid: boolean | null | undefined,
--+  date: string | null | undefined
--+) => {
--+  if (!paid) {
--+    return null
+++
 ++  const handleChange = (field: keyof FormState) =>
 ++    (event: React.ChangeEvent<HTMLInputElement>) => {
 ++      if (!form) return
@@ -2455,34 +1501,14 @@ index 8756e36..6a287ad 100644
 ++  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
 ++    if (!form) return
 ++    setForm({ ...form, paid: checked })
- +  }
- +
--+  return date && date.trim().length > 0 ? date : '-'
--+}
+++  }
+++
 ++  const handleSubmit = async () => {
 ++    if (!project || !form) return
- +
--+export default function ProjectsDatabasePage({
--+  mode,
--+  years,
--+  error,
--+  detailSelection,
--+  projects = [],
--+}: ProjectsDatabasePageProps) {
--+  const router = useRouter()
--+
--+  const [sortMethod, setSortMethod] = useState<SortMethod>(
--+    detailSelection?.type ?? 'year'
--+  )
--+  const [selectedYear, setSelectedYear] = useState<string>(
--+    detailSelection?.year ?? years[0] ?? ''
--+  )
+++
 ++    setSaving(true)
 ++    setError(null)
- +
--+  const handleYearChange = (event: SelectChangeEvent<string>) => {
--+    setSelectedYear(event.target.value)
--+  }
+++
 ++    const amountValue = form.amount.trim()
 ++    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
 ++    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
@@ -2490,10 +1516,7 @@ index 8756e36..6a287ad 100644
 ++      setSaving(false)
 ++      return
 ++    }
- +
--+  useEffect(() => {
--+    if (!selectedYear && years.length > 0) {
--+      setSelectedYear(years[0])
+++
 ++    const updates: Record<string, unknown> = {
 ++      projectNumber: sanitizeText(form.projectNumber),
 ++      projectTitle: sanitizeText(form.projectTitle),
@@ -2504,25 +1527,16 @@ index 8756e36..6a287ad 100644
 ++      invoice: sanitizeText(form.invoice),
 ++      paidTo: sanitizeText(form.paidTo),
 ++      paid: form.paid,
- +    }
--+  }, [years, selectedYear])
- +
--+  useEffect(() => {
--+    if (detailSelection) {
--+      setSortMethod(detailSelection.type)
--+      setSelectedYear(detailSelection.year)
+++    }
+++
 ++    if (form.amount.trim().length === 0) {
 ++      updates.amount = null
 ++    } else if (parsedAmount !== null) {
 ++      updates.amount = parsedAmount
- +    }
--+  }, [detailSelection])
- +
--+  const handleNavigate = (type: SortMethod, year: string) => {
--+    if (!year) {
--+      return
-++    updates.projectDate = toTimestampOrNull(form.projectDate)
-++    updates.onDate = toTimestampOrNull(form.onDate)
+++    }
+++
+++    updates.projectDate = toIsoUtcStringOrNull(form.projectDate)
+++    updates.onDate = toIsoUtcStringOrNull(form.onDate)
 ++
 ++    try {
 ++      const response = await fetch(
@@ -2545,27 +1559,13 @@ index 8756e36..6a287ad 100644
 ++      setError(message)
 ++    } finally {
 ++      setSaving(false)
- +    }
+++    }
 ++  }
- +
--+    router.push(
--+      `/dashboard/businesses/projects-database/${encodeSelectionId(type, year)}`
--+    )
+++
 ++  if (!project || !form) {
 ++    return null
- +  }
- +
--+  if (mode === 'select') {
--+    return (
--+      <SidebarLayout>
--+        <Box sx={{ mb: 3 }}>
--+          <Typography variant="h4" sx={headingSx} gutterBottom>
--+            Projects (Database)
--+          </Typography>
--+          <Typography variant="h6" sx={{ ...headingSx, mt: 2 }}>
--+            Establish Productions Limited
--+          </Typography>
--+        </Box>
+++  }
+++
 ++  return (
 ++    <Dialog open={open} onClose={disabled ? undefined : onClose} fullWidth maxWidth="sm">
 ++      <DialogTitle>Edit Project</DialogTitle>
@@ -2573,93 +1573,11 @@ index 8756e36..6a287ad 100644
 ++        <Typography variant="subtitle1" sx={{ mb: 2 }}>
 ++          {project.projectNumber} — {project.projectTitle ?? 'Untitled'}
 ++        </Typography>
- +        {error && (
--+          <Typography color="error" sx={{ mb: 2 }}>
+++        {error && (
 ++          <Alert severity="error" sx={{ mb: 2 }}>
- +            {error}
--+          </Typography>
+++            {error}
 ++          </Alert>
- +        )}
--+        <Box
--+          sx={{
--+            display: 'flex',
--+            flexWrap: 'wrap',
--+            gap: 2,
--+            alignItems: 'center',
--+            mb: 3,
--+          }}
--+        >
--+          <ToggleButtonGroup
--+            value={sortMethod}
--+            exclusive
--+            onChange={(event, value: SortMethod | null) => {
--+              if (value) {
--+                setSortMethod(value)
--+              }
--+            }}
--+            size="small"
--+          >
--+            <ToggleButton value="year">By Year</ToggleButton>
--+            <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
--+          </ToggleButtonGroup>
--+          {sortMethod === 'year' && years.length > 0 && (
--+            <FormControl sx={{ minWidth: 160 }}>
--+              <InputLabel>Year</InputLabel>
--+              <Select
--+                value={selectedYear}
--+                label="Year"
--+                onChange={handleYearChange}
--+              >
--+                {years.map((year) => (
--+                  <MenuItem key={year} value={year}>
--+                    {year}
--+                  </MenuItem>
--+                ))}
--+              </Select>
--+            </FormControl>
--+          )}
--+        </Box>
--+        {sortMethod === 'year' ? (
--+          years.length === 0 ? (
--+            <Typography>No project collections available.</Typography>
--+          ) : selectedYear ? (
--+            <Grid container spacing={2}>
--+              <Grid item xs={12} sm={6} md={4}>
--+                <Card
--+                  sx={{ cursor: 'pointer', height: '100%' }}
--+                  onClick={() => handleNavigate('year', selectedYear)}
--+                >
--+                  <CardContent>
--+                    <Typography variant="h6" sx={headingSx} gutterBottom>
--+                      Establish Productions Limited
--+                    </Typography>
--+                    <Typography sx={valueSx}>{selectedYear} Projects</Typography>
--+                  </CardContent>
--+                </Card>
--+              </Grid>
--+            </Grid>
--+          ) : (
--+            <Typography>Please choose a year to continue.</Typography>
--+          )
--+        ) : years.length === 0 ? (
--+          <Typography>No project collections available.</Typography>
--+        ) : (
--+          <Grid container spacing={2}>
--+            {years.map((year) => (
--+              <Grid item xs={12} sm={6} md={4} key={year}>
--+                <Card
--+                  sx={{ cursor: 'pointer', height: '100%' }}
--+                  onClick={() => handleNavigate('subsidiary', year)}
--+                >
--+                  <CardContent>
--+                    <Typography variant="h6" sx={headingSx} gutterBottom>
--+                      {year}
--+                    </Typography>
--+                    <Typography sx={valueSx}>Project Collection</Typography>
--+                  </CardContent>
--+                </Card>
--+              </Grid>
--+            ))}
+++        )}
 ++        <Grid container spacing={2}>
 ++          <Grid item xs={12} sm={6}>
 ++            <TextField
@@ -2668,41 +1586,7 @@ index 8756e36..6a287ad 100644
 ++              onChange={handleChange('projectNumber')}
 ++              fullWidth
 ++            />
- +          </Grid>
--+        )}
--+      </SidebarLayout>
--+    )
--+  }
--+
--+  const handleBack = () => {
--+    router.push('/dashboard/businesses/projects-database/select')
--+  }
--+
--+  const headerLabel = detailSelection
--+    ? detailSelection.type === 'year'
--+      ? `Establish Productions Limited — ${detailSelection.year}`
--+      : `${detailSelection.year} Projects`
--+    : 'Projects'
--+
--+  return (
--+    <SidebarLayout>
--+      <Box
--+        sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
--+      >
--+        <IconButton onClick={handleBack}>
--+          <ArrowBackIcon />
--+        </IconButton>
--+        <Box sx={{ textAlign: 'center' }}>
--+          <Typography variant="h5" sx={headingSx}>
--+            {headerLabel}
--+          </Typography>
--+          <Typography sx={valueSx}>Project Overview</Typography>
--+        </Box>
--+        <Button
--+          variant="contained"
--+          onClick={() => router.push('/dashboard/businesses/new')}
--+        >
--+          New Project
+++          </Grid>
 ++          <Grid item xs={12} sm={6}>
 ++            <TextField
 ++              label="Client Company"
@@ -2801,152 +1685,16 @@ index 8756e36..6a287ad 100644
 ++      <DialogActions>
 ++        <Button onClick={onClose} disabled={disabled}>
 ++          Cancel
- +        </Button>
--+      </Box>
--+      {error && (
--+        <Typography color="error" sx={{ mb: 2 }}>
--+          {error}
--+        </Typography>
--+      )}
--+      <Card>
--+        <CardContent>
--+          <Typography variant="h6" sx={headingSx} gutterBottom>
--+            Project List
--+          </Typography>
--+          {projects.length === 0 ? (
--+            <Typography>No project records available.</Typography>
--+          ) : (
--+            <List>
--+              {projects.map((project) => {
--+                const primary = `${stringOrNA(project.projectNumber)} — ${stringOrNA(
--+                  project.projectTitle
--+                )}`
--+                const segments = [
--+                  amountText(project.amount),
--+                  paidStatusText(project.paid),
--+                ]
--+                const paidDate = paidDateText(project.paid, project.onDateDisplay)
--+                if (paidDate) {
--+                  segments.push(paidDate)
--+                }
--+
--+                return (
--+                  <ListItem
--+                    key={`${project.year}-${project.projectNumber}`}
--+                    alignItems="flex-start"
--+                    sx={{ cursor: 'default' }}
--+                  >
--+                    <ListItemText
--+                      primary={primary}
--+                      primaryTypographyProps={{ sx: valueSx }}
--+                      secondary={segments.join(' | ')}
--+                      secondaryTypographyProps={{ sx: valueSx }}
--+                    />
--+                  </ListItem>
--+                )
--+              })}
--+            </List>
--+          )}
--+        </CardContent>
--+      </Card>
--+    </SidebarLayout>
+++        </Button>
 ++        <Button onClick={handleSubmit} variant="contained" disabled={disabled}>
 ++          {saving ? 'Saving…' : 'Save Changes'}
 ++        </Button>
 ++      </DialogActions>
 ++    </Dialog>
- +  )
- +}
--+
--+export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
--+  ctx
--+) => {
--+  const session = await getSession(ctx)
--+  if (!session?.accessToken) {
--+    return { redirect: { destination: '/api/auth/signin', permanent: false } }
--+  }
--+
--+  const groupParam = ctx.params?.groupId as string | undefined
--+
--+  try {
--+    const { projects, years } = await fetchProjectsFromDatabase()
--+
--+    if (!groupParam || groupParam === 'select') {
--+      return {
--+        props: {
--+          mode: 'select',
--+          years,
--+        },
--+      }
--+    }
--+
--+    const selection = decodeSelectionId(groupParam)
--+    if (!selection) {
--+      return {
--+        props: {
--+          mode: 'select',
--+          years,
--+          error: 'Invalid project selection, please choose again.',
--+        },
--+      }
--+    }
--+
--+    if (!years.includes(selection.year)) {
--+      return {
--+        props: {
--+          mode: 'select',
--+          years,
--+          error: 'Project collection not found, please choose again.',
--+        },
--+      }
--+    }
--+
--+    const matchingProjects = projects.filter(
--+      (project) => project.year === selection.year
--+    )
--+
--+    return {
--+      props: {
--+        mode: 'detail',
--+        years,
--+        detailSelection: selection,
--+        projects: matchingProjects,
--+      },
--+    }
--+  } catch (err) {
--+    console.error('[projects-database] Failed to load projects:', err)
--+    return {
--+      props: {
--+        mode: 'select',
--+        years: [],
--+        error:
--+          err instanceof Error ? err.message : 'Error retrieving project records',
--+      },
--+    }
--+  }
--+}
--diff --git a/pages/dashboard/businesses/projects-database/index.tsx b/pages/dashboard/businesses/projects-database/index.tsx
--new file mode 100644
--index 0000000..51c3a8a
----- /dev/null
--+++ b/pages/dashboard/businesses/projects-database/index.tsx
--@@ -0,0 +1,14 @@
--+import { GetServerSideProps } from 'next'
--+
--+const ProjectsDatabaseIndex = () => null
--+
--+export const getServerSideProps: GetServerSideProps = async () => {
--+  return {
--+    redirect: {
--+      destination: '/dashboard/businesses/projects-database/select',
--+      permanent: false,
--+    },
--+  }
--+}
--+
--+export default ProjectsDatabaseIndex
+++  )
+++}
 +diff --git a/context-bundle.md b/context-bundle.md
-+index 8756e36..fd2c6f3 100644
++index 8756e36..6a287ad 100644
 +--- a/context-bundle.md
 ++++ b/context-bundle.md
 +@@ -1,810 +1,4071 @@
@@ -2956,7 +1704,7 @@ index 8756e36..6a287ad 100644
 +-- **Base (target)**: `f566cbf23346c32717e383ca9f46af974f479b6e`
 +-- **Head (source)**: `8073fcbf79fae18bc77fc3ba6aff45ef1c2659b1`
 ++- **Base (target)**: `69d0bc468dcdc9a62c3286d72a60fc6fb84dd4d2`
-++- **Head (source)**: `b73c9a9ef8d7bc70cfe5c8ebacaa8f5ab531cac2`
+++- **Head (source)**: `b49d9dc07d37173d09473023cd2c0992a490e501`
 + - **Repo**: `girafeev1/ArtifactoftheEstablisher`
 + 
 + ## Changed Files
@@ -3021,7 +1769,7 @@ index 8756e36..6a287ad 100644
 ++ context-bundle.md                                  | 4707 +++++++++++++++++---
 ++ cypress/e2e/add_payment_cascade.cy.tsx             |  104 +-
 ++ docs/context/PR-251.md                             | 4067 +++++++++++++++++
-++ docs/context/PR-252.md                             |    1 +
+++ docs/context/PR-252.md                             | 4071 +++++++++++++++++
 ++ jest.config.cjs                                    |    2 +
 ++ lib/erlDirectory.test.ts                           |    4 +-
 ++ lib/projectsDatabase.ts                            |  109 +-
@@ -3030,7 +1778,7 @@ index 8756e36..6a287ad 100644
 ++ .../businesses/projects-database/[groupId].tsx     |  111 +-
 ++ .../businesses/projects-database/window.tsx        |  107 +
 ++ vercel.json                                        |    6 +
-++ 25 files changed, 9085 insertions(+), 1007 deletions(-)
+++ 25 files changed, 13155 insertions(+), 1007 deletions(-)
 + ```
 + 
 + ## Unified Diff (truncated to first 4000 lines)
@@ -3805,7 +2553,7 @@ index 8756e36..6a287ad 100644
 +++}
 ++diff --git a/components/projectdialog/ProjectDatabaseDetailDialog.tsx b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
 ++new file mode 100644
-++index 0000000..2efd125
+++index 0000000..34283e5
 ++--- /dev/null
 +++++ b/components/projectdialog/ProjectDatabaseDetailDialog.tsx
 ++@@ -0,0 +1,44 @@
@@ -3908,7 +2656,7 @@ index 8756e36..6a287ad 100644
 +++      open={open}
 +++      onClose={onClose}
 +++      fullWidth
-+++      maxWidth="md"
++++      maxWidth="sm"
 +++    >
 +++      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
 +++        <ProjectDatabaseDetailContent
@@ -4072,4 +2820,1216 @@ index 8756e36..6a287ad 100644
 +++import { Timestamp } from 'firebase/firestore'
 + +
 +-+type Mode = 'select' | 'detail'
++++import type { ProjectRecord } from '../../lib/projectsDatabase'
++ +
++-+interface DetailSelection {
++-+  type: SortMethod
++-+  year: string
++++interface ProjectDatabaseEditDialogProps {
++++  open: boolean
++++  project: ProjectRecord | null
++++  onClose: () => void
++++  onSaved: () => void
++ +}
++ +
++-+interface ProjectsDatabasePageProps {
++-+  mode: Mode
++-+  years: string[]
++-+  error?: string
++-+  detailSelection?: DetailSelection
++-+  projects?: ProjectRecord[]
++++interface FormState {
++++  projectNumber: string
++++  projectTitle: string
++++  projectNature: string
++++  clientCompany: string
++++  amount: string
++++  paid: boolean
++++  paidTo: string
++++  invoice: string
++++  presenterWorkType: string
++++  subsidiary: string
++++  projectDate: string
++++  onDate: string
++ +}
++ +
++-+const encodeSelectionId = (type: SortMethod, year: string) => {
++-+  const yearPart = encodeURIComponent(year)
++-+  return `${type}--${yearPart}`
++++const toDateInputValue = (value: string | null) => {
++++  if (!value) return ''
++++  const parsed = new Date(value)
++++  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0]
++ +}
++ +
++-+const decodeSelectionId = (value: string): DetailSelection | null => {
++-+  const [typePart, yearPart] = value.split('--')
++-+  if (!typePart || !yearPart) {
++-+    return null
++-+  }
++-+
++-+  if (typePart !== 'year' && typePart !== 'subsidiary') {
++-+    return null
++-+  }
++++const toTimestampOrNull = (value: string) =>
++++  value ? Timestamp.fromDate(new Date(`${value}T00:00:00`)) : null
++ +
++-+  try {
++-+    return { type: typePart, year: decodeURIComponent(yearPart) }
++-+  } catch (err) {
++-+    console.warn('[projects-database] Failed to decode selection id', err)
++-+    return null
++-+  }
++++const sanitizeText = (value: string) => {
++++  const trimmed = value.trim()
++++  return trimmed.length === 0 ? null : trimmed
++ +}
++ +
++-+const stringOrNA = (value: string | null | undefined) =>
++-+  value && value.trim().length > 0 ? value : 'N/A'
++++export default function ProjectDatabaseEditDialog({
++++  open,
++++  project,
++++  onClose,
++++  onSaved,
++++}: ProjectDatabaseEditDialogProps) {
++++  const [form, setForm] = useState<FormState | null>(null)
++++  const [saving, setSaving] = useState(false)
++++  const [error, setError] = useState<string | null>(null)
++ +
++-+const amountText = (value: number | null | undefined) => {
++-+  if (value === null || value === undefined) {
++-+    return '-'
++-+  }
++++  useEffect(() => {
++++    if (!project) {
++++      setForm(null)
++++      return
++++    }
++ +
++-+  return `HK$${value.toLocaleString('en-US', {
++-+    minimumFractionDigits: 0,
++-+    maximumFractionDigits: 2,
++-+  })}`
++-+}
++++    setForm({
++++      projectNumber: project.projectNumber ?? '',
++++      projectTitle: project.projectTitle ?? '',
++++      projectNature: project.projectNature ?? '',
++++      clientCompany: project.clientCompany ?? '',
++++      amount:
++++        project.amount !== null && project.amount !== undefined
++++          ? String(project.amount)
++++          : '',
++++      paid: Boolean(project.paid),
++++      paidTo: project.paidTo ?? '',
++++      invoice: project.invoice ?? '',
++++      presenterWorkType: project.presenterWorkType ?? '',
++++      subsidiary: project.subsidiary ?? '',
++++      projectDate: toDateInputValue(project.projectDateIso),
++++      onDate: toDateInputValue(project.onDateIso),
++++    })
++++    setError(null)
++++  }, [project])
++ +
++-+const paidStatusText = (value: boolean | null | undefined) => {
++-+  if (value === null || value === undefined) {
++-+    return 'N/A'
++-+  }
++-+  return value ? 'Paid' : 'Unpaid'
++-+}
++++  const disabled = useMemo(() => saving || !form || !project, [saving, form, project])
++ +
++-+const paidDateText = (
++-+  paid: boolean | null | undefined,
++-+  date: string | null | undefined
++-+) => {
++-+  if (!paid) {
++-+    return null
++++  const handleChange = (field: keyof FormState) =>
++++    (event: React.ChangeEvent<HTMLInputElement>) => {
++++      if (!form) return
++++      setForm({ ...form, [field]: event.target.value })
++++    }
++++
++++  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
++++    if (!form) return
++++    setForm({ ...form, paid: checked })
++ +  }
++ +
++-+  return date && date.trim().length > 0 ? date : '-'
++-+}
++++  const handleSubmit = async () => {
++++    if (!project || !form) return
++ +
++-+export default function ProjectsDatabasePage({
++-+  mode,
++-+  years,
++-+  error,
++-+  detailSelection,
++-+  projects = [],
++-+}: ProjectsDatabasePageProps) {
++-+  const router = useRouter()
++-+
++-+  const [sortMethod, setSortMethod] = useState<SortMethod>(
++-+    detailSelection?.type ?? 'year'
++-+  )
++-+  const [selectedYear, setSelectedYear] = useState<string>(
++-+    detailSelection?.year ?? years[0] ?? ''
++-+  )
++++    setSaving(true)
++++    setError(null)
++ +
++-+  const handleYearChange = (event: SelectChangeEvent<string>) => {
++-+    setSelectedYear(event.target.value)
++-+  }
++++    const amountValue = form.amount.trim()
++++    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
++++    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
++++      setError('Amount must be a number')
++++      setSaving(false)
++++      return
++++    }
++ +
++-+  useEffect(() => {
++-+    if (!selectedYear && years.length > 0) {
++-+      setSelectedYear(years[0])
++++    const updates: Record<string, unknown> = {
++++      projectNumber: sanitizeText(form.projectNumber),
++++      projectTitle: sanitizeText(form.projectTitle),
++++      projectNature: sanitizeText(form.projectNature),
++++      clientCompany: sanitizeText(form.clientCompany),
++++      presenterWorkType: sanitizeText(form.presenterWorkType),
++++      subsidiary: sanitizeText(form.subsidiary),
++++      invoice: sanitizeText(form.invoice),
++++      paidTo: sanitizeText(form.paidTo),
++++      paid: form.paid,
++ +    }
++-+  }, [years, selectedYear])
++ +
++-+  useEffect(() => {
++-+    if (detailSelection) {
++-+      setSortMethod(detailSelection.type)
++-+      setSelectedYear(detailSelection.year)
++++    if (form.amount.trim().length === 0) {
++++      updates.amount = null
++++    } else if (parsedAmount !== null) {
++++      updates.amount = parsedAmount
++ +    }
++-+  }, [detailSelection])
++ +
++-+  const handleNavigate = (type: SortMethod, year: string) => {
++-+    if (!year) {
++-+      return
++++    updates.projectDate = toTimestampOrNull(form.projectDate)
++++    updates.onDate = toTimestampOrNull(form.onDate)
++++
++++    try {
++++      const response = await fetch(
++++        `/api/projects-database/${encodeURIComponent(project.year)}/${encodeURIComponent(project.id)}`,
++++        {
++++          method: 'PATCH',
++++          headers: { 'Content-Type': 'application/json' },
++++          body: JSON.stringify({ updates }),
++++        }
++++      )
++++
++++      if (!response.ok) {
++++        const payload = await response.json().catch(() => ({}))
++++        throw new Error(payload.error || 'Failed to update project')
++++      }
++++
++++      onSaved()
++++    } catch (err) {
++++      const message = err instanceof Error ? err.message : 'Failed to update project'
++++      setError(message)
++++    } finally {
++++      setSaving(false)
++ +    }
++++  }
++ +
++-+    router.push(
++-+      `/dashboard/businesses/projects-database/${encodeSelectionId(type, year)}`
++-+    )
++++  if (!project || !form) {
++++    return null
++ +  }
++ +
++-+  if (mode === 'select') {
++-+    return (
++-+      <SidebarLayout>
++-+        <Box sx={{ mb: 3 }}>
++-+          <Typography variant="h4" sx={headingSx} gutterBottom>
++-+            Projects (Database)
++-+          </Typography>
++-+          <Typography variant="h6" sx={{ ...headingSx, mt: 2 }}>
++-+            Establish Productions Limited
++-+          </Typography>
++-+        </Box>
++++  return (
++++    <Dialog open={open} onClose={disabled ? undefined : onClose} fullWidth maxWidth="sm">
++++      <DialogTitle>Edit Project</DialogTitle>
++++      <DialogContent dividers>
++++        <Typography variant="subtitle1" sx={{ mb: 2 }}>
++++          {project.projectNumber} — {project.projectTitle ?? 'Untitled'}
++++        </Typography>
++ +        {error && (
++-+          <Typography color="error" sx={{ mb: 2 }}>
++++          <Alert severity="error" sx={{ mb: 2 }}>
++ +            {error}
++-+          </Typography>
++++          </Alert>
++ +        )}
++-+        <Box
++-+          sx={{
++-+            display: 'flex',
++-+            flexWrap: 'wrap',
++-+            gap: 2,
++-+            alignItems: 'center',
++-+            mb: 3,
++-+          }}
++-+        >
++-+          <ToggleButtonGroup
++-+            value={sortMethod}
++-+            exclusive
++-+            onChange={(event, value: SortMethod | null) => {
++-+              if (value) {
++-+                setSortMethod(value)
++-+              }
++-+            }}
++-+            size="small"
++-+          >
++-+            <ToggleButton value="year">By Year</ToggleButton>
++-+            <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
++-+          </ToggleButtonGroup>
++-+          {sortMethod === 'year' && years.length > 0 && (
++-+            <FormControl sx={{ minWidth: 160 }}>
++-+              <InputLabel>Year</InputLabel>
++-+              <Select
++-+                value={selectedYear}
++-+                label="Year"
++-+                onChange={handleYearChange}
++-+              >
++-+                {years.map((year) => (
++-+                  <MenuItem key={year} value={year}>
++-+                    {year}
++-+                  </MenuItem>
++-+                ))}
++-+              </Select>
++-+            </FormControl>
++-+          )}
++-+        </Box>
++-+        {sortMethod === 'year' ? (
++-+          years.length === 0 ? (
++-+            <Typography>No project collections available.</Typography>
++-+          ) : selectedYear ? (
++-+            <Grid container spacing={2}>
++-+              <Grid item xs={12} sm={6} md={4}>
++-+                <Card
++-+                  sx={{ cursor: 'pointer', height: '100%' }}
++-+                  onClick={() => handleNavigate('year', selectedYear)}
++-+                >
++-+                  <CardContent>
++-+                    <Typography variant="h6" sx={headingSx} gutterBottom>
++-+                      Establish Productions Limited
++-+                    </Typography>
++-+                    <Typography sx={valueSx}>{selectedYear} Projects</Typography>
++-+                  </CardContent>
++-+                </Card>
++-+              </Grid>
++-+            </Grid>
++-+          ) : (
++-+            <Typography>Please choose a year to continue.</Typography>
++-+          )
++-+        ) : years.length === 0 ? (
++-+          <Typography>No project collections available.</Typography>
++-+        ) : (
++-+          <Grid container spacing={2}>
++-+            {years.map((year) => (
++-+              <Grid item xs={12} sm={6} md={4} key={year}>
++-+                <Card
++-+                  sx={{ cursor: 'pointer', height: '100%' }}
++-+                  onClick={() => handleNavigate('subsidiary', year)}
++-+                >
++-+                  <CardContent>
++-+                    <Typography variant="h6" sx={headingSx} gutterBottom>
++-+                      {year}
++-+                    </Typography>
++-+                    <Typography sx={valueSx}>Project Collection</Typography>
++-+                  </CardContent>
++-+                </Card>
++-+              </Grid>
++-+            ))}
++++        <Grid container spacing={2}>
++++          <Grid item xs={12} sm={6}>
++++            <TextField
++++              label="Project Number"
++++              value={form.projectNumber}
++++              onChange={handleChange('projectNumber')}
++++              fullWidth
++++            />
++ +          </Grid>
++-+        )}
++-+      </SidebarLayout>
++-+    )
++-+  }
++-+
++-+  const handleBack = () => {
++-+    router.push('/dashboard/businesses/projects-database/select')
++-+  }
++-+
++-+  const headerLabel = detailSelection
++-+    ? detailSelection.type === 'year'
++-+      ? `Establish Productions Limited — ${detailSelection.year}`
++-+      : `${detailSelection.year} Projects`
++-+    : 'Projects'
++-+
++-+  return (
++-+    <SidebarLayout>
++-+      <Box
++-+        sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
++-+      >
++-+        <IconButton onClick={handleBack}>
++-+          <ArrowBackIcon />
++-+        </IconButton>
++-+        <Box sx={{ textAlign: 'center' }}>
++-+          <Typography variant="h5" sx={headingSx}>
++-+            {headerLabel}
++-+          </Typography>
++-+          <Typography sx={valueSx}>Project Overview</Typography>
++-+        </Box>
++-+        <Button
++-+          variant="contained"
++-+          onClick={() => router.push('/dashboard/businesses/new')}
++-+        >
++-+          New Project
++++          <Grid item xs={12} sm={6}>
++++            <TextField
++++              label="Client Company"
++++              value={form.clientCompany}
++++              onChange={handleChange('clientCompany')}
++++              fullWidth
++++            />
++++          </Grid>
++++          <Grid item xs={12}>
++++            <TextField
++++              label="Project Title"
++++              value={form.projectTitle}
++++              onChange={handleChange('projectTitle')}
++++              fullWidth
++++            />
++++          </Grid>
++++          <Grid item xs={12}>
++++            <TextField
++++              label="Project Nature"
++++              value={form.projectNature}
++++              onChange={handleChange('projectNature')}
```
