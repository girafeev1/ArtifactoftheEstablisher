# PR #263 — Diff Summary

- **Base (target)**: `332da4bfa690be735d61edd798182f78d1fddcf8`
- **Head (source)**: `cc49797cc0180c6d5b098867c76564798cea7496`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
A	__tests__/pages/auth/signin.test.tsx
A	__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
M	lib/firebase.ts
A	pages/api/auth/nextauth-credentials-diagnostics.ts
M	pages/auth/signin.tsx
M	pages/dashboard/new-ui/client-accounts.tsx
```

## Stats

```txt
 __tests__/pages/auth/signin.test.tsx               | 197 ++++++++++++
 .../dashboard/new-ui/client-accounts.test.tsx      |  39 +++
 lib/firebase.ts                                    |  17 +-
 pages/api/auth/nextauth-credentials-diagnostics.ts | 110 +++++++
 pages/auth/signin.tsx                              | 143 +++++++--
 pages/dashboard/new-ui/client-accounts.tsx         | 329 ++++++++++++++++-----
 6 files changed, 731 insertions(+), 104 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/__tests__/pages/auth/signin.test.tsx b/__tests__/pages/auth/signin.test.tsx
new file mode 100644
index 0000000..b5e0e06
--- /dev/null
+++ b/__tests__/pages/auth/signin.test.tsx
@@ -0,0 +1,197 @@
+/** @jest-environment jsdom */
+
+import '@testing-library/jest-dom'
+import { fireEvent, render, screen, waitFor } from '@testing-library/react'
+
+jest.mock('next/router', () => ({
+  useRouter: () => ({
+    replace: jest.fn(),
+  }),
+}))
+
+const mockSignIn = jest.fn()
+
+jest.mock('next-auth/react', () => ({
+  signIn: (...args: unknown[]) => mockSignIn(...args),
+  useSession: () => ({ status: 'unauthenticated' }),
+}))
+
+const mockCredentialFromResult = jest.fn()
+const mockSignInWithPopup = jest.fn()
+
+jest.mock('firebase/auth', () => ({
+  GoogleAuthProvider: Object.assign(
+    function GoogleAuthProvider(this: any) {
+      this.addScope = jest.fn()
+      this.setCustomParameters = jest.fn()
+    },
+    {
+      credentialFromResult: (...args: unknown[]) => mockCredentialFromResult(...args),
+    }
+  ),
+  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
+  signInWithEmailAndPassword: jest.fn(),
+  createUserWithEmailAndPassword: jest.fn(),
+}))
+
+jest.mock('../../../lib/firebaseClientAuth', () => ({
+  auth: {},
+}))
+
+describe('SignInPage Google diagnostics', () => {
+  let consoleErrorSpy: jest.SpyInstance
+
+  beforeEach(() => {
+    mockSignIn.mockReset()
+    mockSignInWithPopup.mockReset()
+    mockCredentialFromResult.mockReset()
+    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
+  })
+
+  afterEach(() => {
+    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
+    delete (global as Record<string, unknown>).fetch
+    consoleErrorSpy.mockRestore()
+  })
+
+  it('surfaces NextAuth diagnostics failures ahead of other messaging', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    mockSignIn.mockResolvedValue({
+      error: 'CredentialsSignin',
+      ok: false,
+      status: 401,
+    })
+
+    const nextAuthDiagnosticsMessage = 'NextAuth authorize exploded'
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({
+            ok: true,
+            json: async () => ({ ok: false, message: nextAuthDiagnosticsMessage, name: 'AuthorizeError' }),
+          })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({
+            ok: true,
+            json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }),
+          })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthDiagnosticsMessage)
+    })
+  })
+
+  it('combines diagnostics when both Firebase and NextAuth accept the credentials', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    mockSignIn.mockResolvedValue({
+      error: 'CredentialsSignin',
+      ok: false,
+      status: 401,
+    })
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({ ok: true, json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }) })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(
+        'NextAuth authorize() and Firebase Admin both accepted the credentials when retried directly, but the sign-in endpoint still responded with "CredentialsSignin". Check the server logs for callback or session errors.'
+      )
+    })
+  })
+
+  it('falls back to NextAuth error when diagnostics return nothing', async () => {
+    mockSignInWithPopup.mockResolvedValue({
+      user: {
+        getIdToken: jest.fn().mockResolvedValue('id-token'),
+        refreshToken: 'refresh-token',
+      },
+    })
+
+    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })
+
+    const nextAuthError = 'Server rejected credentials'
+
+    mockSignIn.mockResolvedValue({
+      error: nextAuthError,
+      ok: false,
+      status: 401,
+    })
+
+    global.fetch = jest
+      .fn()
+      .mockImplementation((input: RequestInfo | URL) => {
+        const url = typeof input === 'string' ? input : input.toString()
+
+        if (url.includes('nextauth-credentials-diagnostics')) {
+          return Promise.resolve({ ok: false })
+        }
+
+        if (url.includes('firebase-diagnostics')) {
+          return Promise.resolve({ ok: false })
+        }
+
+        throw new Error(`Unexpected fetch call to ${url}`)
+      }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthError)
+    })
+  })
+})
diff --git a/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx b/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
new file mode 100644
index 0000000..a6a0e1e
--- /dev/null
+++ b/__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
@@ -0,0 +1,39 @@
+import type { GetServerSidePropsContext } from 'next'
+import { getSession } from 'next-auth/react'
+
+import { getServerSideProps } from '../../../../pages/dashboard/new-ui/client-accounts'
+
+jest.mock('next-auth/react', () => ({
+  getSession: jest.fn(),
+}))
+
+describe('Client Accounts (Refine preview) getServerSideProps', () => {
+  const mockContext = {} as GetServerSidePropsContext
+  const getSessionMock = getSession as jest.Mock
+
+  beforeEach(() => {
+    getSessionMock.mockReset()
+  })
+
+  it('redirects to sign-in when no authenticated user is present', async () => {
+    getSessionMock.mockResolvedValue(null)
+
+    const result = await getServerSideProps(mockContext)
+
+    expect(result).toEqual({
+      redirect: { destination: '/api/auth/signin', permanent: false },
+    })
+    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
+  })
+
+  it('allows access when the session only includes user information', async () => {
+    getSessionMock.mockResolvedValue({
+      user: { name: 'Ada Lovelace', email: 'ada@example.com' },
+    })
+
+    const result = await getServerSideProps(mockContext)
+
+    expect(result).toEqual({ props: {} })
+    expect(getSessionMock).toHaveBeenCalledWith(mockContext)
+  })
+})
diff --git a/lib/firebase.ts b/lib/firebase.ts
index 35c04e9..4ccb833 100644
--- a/lib/firebase.ts
+++ b/lib/firebase.ts
@@ -9,19 +9,20 @@ const firebaseConfig = {
   projectId:            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
   storageBucket:        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
   messagingSenderId:    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
-  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
+  appId:                process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
 }
 
-console.log('🔥 Firebase config:', firebaseConfig)
-Object.entries(firebaseConfig).forEach(([k, v]) => {
-  console.log(`   ${k}: ${v}`)
-})
-
 const DEFAULT_DATABASE_ID = 'mel-sessions'
 const PROJECTS_DATABASE_ID = 'epl-projects'
 
-console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
-console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
+if (process.env.NODE_ENV !== 'production') {
+  console.log('🔥 Firebase config:', firebaseConfig)
+  Object.entries(firebaseConfig).forEach(([k, v]) => {
+    console.log(`   ${k}: ${v}`)
+  })
+  console.log('📚 Firestore database ID:', DEFAULT_DATABASE_ID)
+  console.log('📚 Firestore projects database ID:', PROJECTS_DATABASE_ID)
+}
 
 export const app = !getApps().length
   ? initializeApp(firebaseConfig)
diff --git a/pages/api/auth/nextauth-credentials-diagnostics.ts b/pages/api/auth/nextauth-credentials-diagnostics.ts
new file mode 100644
index 0000000..4436596
--- /dev/null
+++ b/pages/api/auth/nextauth-credentials-diagnostics.ts
@@ -0,0 +1,110 @@
+import type { NextApiRequest, NextApiResponse } from 'next'
+
+import { getAuthOptions } from './[...nextauth]'
+
+interface DiagnosticsSuccessResponse {
+  ok: true
+}
+
+interface DiagnosticsFailureResponse {
+  ok: false
+  message?: string
+  name?: string
+}
+
+type DiagnosticsResponse = DiagnosticsSuccessResponse | DiagnosticsFailureResponse
+
+type AuthorizeContext = {
+  query: NextApiRequest['query']
+  body: unknown
+  headers: NextApiRequest['headers']
+  method: NextApiRequest['method']
+}
+
+export default async function handler(
+  req: NextApiRequest,
+  res: NextApiResponse<DiagnosticsResponse>
+) {
+  if (req.method !== 'POST') {
+    res.setHeader('Allow', ['POST'])
+    res.status(405).json({ ok: false, message: 'Method Not Allowed', name: 'MethodNotAllowed' })
+    return
+  }
+
+  const body = typeof req.body === 'object' && req.body !== null ? req.body : {}
+  const idToken = typeof (body as Record<string, unknown>).idToken === 'string'
+    ? ((body as Record<string, unknown>).idToken as string)
+    : ''
+
+  if (!idToken.trim()) {
+    res.status(400).json({ ok: false, message: 'Missing Firebase ID token', name: 'MissingTokenError' })
+    return
+  }
+
+  try {
+    const options = await getAuthOptions()
+    const credentialsProvider = options.providers.find(
+      (provider: any) => provider.id === 'credentials' && provider.type === 'credentials'
+    ) as { authorize?: (credentials: Record<string, string>, ctx: AuthorizeContext) => Promise<unknown> } | undefined
+
+    if (!credentialsProvider?.authorize) {
+      res.status(200).json({
+        ok: false,
+        message: 'NextAuth credentials provider is not configured.',
+        name: 'CredentialsProviderMissing',
+      })
+      return
+    }
+
+    const authorizeContext: AuthorizeContext = {
+      query: req.query,
+      body,
+      headers: req.headers,
+      method: req.method,
+    }
+
+    const normalizedCredentials: Record<string, string> = {
+      idToken,
+    }
+
+    const accessToken = (body as Record<string, unknown>).accessToken
+    if (typeof accessToken === 'string' && accessToken.trim()) {
+      normalizedCredentials.accessToken = accessToken
+    }
+
+    const refreshToken = (body as Record<string, unknown>).refreshToken
+    if (typeof refreshToken === 'string' && refreshToken.trim()) {
+      normalizedCredentials.refreshToken = refreshToken
+    }
+
+    try {
+      const user = await credentialsProvider.authorize(normalizedCredentials, authorizeContext)
+
+      if (!user) {
+        res.status(200).json({
+          ok: false,
+          message: 'NextAuth authorize returned null for the supplied credentials.',
+          name: 'CredentialsAuthorizeReturnedNull',
+        })
+        return
+      }
+
+      res.status(200).json({ ok: true })
+    } catch (error) {
+      const message =
+        error instanceof Error
+          ? error.message
+          : 'NextAuth authorize threw an unknown error while verifying the credentials.'
+      const name = error instanceof Error && error.name ? error.name : 'UnknownAuthorizeError'
+      console.error('[auth] NextAuth credentials diagnostics failed', error)
+      res.status(200).json({ ok: false, message, name })
+    }
+  } catch (error) {
+    console.error('[auth] Unable to load NextAuth options for diagnostics', error)
+    res.status(200).json({
+      ok: false,
+      message: 'Failed to load NextAuth configuration for diagnostics.',
+      name: 'NextAuthOptionsError',
+    })
+  }
+}
diff --git a/pages/auth/signin.tsx b/pages/auth/signin.tsx
index bed353d..9392688 100644
--- a/pages/auth/signin.tsx
+++ b/pages/auth/signin.tsx
@@ -35,6 +35,26 @@ type FirebaseDiagnosticsResponse =
       }
     }
 
+type FirebaseDiagnosticsResult =
+  | { status: 'success'; projectId: string | null }
+  | { status: 'failure'; message: string }
+  | { status: 'unavailable' }
+
+type NextAuthDiagnosticsResponse =
+  | { ok: true }
+  | { ok: false; message?: string; name?: string }
+
+type NextAuthDiagnosticsResult =
+  | { status: 'success' }
+  | { status: 'failure'; message: string }
+  | { status: 'unavailable' }
+
+type CredentialExchangeParams = {
+  idToken: string
+  accessToken?: string | null
+  refreshToken?: string | null
+}
+
 const buttonStyles = {
   height: 48,
   justifyContent: 'center',
@@ -64,7 +84,7 @@ export default function SignInPage() {
     return provider
   }, [])
 
-  const diagnoseCredentialFailure = useCallback(async (idToken: string) => {
+  const runFirebaseDiagnostics = useCallback(async (idToken: string): Promise<FirebaseDiagnosticsResult> => {
     try {
       const response = await fetch('/api/auth/firebase-diagnostics', {
         method: 'POST',
@@ -73,26 +93,26 @@ export default function SignInPage() {
       })
 
       if (!response.ok) {
-        return null
+        return { status: 'unavailable' }
       }
 
       const data = (await response.json()) as FirebaseDiagnosticsResponse
 
       if (data.ok) {
-        return 'Firebase Admin accepted the token when retried directly, but NextAuth still rejected the exchange. Check the server logs for additional context.'
+        return { status: 'success', projectId: data.projectId ?? null }
       }
 
       const messageParts: string[] = []
 
-      if (data.message) {
+      if ('message' in data && data.message) {
         messageParts.push(data.message)
       }
 
-      if (data.code) {
+      if ('code' in data && data.code) {
         messageParts.push(`(code: ${data.code})`)
       }
 
-      if (data.config) {
+      if ('config' in data && data.config) {
         if (data.config.credentialSource !== 'service-account') {
           messageParts.push(
             'Firebase Admin is running without service-account credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.'
@@ -109,18 +129,103 @@ export default function SignInPage() {
         }
       }
 
-      return messageParts.join(' ')
+      if (messageParts.length) {
+        return { status: 'failure', message: messageParts.join(' ') }
+      }
+
+      return {
+        status: 'failure',
+        message: 'Firebase diagnostics returned an error without details.',
+      }
     } catch (diagnosticError) {
       console.error('[auth] Failed to run Firebase diagnostics', diagnosticError)
-      return null
+      return { status: 'unavailable' }
     }
   }, [])
 
-  const completeNextAuth = async (params: {
-    idToken: string
-    accessToken?: string | null
-    refreshToken?: string | null
-  }) => {
+  const runNextAuthDiagnostics = useCallback(
+    async (params: CredentialExchangeParams): Promise<NextAuthDiagnosticsResult> => {
+      try {
+        const response = await fetch('/api/auth/nextauth-credentials-diagnostics', {
+          method: 'POST',
+          headers: { 'Content-Type': 'application/json' },
+          body: JSON.stringify({
+            idToken: params.idToken,
+            accessToken: params.accessToken ?? undefined,
+            refreshToken: params.refreshToken ?? undefined,
+          }),
+        })
+
+        if (!response.ok) {
+          return { status: 'unavailable' }
+        }
+
+        const data = (await response.json()) as NextAuthDiagnosticsResponse
+
+        if (data.ok) {
+          return { status: 'success' }
+        }
+
+        const messageParts: string[] = []
+        if ('message' in data && data.message) {
+          messageParts.push(data.message)
+        }
+
+        if ('name' in data && data.name) {
+          messageParts.push(`(${data.name})`)
+        }
+
+        if (messageParts.length) {
+          return { status: 'failure', message: messageParts.join(' ') }
+        }
+
+        return {
+          status: 'failure',
+          message: 'NextAuth diagnostics returned an error without details.',
+        }
+      } catch (diagnosticError) {
+        console.error('[auth] Failed to run NextAuth diagnostics', diagnosticError)
+        return { status: 'unavailable' }
+      }
+    },
+    []
+  )
+
+  const diagnoseCredentialFailure = useCallback(
+    async (params: CredentialExchangeParams, responseError?: string | null) => {
+      const [nextAuthDiagnostics, firebaseDiagnostics] = await Promise.all([
+        runNextAuthDiagnostics(params),
+        runFirebaseDiagnostics(params.idToken),
+      ])
+
+      if (nextAuthDiagnostics.status === 'failure') {
+        return nextAuthDiagnostics.message
+      }
+
+      if (firebaseDiagnostics.status === 'failure') {
+        return firebaseDiagnostics.message
+      }
+
+      const quotedError = responseError ? `"${responseError}"` : 'an unspecified error'
+
+      if (nextAuthDiagnostics.status === 'success' && firebaseDiagnostics.status === 'success') {
+        return `NextAuth authorize() and Firebase Admin both accepted the credentials when retried directly, but the sign-in endpoint still responded with ${quotedError}. Check the server logs for callback or session errors.`
+      }
+
+      if (nextAuthDiagnostics.status === 'success') {
+        return `NextAuth authorize() accepted the credentials when retried directly, but the sign-in endpoint still responded with ${quotedError}. Check the server logs for callback or session errors.`
+      }
+
+      if (firebaseDiagnostics.status === 'success') {
+        return 'Firebase Admin accepted the token when retried directly, but NextAuth still rejected the exchange. Check the server logs for additional context.'
+      }
+
+      return null
+    },
+    [runFirebaseDiagnostics, runNextAuthDiagnostics]
+  )
+
+  const completeNextAuth = async (params: CredentialExchangeParams) => {
     const response = await signIn('credentials', {
       idToken: params.idToken,
       accessToken: params.accessToken ?? '',
@@ -134,13 +239,11 @@ export default function SignInPage() {
 
     if (response.error) {
       console.error('[auth] NextAuth credential exchange failed', response)
-      let mappedError = response.error
-
-      if (response.error === 'CredentialsSignin') {
-        mappedError =
-          (await diagnoseCredentialFailure(params.idToken)) ??
-          'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'
-      }
+      const diagnosticMessage = await diagnoseCredentialFailure(params, response.error)
+      const mappedError =
+        diagnosticMessage ??
+        response.error ??
+        'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'
 
       throw new Error(mappedError)
     }
diff --git a/pages/dashboard/new-ui/client-accounts.tsx b/pages/dashboard/new-ui/client-accounts.tsx
index aae8352..b1f13e4 100644
--- a/pages/dashboard/new-ui/client-accounts.tsx
+++ b/pages/dashboard/new-ui/client-accounts.tsx
@@ -1,9 +1,11 @@
 import Head from "next/head"
+import Link from "next/link"
 import dynamic from "next/dynamic"
 import { memo, useMemo, useState } from "react"
 import {
   Refine,
   useList,
+  useMenu,
   type DataProvider,
   type BaseRecord,
   type GetListResponse,
@@ -12,6 +14,7 @@ import routerProvider from "@refinedev/nextjs-router"
 import {
   Avatar,
   Box,
+  Button,
   Card,
   CardContent,
   Chip,
@@ -20,12 +23,21 @@ import {
   InputAdornment,
   LinearProgress,
   Stack,
+  Table,
+  TableBody,
+  TableCell,
+  TableHead,
+  TableRow,
   TextField,
   ThemeProvider,
+  ToggleButton,
+  ToggleButtonGroup,
   Typography,
   createTheme,
 } from "@mui/material"
 import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
+import ViewModuleRoundedIcon from "@mui/icons-material/ViewModuleRounded"
+import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded"
 import type { GetServerSideProps } from "next"
 import { getSession } from "next-auth/react"
 
@@ -84,7 +96,7 @@ const refineDataProvider: DataProvider = {
   createMany: () => Promise.reject(new Error("Not implemented")),
 }
 
-const ClientAccountsGallery = memo(() => {
+const ClientAccountsGallery = memo(({ viewMode }: { viewMode: "cards" | "list" }) => {
   const { query, result } = useList<ClientDirectoryRecord & { id: string }>({
     resource: "client-directory",
     pagination: {
@@ -119,9 +131,85 @@ const ClientAccountsGallery = memo(() => {
     })
   }, [rows, search])
 
-  if (query.isLoading) {
-    return <LinearProgress sx={{ width: "100%" }} />
-  }
+  const renderCards = () => (
+    <Grid container spacing={2}>
+      {filtered.map((row) => (
+        <Grid item key={row.id} xs={12} sm={6} lg={4}>
+          <Card variant="outlined" sx={{ height: "100%" }}>
+            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
+              <Stack direction="row" spacing={2} alignItems="center">
+                <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
+                  {row.companyName.slice(0, 2).toUpperCase()}
+                </Avatar>
+                <Box>
+                  <Typography variant="subtitle1" fontWeight={600}>
+                    {row.companyName}
+                  </Typography>
+                  <Typography variant="body2" color="text.secondary">
+                    {row.title ?? "—"}
+                  </Typography>
+                </Box>
+              </Stack>
+
+              <Stack spacing={0.5}>
+                <Typography variant="body2" color="text.secondary">
+                  Contact
+                </Typography>
+                <Typography variant="body1">
+                  {row.nameAddressed ?? row.name ?? "—"}
+                </Typography>
+              </Stack>
+
+              <Stack spacing={0.5}>
+                <Typography variant="body2" color="text.secondary">
+                  Email
+                </Typography>
+                <Typography variant="body1">{row.emailAddress ?? "—"}</Typography>
+              </Stack>
+
+              <Stack spacing={0.5}>
+                <Typography variant="body2" color="text.secondary">
+                  Phone
+                </Typography>
+                <Typography variant="body1">{row.phone ?? "—"}</Typography>
+              </Stack>
+
+              <Box>
+                <Chip label={row.region ?? "Region unknown"} size="small" />
+              </Box>
+            </CardContent>
+          </Card>
+        </Grid>
+      ))}
+    </Grid>
+  )
+
+  const renderList = () => (
+    <Table size="small">
+      <TableHead>
+        <TableRow>
+          <TableCell>Company</TableCell>
+          <TableCell>Contact</TableCell>
+          <TableCell>Email</TableCell>
+          <TableCell>Phone</TableCell>
+          <TableCell>Region</TableCell>
+        </TableRow>
+      </TableHead>
+      <TableBody>
+        {filtered.map((row) => (
+          <TableRow key={row.id} hover>
+            <TableCell sx={{ fontWeight: 600 }}>{row.companyName}</TableCell>
+            <TableCell>{row.nameAddressed ?? row.name ?? "—"}</TableCell>
+            <TableCell>{row.emailAddress ?? "—"}</TableCell>
+            <TableCell>{row.phone ?? "—"}</TableCell>
+            <TableCell>
+              <Chip label={row.region ?? "Region unknown"} size="small" />
+            </TableCell>
+          </TableRow>
+        ))}
+      </TableBody>
+    </Table>
+  )
 
   return (
     <Stack spacing={3}>
@@ -138,56 +226,13 @@ const ClientAccountsGallery = memo(() => {
         }}
       />
 
-      <Grid container spacing={2}>
-        {filtered.map((row) => (
-          <Grid item key={row.id} xs={12} sm={6} lg={4}>
-            <Card variant="outlined" sx={{ height: "100%" }}>
-              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
-                <Stack direction="row" spacing={2} alignItems="center">
-                  <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
-                    {row.companyName.slice(0, 2).toUpperCase()}
-                  </Avatar>
-                  <Box>
-                    <Typography variant="subtitle1" fontWeight={600}>
-                      {row.companyName}
-                    </Typography>
-                    <Typography variant="body2" color="text.secondary">
-                      {row.title ?? "—"}
-                    </Typography>
-                  </Box>
-                </Stack>
-
-                <Stack spacing={0.5}>
-                  <Typography variant="body2" color="text.secondary">
-                    Contact
-                  </Typography>
-                  <Typography variant="body1">
-                    {row.nameAddressed ?? row.name ?? "—"}
-                  </Typography>
-                </Stack>
-
-                <Stack spacing={0.5}>
-                  <Typography variant="body2" color="text.secondary">
-                    Email
-                  </Typography>
-                  <Typography variant="body1">{row.emailAddress ?? "—"}</Typography>
-                </Stack>
-
-                <Stack spacing={0.5}>
-                  <Typography variant="body2" color="text.secondary">
-                    Phone
-                  </Typography>
-                  <Typography variant="body1">{row.phone ?? "—"}</Typography>
-                </Stack>
-
-                <Box>
-                  <Chip label={row.region ?? "Region unknown"} size="small" />
-                </Box>
-              </CardContent>
-            </Card>
-          </Grid>
-        ))}
-      </Grid>
+      {query.isLoading ? (
+        <LinearProgress sx={{ width: "100%" }} />
+      ) : viewMode === "cards" ? (
+        renderCards()
+      ) : (
+        renderList()
+      )}
     </Stack>
   )
 })
@@ -196,28 +241,160 @@ ClientAccountsGallery.displayName = "ClientAccountsGallery"
 
 const theme = createTheme({ palette: { mode: "light" } })
 
-const ClientAccountsShell = () => (
-  <ThemeProvider theme={theme}>
-    <CssBaseline />
-    <Refine
-      dataProvider={refineDataProvider}
-      routerProvider={routerProvider}
-      resources={[{ name: "client-directory" }]}
-      options={{ syncWithLocation: false }}
+const SidebarNavigation = memo(() => {
+  const { menuItems } = useMenu()
+
+  const renderItems = (items: typeof menuItems, depth = 0) =>
+    items.map((item) => {
+      const label = item.label ?? item.name
+      const href = item.route ?? item.link ?? item.list ?? "#"
+      const selected = item.selected
+
+      return (
+        <Box key={item.key} sx={{ width: "100%" }}>
+          <Link href={href} prefetch={false} style={{ textDecoration: "none" }}>
+            <Box
+              sx={{
+                display: "block",
+                px: 3,
+                py: 1,
+                ml: depth * 1.5,
+                borderRadius: 2,
+                fontWeight: selected ? 600 : 400,
+                color: selected ? "primary.main" : "text.primary",
+                bgcolor: selected ? "primary.light" : "transparent",
+                transition: "background-color 150ms ease",
+                "&:hover": {
+                  bgcolor: selected ? "primary.light" : "action.hover",
+                },
+              }}
+            >
+              {label}
+            </Box>
+          </Link>
+
+          {item.children && item.children.length > 0 && (
+            <Stack component="div" spacing={0.5} sx={{ mt: 0.5 }}>
+              {renderItems(item.children, depth + 1)}
+            </Stack>
+          )}
+        </Box>
+      )
+    })
+
+  return (
+    <Box
+      component="nav"
+      sx={{
+        width: 260,
+        flexShrink: 0,
+        borderRight: "1px solid",
+        borderColor: "divider",
+        bgcolor: "background.paper",
+        display: "flex",
+        flexDirection: "column",
+        gap: 2,
+        py: 4,
+      }}
     >
-      <Box sx={{ p: 4 }}>
-        <Typography variant="h4" sx={{ mb: 2 }}>
-          Client Accounts
-        </Typography>
-        <Card>
-          <CardContent>
-            <ClientAccountsGallery />
-          </CardContent>
-        </Card>
-      </Box>
-    </Refine>
-  </ThemeProvider>
-)
+      <Typography variant="h6" sx={{ px: 3, fontWeight: 700 }}>
+        Refine CRM
+      </Typography>
+      <Stack component="div" spacing={0.5} sx={{ px: 1 }}>
+        {renderItems(menuItems)}
+      </Stack>
+    </Box>
+  )
+})
+
+SidebarNavigation.displayName = "SidebarNavigation"
+
+const ClientAccountsShell = () => {
+  const [viewMode, setViewMode] = useState<"cards" | "list">("cards")
+
+  return (
+    <ThemeProvider theme={theme}>
+      <CssBaseline />
+      <Refine
+        dataProvider={refineDataProvider}
+        routerProvider={routerProvider}
+        resources={[
+          { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard" } },
+          {
+            name: "client-directory",
+            list: "/dashboard/new-ui/client-accounts",
+            meta: { label: "Client Accounts" },
+          },
+          { name: "projects", list: "/dashboard/projects", meta: { label: "Projects" } },
+        ]}
+        options={{ syncWithLocation: false }}
+      >
+        <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
+          <SidebarNavigation />
+
+          <Box component="main" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
+            <Box
+              component="header"
+              sx={{
+                px: 4,
+                py: 2.5,
+                borderBottom: "1px solid",
+                borderColor: "divider",
+                display: "flex",
+                alignItems: "center",
+                justifyContent: "space-between",
+                gap: 2,
+              }}
+            >
+              <Box>
+                <Typography variant="h5" fontWeight={600}>
+                  Client Accounts
+                </Typography>
+                <Typography variant="body2" color="text.secondary">
+                  Review your latest client relationships and contact information.
+                </Typography>
+              </Box>
+
+              <Stack direction="row" spacing={2} alignItems="center">
+                <ToggleButtonGroup
+                  size="small"
+                  value={viewMode}
+                  exclusive
+                  onChange={(_event, next) => {
+                    if (next) {
+                      setViewMode(next)
+                    }
+                  }}
+                >
+                  <ToggleButton value="cards" aria-label="Card view">
+                    <ViewModuleRoundedIcon fontSize="small" />
+                  </ToggleButton>
+                  <ToggleButton value="list" aria-label="List view">
+                    <ViewListRoundedIcon fontSize="small" />
+                  </ToggleButton>
+                </ToggleButtonGroup>
+
+                <Button variant="contained" color="primary">
+                  Add new client
+                </Button>
+
+                <Avatar sx={{ bgcolor: "secondary.light", color: "secondary.dark" }}>AL</Avatar>
+              </Stack>
+            </Box>
+
+            <Box sx={{ p: 4, flex: 1 }}>
+              <Card variant="outlined" sx={{ height: "100%" }}>
+                <CardContent>
+                  <ClientAccountsGallery viewMode={viewMode} />
+                </CardContent>
+              </Card>
+            </Box>
+          </Box>
+        </Box>
+      </Refine>
+    </ThemeProvider>
+  )
+}
 
 const ClientAccountsNoSSR = dynamic(() => Promise.resolve(ClientAccountsShell), { ssr: false })
 
@@ -234,7 +411,7 @@ export default function ClientAccountsPage() {
 
 export const getServerSideProps: GetServerSideProps = async (ctx) => {
   const session = await getSession(ctx)
-  if (!session?.accessToken) {
+  if (!session?.user) {
     return {
       redirect: {
         destination: "/api/auth/signin",
```
