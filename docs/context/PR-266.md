# PR #266 — Diff Summary

- **Base (target)**: `332da4bfa690be735d61edd798182f78d1fddcf8`
- **Head (source)**: `5f92a22ccd2716aa136d8cc1ff4b1db8ed1270f4`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
A	__tests__/pages/auth/signin.test.tsx
A	__tests__/pages/dashboard/new-ui/client-accounts.test.tsx
M	lib/firebase.ts
M	next.config.ts
M	package-lock.json
M	package.json
M	pages/_app.tsx
A	pages/api/auth/nextauth-credentials-diagnostics.ts
M	pages/auth/signin.tsx
M	pages/dashboard/new-ui/client-accounts.tsx
```

## Stats

```txt
 __tests__/pages/auth/signin.test.tsx               |  197 ++
 .../dashboard/new-ui/client-accounts.test.tsx      |   39 +
 lib/firebase.ts                                    |   17 +-
 next.config.ts                                     |   19 +
 package-lock.json                                  | 2226 +++++++++++++++++++-
 package.json                                       |    5 +
 pages/_app.tsx                                     |    1 +
 pages/api/auth/nextauth-credentials-diagnostics.ts |  110 +
 pages/auth/signin.tsx                              |  143 +-
 pages/dashboard/new-ui/client-accounts.tsx         | 1076 ++++++++--
 10 files changed, 3552 insertions(+), 281 deletions(-)
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
diff --git a/next.config.ts b/next.config.ts
index 1571804..c8204cf 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -4,4 +4,23 @@ module.exports = {
     // your project has ESLint errors.
     ignoreDuringBuilds: true,
   },
+  experimental: {
+    esmExternals: false,
+  },
+  transpilePackages: [
+    "@refinedev/antd",
+    "@refinedev/core",
+    "@refinedev/nextjs-router",
+    "@ant-design/icons",
+    "antd",
+    "rc-util",
+    "rc-picker",
+    "rc-table",
+    "rc-tree",
+    "rc-pagination",
+    "rc-menu",
+    "rc-tabs",
+    "rc-select",
+    "rc-dropdown",
+  ],
 };
diff --git a/package-lock.json b/package-lock.json
index 24eb425..272040c 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -9,14 +9,17 @@
       "version": "1.0.0",
       "license": "ISC",
       "dependencies": {
+        "@ant-design/icons": "^5.5.3",
         "@emotion/react": "^11.14.0",
         "@emotion/styled": "^11.14.0",
         "@google-cloud/secret-manager": "^5.6.0",
         "@mui/icons-material": "^6.3.1",
         "@mui/material": "^6.4.7",
+        "@refinedev/antd": "^6.0.2",
         "@refinedev/core": "^5.0.4",
         "@refinedev/nextjs-router": "^7.0.1",
         "@tanstack/react-query": "^5.59.15",
+        "antd": "^5.23.0",
         "browserify-zlib": "^0.2.0",
         "date-fns": "^4.1.0",
         "dayjs": "^1.11.10",
@@ -25,6 +28,7 @@
         "google-auth-library": "^9.15.0",
         "googleapis": "^144.0.0",
         "jwt-decode": "^4.0.0",
+        "lodash.debounce": "^4.0.8",
         "next": "^15.2.1",
         "next-auth": "^4.24.10",
         "notistack": "^3.0.1",
@@ -46,6 +50,7 @@
         "@testing-library/react": "^16.1.0",
         "@types/cypress": "^0.1.6",
         "@types/jest": "^30.0.0",
+        "@types/lodash.debounce": "^4.0.9",
         "@types/node": "^22.10.2",
         "@types/react": "^18.3.16",
         "@types/react-dom": "^18.3.2",
@@ -88,6 +93,203 @@
         "node": ">=6.0.0"
       }
     },
+    "node_modules/@ant-design/colors": {
+      "version": "7.2.1",
+      "resolved": "https://registry.npmjs.org/@ant-design/colors/-/colors-7.2.1.tgz",
+      "integrity": "sha512-lCHDcEzieu4GA3n8ELeZ5VQ8pKQAWcGGLRTQ50aQM2iqPpq2evTxER84jfdPvsPAtEcZ7m44NI45edFMo8oOYQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/fast-color": "^2.0.6"
+      }
+    },
+    "node_modules/@ant-design/cssinjs": {
+      "version": "1.24.0",
+      "resolved": "https://registry.npmjs.org/@ant-design/cssinjs/-/cssinjs-1.24.0.tgz",
+      "integrity": "sha512-K4cYrJBsgvL+IoozUXYjbT6LHHNt+19a9zkvpBPxLjFHas1UpPM2A5MlhROb0BT8N8WoavM5VsP9MeSeNK/3mg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "@emotion/hash": "^0.8.0",
+        "@emotion/unitless": "^0.7.5",
+        "classnames": "^2.3.1",
+        "csstype": "^3.1.3",
+        "rc-util": "^5.35.0",
+        "stylis": "^4.3.4"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/@ant-design/cssinjs-utils": {
+      "version": "1.1.3",
+      "resolved": "https://registry.npmjs.org/@ant-design/cssinjs-utils/-/cssinjs-utils-1.1.3.tgz",
+      "integrity": "sha512-nOoQMLW1l+xR1Co8NFVYiP8pZp3VjIIzqV6D6ShYF2ljtdwWJn5WSsH+7kvCktXL/yhEtWURKOfH5Xz/gzlwsg==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.0",
+        "@babel/runtime": "^7.23.2",
+        "rc-util": "^5.38.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/@emotion/hash": {
+      "version": "0.8.0",
+      "resolved": "https://registry.npmjs.org/@emotion/hash/-/hash-0.8.0.tgz",
+      "integrity": "sha512-kBJtf7PH6aWwZ6fka3zQ0p6SBYzx4fl1LoZXE2RrnYST9Xljm7WfKJrU4g/Xr3Beg72MLrp1AWNUmuYJTL7Cow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/@emotion/unitless": {
+      "version": "0.7.5",
+      "resolved": "https://registry.npmjs.org/@emotion/unitless/-/unitless-0.7.5.tgz",
+      "integrity": "sha512-OWORNpfjMsSSUBVrRBVGECkhWcULOAJz9ZW8uK9qgxD+87M7jHRcvh/A96XXNhXTLmKcoYSQtBEX7lHMO7YRwg==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/cssinjs/node_modules/stylis": {
+      "version": "4.3.6",
+      "resolved": "https://registry.npmjs.org/stylis/-/stylis-4.3.6.tgz",
+      "integrity": "sha512-yQ3rwFWRfwNUY7H5vpU0wfdkNSnvnJinhF9830Swlaxl03zsOjCfmX0ugac+3LtK0lYSgwL/KXc8oYL3mG4YFQ==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/fast-color": {
+      "version": "2.0.6",
+      "resolved": "https://registry.npmjs.org/@ant-design/fast-color/-/fast-color-2.0.6.tgz",
+      "integrity": "sha512-y2217gk4NqL35giHl72o6Zzqji9O7vHh9YmhUVkPtAOpoTCH4uWxo/pr4VE8t0+ChEPs0qo4eJRC5Q1eXWo3vA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7"
+      },
+      "engines": {
+        "node": ">=8.x"
+      }
+    },
+    "node_modules/@ant-design/icons": {
+      "version": "5.6.1",
+      "resolved": "https://registry.npmjs.org/@ant-design/icons/-/icons-5.6.1.tgz",
+      "integrity": "sha512-0/xS39c91WjPAZOWsvi1//zjx6kAp4kxWwctR6kuU6p133w8RU0D2dSCvZC19uQyharg/sAvYxGYWl01BbZZfg==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/colors": "^7.0.0",
+        "@ant-design/icons-svg": "^4.4.0",
+        "@babel/runtime": "^7.24.8",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.31.1"
+      },
+      "engines": {
+        "node": ">=8"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/@ant-design/icons-svg": {
+      "version": "4.4.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/icons-svg/-/icons-svg-4.4.2.tgz",
+      "integrity": "sha512-vHbT+zJEVzllwP+CM+ul7reTEfBR0vgxFe7+lREAsAA7YGsYpboiq2sQNeQeRvh09GfQgs/GyFEvZpJ9cLXpXA==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/pro-layout": {
+      "version": "7.22.7",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-layout/-/pro-layout-7.22.7.tgz",
+      "integrity": "sha512-fvmtNA1r9SaasVIQIQt611VSlNxtVxDbQ3e+1GhYQza3tVJi/3gCZuDyfMfTnbLmf3PaW/YvLkn7MqDbzAzoLA==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.1",
+        "@ant-design/icons": "^5.0.0",
+        "@ant-design/pro-provider": "2.16.2",
+        "@ant-design/pro-utils": "2.18.0",
+        "@babel/runtime": "^7.18.0",
+        "@umijs/route-utils": "^4.0.0",
+        "@umijs/use-params": "^1.0.9",
+        "classnames": "^2.3.2",
+        "lodash": "^4.17.21",
+        "lodash-es": "^4.17.21",
+        "path-to-regexp": "8.2.0",
+        "rc-resize-observer": "^1.1.0",
+        "rc-util": "^5.0.6",
+        "swr": "^2.0.0",
+        "warning": "^4.0.3"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-layout/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/pro-provider": {
+      "version": "2.16.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-provider/-/pro-provider-2.16.2.tgz",
+      "integrity": "sha512-0KmCH1EaOND787Jz6VRMYtLNZmqfT0JPjdUfxhyOxFfnBRfrjyfZgIa6CQoAJLEUMWv57PccWS8wRHVUUk2Yiw==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/cssinjs": "^1.21.1",
+        "@babel/runtime": "^7.18.0",
+        "@ctrl/tinycolor": "^3.4.0",
+        "dayjs": "^1.11.10",
+        "rc-util": "^5.0.1",
+        "swr": "^2.0.0"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-utils": {
+      "version": "2.18.0",
+      "resolved": "https://registry.npmjs.org/@ant-design/pro-utils/-/pro-utils-2.18.0.tgz",
+      "integrity": "sha512-8+ikyrN8L8a8Ph4oeHTOJEiranTj18+9+WHCHjKNdEfukI7Rjn8xpYdLJWb2AUJkb9d4eoAqjd5+k+7w81Df0w==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/icons": "^5.0.0",
+        "@ant-design/pro-provider": "2.16.2",
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "dayjs": "^1.11.10",
+        "lodash": "^4.17.21",
+        "lodash-es": "^4.17.21",
+        "rc-util": "^5.0.6",
+        "safe-stable-stringify": "^2.4.3",
+        "swr": "^2.0.0"
+      },
+      "peerDependencies": {
+        "antd": "^4.24.15 || ^5.11.2",
+        "react": ">=17.0.0",
+        "react-dom": ">=17.0.0"
+      }
+    },
+    "node_modules/@ant-design/pro-utils/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@ant-design/react-slick": {
+      "version": "1.1.2",
+      "resolved": "https://registry.npmjs.org/@ant-design/react-slick/-/react-slick-1.1.2.tgz",
+      "integrity": "sha512-EzlvzE6xQUBrZuuhSAFTdsr4P2bBBHGZwKFemEfq8gIGyIQCxalYfZW/T2ORbtQx5rU69o+WycP3exY/7T1hGA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.4",
+        "classnames": "^2.2.5",
+        "json2mq": "^0.2.0",
+        "resize-observer-polyfill": "^1.5.1",
+        "throttle-debounce": "^5.0.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0"
+      }
+    },
     "node_modules/@asamuzakjp/css-color": {
       "version": "3.2.0",
       "resolved": "https://registry.npmjs.org/@asamuzakjp/css-color/-/css-color-3.2.0.tgz",
@@ -770,6 +972,15 @@
         "node": ">=18"
       }
     },
+    "node_modules/@ctrl/tinycolor": {
+      "version": "3.6.1",
+      "resolved": "https://registry.npmjs.org/@ctrl/tinycolor/-/tinycolor-3.6.1.tgz",
+      "integrity": "sha512-SITSV6aIXsuVNV3f3O0f2n/cgyEDWoSqtZMYiAmcsYHydcKrOz3gUxB/iXd/Qf08+IZX4KpgNbvUdMBmWz+kcA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=10"
+      }
+    },
     "node_modules/@emnapi/runtime": {
       "version": "1.4.3",
       "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.4.3.tgz",
@@ -3974,6 +4185,214 @@
       "integrity": "sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==",
       "license": "BSD-3-Clause"
     },
+    "node_modules/@rc-component/async-validator": {
+      "version": "5.0.4",
+      "resolved": "https://registry.npmjs.org/@rc-component/async-validator/-/async-validator-5.0.4.tgz",
+      "integrity": "sha512-qgGdcVIF604M9EqjNF0hbUTz42bz/RDtxWdWuU5EQe3hi7M8ob54B6B35rOsvX5eSvIHIzT9iH1R3n+hk3CGfg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.4"
+      },
+      "engines": {
+        "node": ">=14.x"
+      }
+    },
+    "node_modules/@rc-component/color-picker": {
+      "version": "2.0.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/color-picker/-/color-picker-2.0.1.tgz",
+      "integrity": "sha512-WcZYwAThV/b2GISQ8F+7650r5ZZJ043E57aVBFkQ+kSY4C6wdofXgB0hBx+GPGpIU0Z81eETNoDUJMr7oy/P8Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/fast-color": "^2.0.6",
+        "@babel/runtime": "^7.23.6",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.38.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/context": {
+      "version": "1.4.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/context/-/context-1.4.0.tgz",
+      "integrity": "sha512-kFcNxg9oLRMoL3qki0OMxK+7g5mypjgaaJp/pkOis/6rVxma9nJBF/8kCIuTYHUQNr0ii7MxqE33wirPZLJQ2w==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/mini-decimal": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/mini-decimal/-/mini-decimal-1.1.0.tgz",
+      "integrity": "sha512-jS4E7T9Li2GuYwI6PyiVXmxTiM6b07rlD9Ge8uGZSCz3WlzcG5ZK7g5bbuKNeZ9pgUuPK/5guV781ujdVpm4HQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      }
+    },
+    "node_modules/@rc-component/mutate-observer": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/mutate-observer/-/mutate-observer-1.1.0.tgz",
+      "integrity": "sha512-QjrOsDXQusNwGZPf4/qRQasg7UFEj06XiCJ8iuiq/Io7CrHrgVi6Uuetw60WAMG1799v+aM8kyc+1L/GBbHSlw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/mutate-observer/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/portal": {
+      "version": "1.1.2",
+      "resolved": "https://registry.npmjs.org/@rc-component/portal/-/portal-1.1.2.tgz",
+      "integrity": "sha512-6f813C0IsasTZms08kfA8kPAGxbbkYToa8ALaiDIGGECU4i9hj8Plgbx0sNJDrey3EtHO30hmdaxtT0138xZcg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/portal/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/qrcode": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/qrcode/-/qrcode-1.0.1.tgz",
+      "integrity": "sha512-g8eeeaMyFXVlq8cZUeaxCDhfIYjpao0l9cvm5gFwKXy/Vm1yDWV7h2sjH5jHYzdFedlVKBpATFB1VKMrHzwaWQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7",
+        "classnames": "^2.3.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/qrcode/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/tour": {
+      "version": "1.15.1",
+      "resolved": "https://registry.npmjs.org/@rc-component/tour/-/tour-1.15.1.tgz",
+      "integrity": "sha512-Tr2t7J1DKZUpfJuDZWHxyxWpfmj8EZrqSgyMZ+BCdvKZ6r1UDsfU46M/iWAAFBy961Ssfom2kv5f3UcjIL2CmQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "@rc-component/portal": "^1.0.0-9",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.24.4"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/tour/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@rc-component/trigger": {
+      "version": "2.3.0",
+      "resolved": "https://registry.npmjs.org/@rc-component/trigger/-/trigger-2.3.0.tgz",
+      "integrity": "sha512-iwaxZyzOuK0D7lS+0AQEtW52zUWxoGqTGkke3dRyb8pYiShmRpCjB/8TzPI4R6YySCH7Vm9BZj/31VPiiQTLBg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.23.2",
+        "@rc-component/portal": "^1.1.0",
+        "classnames": "^2.3.2",
+        "rc-motion": "^2.0.0",
+        "rc-resize-observer": "^1.3.1",
+        "rc-util": "^5.44.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/@rc-component/trigger/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/@refinedev/antd": {
+      "version": "6.0.2",
+      "resolved": "https://registry.npmjs.org/@refinedev/antd/-/antd-6.0.2.tgz",
+      "integrity": "sha512-Z9UocvTrKG9+9wWArdBk3t0FTXuvQxhg7BukkjnBchIcV8zrYvDPGTjszpFN0xl1TXpZKoHY2psuITLdY7QmhA==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/icons": "^5.5.1",
+        "@ant-design/pro-layout": "^7.21.1",
+        "@refinedev/ui-types": "^2.0.0",
+        "@tanstack/react-query": "^5.81.5",
+        "antd": "^5.23.0",
+        "dayjs": "^1.10.7",
+        "react-markdown": "^6.0.1",
+        "remark-gfm": "^1.0.0",
+        "sunflower-antd": "1.0.0-beta.3",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=20"
+      },
+      "peerDependencies": {
+        "@refinedev/core": "^5.0.0",
+        "@types/react": "^18.0.0 || ^19.0.0",
+        "@types/react-dom": "^18.0.0 || ^19.0.0",
+        "antd": "^5.23.0",
+        "dayjs": "^1.10.7",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/@refinedev/core": {
       "version": "5.0.4",
       "resolved": "https://registry.npmjs.org/@refinedev/core/-/core-5.0.4.tgz",
@@ -4061,6 +4480,25 @@
         "react-dom": "^18.0.0 || ^19.0.0"
       }
     },
+    "node_modules/@refinedev/ui-types": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/@refinedev/ui-types/-/ui-types-2.0.0.tgz",
+      "integrity": "sha512-ymkx/dn2pJtB1PQiGVXdC5CfmEM1hjd5Vj0JEqzYRAVRcDnv37kDViBHnO7h2Lydw7FDZAglCkt9kRMEbad6xA==",
+      "license": "MIT",
+      "dependencies": {
+        "@refinedev/core": "^5.0.0",
+        "dayjs": "^1.10.7",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=20"
+      },
+      "peerDependencies": {
+        "@refinedev/core": "^5.0.0",
+        "react": "^18.0.0 || ^19.0.0",
+        "react-dom": "^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/@sinclair/typebox": {
       "version": "0.27.8",
       "resolved": "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.27.8.tgz",
@@ -4387,6 +4825,15 @@
         "@types/node": "*"
       }
     },
+    "node_modules/@types/hast": {
+      "version": "2.3.10",
+      "resolved": "https://registry.npmjs.org/@types/hast/-/hast-2.3.10.tgz",
+      "integrity": "sha512-McWspRw8xx8J9HurkVBfYj0xKoE25tOFlHGdx4MJ5xORQrMGZNqJhVQWaIbm6Oyla5kYOXtDiopzKRJzEOkwJw==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2"
+      }
+    },
     "node_modules/@types/http-errors": {
       "version": "2.0.5",
       "resolved": "https://registry.npmjs.org/@types/http-errors/-/http-errors-2.0.5.tgz",
@@ -4680,6 +5127,23 @@
       "license": "MIT",
       "optional": true
     },
+    "node_modules/@types/lodash": {
+      "version": "4.17.20",
+      "resolved": "https://registry.npmjs.org/@types/lodash/-/lodash-4.17.20.tgz",
+      "integrity": "sha512-H3MHACvFUEiujabxhaI/ImO6gUrd8oOurg7LQtS7mbwIXA/cUqWrvBsaeJ23aZEPk1TAYkurjfMbSELfoCXlGA==",
+      "dev": true,
+      "license": "MIT"
+    },
+    "node_modules/@types/lodash.debounce": {
+      "version": "4.0.9",
+      "resolved": "https://registry.npmjs.org/@types/lodash.debounce/-/lodash.debounce-4.0.9.tgz",
+      "integrity": "sha512-Ma5JcgTREwpLRwMM+XwBR7DaWe96nC38uCBDFKZWbNKD+osjVzdpnUSwBcqCptrp16sSOLBAUb50Car5I0TCsQ==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "@types/lodash": "*"
+      }
+    },
     "node_modules/@types/long": {
       "version": "4.0.2",
       "resolved": "https://registry.npmjs.org/@types/long/-/long-4.0.2.tgz",
@@ -4697,6 +5161,15 @@
         "@types/mdurl": "^2"
       }
     },
+    "node_modules/@types/mdast": {
+      "version": "3.0.15",
+      "resolved": "https://registry.npmjs.org/@types/mdast/-/mdast-3.0.15.tgz",
+      "integrity": "sha512-LnwD+mUEfxWMa1QpDraczIn6k0Ee3SMicuYSSzS6ZYl2gKS09EClnJYGd8Du6rfc5r/GZEk5o1mRb8TaTj03sQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2"
+      }
+    },
     "node_modules/@types/mdurl": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/@types/mdurl/-/mdurl-2.0.0.tgz",
@@ -4857,6 +5330,12 @@
       "integrity": "sha512-/Ad8+nIOV7Rl++6f1BdKxFSMgmoqEoYbHRpPcx3JEfv8VRsQe9Z4mCXeJBzxs7mbHY/XOZZuXlRNfhpVPbs6ZA==",
       "license": "MIT"
     },
+    "node_modules/@types/unist": {
+      "version": "2.0.11",
+      "resolved": "https://registry.npmjs.org/@types/unist/-/unist-2.0.11.tgz",
+      "integrity": "sha512-CmBKiL6NNo/OqgmMn95Fk9Whlp2mtvIv+KNpQKN2F4SjvrEesubTRWGYSg+BnWZOnlCaSTU1sMpsBOzgbYhnsA==",
+      "license": "MIT"
+    },
     "node_modules/@types/yargs": {
       "version": "17.0.33",
       "resolved": "https://registry.npmjs.org/@types/yargs/-/yargs-17.0.33.tgz",
@@ -5119,6 +5598,21 @@
         "url": "https://opencollective.com/eslint"
       }
     },
+    "node_modules/@umijs/route-utils": {
+      "version": "4.0.1",
+      "resolved": "https://registry.npmjs.org/@umijs/route-utils/-/route-utils-4.0.1.tgz",
+      "integrity": "sha512-+1ixf1BTOLuH+ORb4x8vYMPeIt38n9q0fJDwhv9nSxrV46mxbLF0nmELIo9CKQB2gHfuC4+hww6xejJ6VYnBHQ==",
+      "license": "MIT"
+    },
+    "node_modules/@umijs/use-params": {
+      "version": "1.0.9",
+      "resolved": "https://registry.npmjs.org/@umijs/use-params/-/use-params-1.0.9.tgz",
+      "integrity": "sha512-QlN0RJSBVQBwLRNxbxjQ5qzqYIGn+K7USppMoIOVlf7fxXHsnQZ2bEsa6Pm74bt6DVQxpUE8HqvdStn6Y9FV1w==",
+      "license": "MIT",
+      "peerDependencies": {
+        "react": "*"
+      }
+    },
     "node_modules/@ungap/structured-clone": {
       "version": "1.3.0",
       "resolved": "https://registry.npmjs.org/@ungap/structured-clone/-/structured-clone-1.3.0.tgz",
@@ -5240,6 +5734,77 @@
         "url": "https://github.com/chalk/ansi-styles?sponsor=1"
       }
     },
+    "node_modules/antd": {
+      "version": "5.27.4",
+      "resolved": "https://registry.npmjs.org/antd/-/antd-5.27.4.tgz",
+      "integrity": "sha512-rhArohoAUCxhkPjGI/BXthOrrjaElL4Fb7d4vEHnIR3DpxFXfegd4rN21IgGdiF+Iz4EFuUZu8MdS8NuJHLSVQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@ant-design/colors": "^7.2.1",
+        "@ant-design/cssinjs": "^1.23.0",
+        "@ant-design/cssinjs-utils": "^1.1.3",
+        "@ant-design/fast-color": "^2.0.6",
+        "@ant-design/icons": "^5.6.1",
+        "@ant-design/react-slick": "~1.1.2",
+        "@babel/runtime": "^7.26.0",
+        "@rc-component/color-picker": "~2.0.1",
+        "@rc-component/mutate-observer": "^1.1.0",
+        "@rc-component/qrcode": "~1.0.0",
+        "@rc-component/tour": "~1.15.1",
+        "@rc-component/trigger": "^2.3.0",
+        "classnames": "^2.5.1",
+        "copy-to-clipboard": "^3.3.3",
+        "dayjs": "^1.11.11",
+        "rc-cascader": "~3.34.0",
+        "rc-checkbox": "~3.5.0",
+        "rc-collapse": "~3.9.0",
+        "rc-dialog": "~9.6.0",
+        "rc-drawer": "~7.3.0",
+        "rc-dropdown": "~4.2.1",
+        "rc-field-form": "~2.7.0",
+        "rc-image": "~7.12.0",
+        "rc-input": "~1.8.0",
+        "rc-input-number": "~9.5.0",
+        "rc-mentions": "~2.20.0",
+        "rc-menu": "~9.16.1",
+        "rc-motion": "^2.9.5",
+        "rc-notification": "~5.6.4",
+        "rc-pagination": "~5.1.0",
+        "rc-picker": "~4.11.3",
+        "rc-progress": "~4.0.0",
+        "rc-rate": "~2.13.1",
+        "rc-resize-observer": "^1.4.3",
+        "rc-segmented": "~2.7.0",
+        "rc-select": "~14.16.8",
+        "rc-slider": "~11.1.9",
+        "rc-steps": "~6.0.1",
+        "rc-switch": "~4.1.0",
+        "rc-table": "~7.53.0",
+        "rc-tabs": "~15.7.0",
+        "rc-textarea": "~1.10.2",
+        "rc-tooltip": "~6.4.0",
+        "rc-tree": "~5.13.1",
+        "rc-tree-select": "~5.27.0",
+        "rc-upload": "~4.9.2",
+        "rc-util": "^5.44.4",
+        "scroll-into-view-if-needed": "^3.1.0",
+        "throttle-debounce": "^5.0.2"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/ant-design"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/antd/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
     "node_modules/anymatch": {
       "version": "3.1.3",
       "resolved": "https://registry.npmjs.org/anymatch/-/anymatch-3.1.3.tgz",
@@ -5607,6 +6172,16 @@
         "@babel/core": "^7.0.0"
       }
     },
+    "node_modules/bail": {
+      "version": "1.0.5",
+      "resolved": "https://registry.npmjs.org/bail/-/bail-1.0.5.tgz",
+      "integrity": "sha512-xFbRxM1tahm08yHBP16MMjVUAvDaBMD38zsM9EMAUN61omwLmKlOpB/Zku5QkjZ8TZ4vn53pj+t518cH0S03RQ==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/balanced-match": {
       "version": "1.0.2",
       "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-1.0.2.tgz",
@@ -5862,10 +6437,20 @@
         "node": ">= 10"
       }
     },
-    "node_modules/chalk": {
-      "version": "4.1.2",
-      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
-      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
+    "node_modules/ccount": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/ccount/-/ccount-1.1.0.tgz",
+      "integrity": "sha512-vlNK021QdI7PNeiUh/lKkC/mNHHfV0m/Ad5JoI0TYtlBnJAslM/JIkm/tGC88bkLIwO6OQ5uV6ztS6kVAtCDlg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/chalk": {
+      "version": "4.1.2",
+      "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
+      "integrity": "sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==",
       "devOptional": true,
       "license": "MIT",
       "dependencies": {
@@ -5889,6 +6474,36 @@
         "node": ">=10"
       }
     },
+    "node_modules/character-entities": {
+      "version": "1.2.4",
+      "resolved": "https://registry.npmjs.org/character-entities/-/character-entities-1.2.4.tgz",
+      "integrity": "sha512-iBMyeEHxfVnIakwOuDXpVkc54HijNgCyQB2w0VfGQThle6NXn50zU6V/u+LDhxHcDUPojn6Kpga3PTAD8W1bQw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/character-entities-legacy": {
+      "version": "1.1.4",
+      "resolved": "https://registry.npmjs.org/character-entities-legacy/-/character-entities-legacy-1.1.4.tgz",
+      "integrity": "sha512-3Xnr+7ZFS1uxeiUDvV02wQ+QDbc55o97tIV5zHScSPJpcLm/r0DFPcoY3tYRp+VZukxuMeKgXYmsXQHO05zQeA==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/character-reference-invalid": {
+      "version": "1.1.4",
+      "resolved": "https://registry.npmjs.org/character-reference-invalid/-/character-reference-invalid-1.1.4.tgz",
+      "integrity": "sha512-mKKUkUbhPpQlCOfIuZkvSEgktjPFIsZKRRbC6KWVEMvlzblj3i3asQv5ODsrwt0N3pHAEvjP8KTQPHkp0+6jOg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/ci-info": {
       "version": "3.9.0",
       "resolved": "https://registry.npmjs.org/ci-info/-/ci-info-3.9.0.tgz",
@@ -6020,6 +6635,16 @@
         "node": ">= 0.8"
       }
     },
+    "node_modules/comma-separated-tokens": {
+      "version": "1.0.8",
+      "resolved": "https://registry.npmjs.org/comma-separated-tokens/-/comma-separated-tokens-1.0.8.tgz",
+      "integrity": "sha512-GHuDRO12Sypu2cV70d1dkA2EUmXHgntrzbpvOB+Qy+49ypNfGgFQIC2fhhXbnyrJRynDCAARsT7Ou0M6hirpfw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/compressible": {
       "version": "2.0.18",
       "resolved": "https://registry.npmjs.org/compressible/-/compressible-2.0.18.tgz",
@@ -6033,6 +6658,12 @@
         "node": ">= 0.6"
       }
     },
+    "node_modules/compute-scroll-into-view": {
+      "version": "3.1.1",
+      "resolved": "https://registry.npmjs.org/compute-scroll-into-view/-/compute-scroll-into-view-3.1.1.tgz",
+      "integrity": "sha512-VRhuHOLoKYOy4UbilLbUzbYg93XLjv2PncJC50EuTWPA3gaja1UjBsUP/D/9/juV3vQFr6XBEzn9KCAHdUvOHw==",
+      "license": "MIT"
+    },
     "node_modules/concat-map": {
       "version": "0.0.1",
       "resolved": "https://registry.npmjs.org/concat-map/-/concat-map-0.0.1.tgz",
@@ -6055,6 +6686,15 @@
         "node": ">= 0.6"
       }
     },
+    "node_modules/copy-to-clipboard": {
+      "version": "3.3.3",
+      "resolved": "https://registry.npmjs.org/copy-to-clipboard/-/copy-to-clipboard-3.3.3.tgz",
+      "integrity": "sha512-2KV8NhB5JqC3ky0r9PMCAZKbUHSwtEo4CwCs0KXgruG43gX5PMqDEBbVU4OUzw2MuAWUfsuFmWvEKG5QRfSnJA==",
+      "license": "MIT",
+      "dependencies": {
+        "toggle-selection": "^1.0.6"
+      }
+    },
     "node_modules/cosmiconfig": {
       "version": "7.1.0",
       "resolved": "https://registry.npmjs.org/cosmiconfig/-/cosmiconfig-7.1.0.tgz",
@@ -6331,7 +6971,6 @@
       "version": "2.0.3",
       "resolved": "https://registry.npmjs.org/dequal/-/dequal-2.0.3.tgz",
       "integrity": "sha512-0je+qPKHEMohvfRTCEo3CrPG6cAzAYgmzKyxRiYSSDkS6eGJdyVJm7WaYA5ECaAD9wLB2T4EEeymA5aFVcYXCA==",
-      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6"
@@ -8403,6 +9042,12 @@
       "integrity": "sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==",
       "license": "ISC"
     },
+    "node_modules/inline-style-parser": {
+      "version": "0.1.1",
+      "resolved": "https://registry.npmjs.org/inline-style-parser/-/inline-style-parser-0.1.1.tgz",
+      "integrity": "sha512-7NXolsK4CAS5+xvdj5OMMbI962hU/wvwoxk+LWR9Ek9bVtyuuYScDN6eS0rUm6TxApFpw7CX1o4uJzcd4AyD3Q==",
+      "license": "MIT"
+    },
     "node_modules/internal-slot": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/internal-slot/-/internal-slot-1.1.0.tgz",
@@ -8418,6 +9063,30 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/is-alphabetical": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-alphabetical/-/is-alphabetical-1.0.4.tgz",
+      "integrity": "sha512-DwzsA04LQ10FHTZuL0/grVDk4rFoVH1pjAToYwBrHSxcrBIGQuXrQMtD5U1b0U2XVgKZCTLLP8u2Qxqhy3l2Vg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
+    "node_modules/is-alphanumerical": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-alphanumerical/-/is-alphanumerical-1.0.4.tgz",
+      "integrity": "sha512-UzoZUr+XfVz3t3v4KyGEniVL9BDRoQtY7tOyrRybkVNjDFWyo1yhXNGrrBTQxp3ib9BLAWs7k2YKBQsFRkZG9A==",
+      "license": "MIT",
+      "dependencies": {
+        "is-alphabetical": "^1.0.0",
+        "is-decimal": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-array-buffer": {
       "version": "3.0.5",
       "resolved": "https://registry.npmjs.org/is-array-buffer/-/is-array-buffer-3.0.5.tgz",
@@ -8495,6 +9164,29 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/is-buffer": {
+      "version": "2.0.5",
+      "resolved": "https://registry.npmjs.org/is-buffer/-/is-buffer-2.0.5.tgz",
+      "integrity": "sha512-i2R6zNFDwgEHJyQUtJEk0XFi1i0dPFn/oqjK3/vPCcDeJvW5NQ83V8QbicfF1SupOaB0h8ntgBC2YiE7dfyctQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/feross"
+        },
+        {
+          "type": "patreon",
+          "url": "https://www.patreon.com/feross"
+        },
+        {
+          "type": "consulting",
+          "url": "https://feross.org/support"
+        }
+      ],
+      "license": "MIT",
+      "engines": {
+        "node": ">=4"
+      }
+    },
     "node_modules/is-callable": {
       "version": "1.2.7",
       "resolved": "https://registry.npmjs.org/is-callable/-/is-callable-1.2.7.tgz",
@@ -8558,6 +9250,16 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/is-decimal": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-decimal/-/is-decimal-1.0.4.tgz",
+      "integrity": "sha512-RGdriMmQQvZ2aqaQq3awNA6dCGtKpiDFcOzrTWrDAT2MiWrKQVPmxLGHl7Y2nNu6led0kEyoX0enY0qXYsv9zw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-extglob": {
       "version": "2.1.1",
       "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
@@ -8635,6 +9337,16 @@
         "node": ">=0.10.0"
       }
     },
+    "node_modules/is-hexadecimal": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/is-hexadecimal/-/is-hexadecimal-1.0.4.tgz",
+      "integrity": "sha512-gyPJuv83bHMpocVYoqof5VDiZveEoGoFL8m3BXNb2VW8Xs+rz9kqO8LOQ5DH6EsuvilT1ApazU0pyl+ytbPtlw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/is-map": {
       "version": "2.0.3",
       "resolved": "https://registry.npmjs.org/is-map/-/is-map-2.0.3.tgz",
@@ -8685,6 +9397,15 @@
         "node": ">=8"
       }
     },
+    "node_modules/is-plain-obj": {
+      "version": "2.1.0",
+      "resolved": "https://registry.npmjs.org/is-plain-obj/-/is-plain-obj-2.1.0.tgz",
+      "integrity": "sha512-YWnfyRwxL/+SsrWYfOpUtz5b3YD+nyfkHvjbcanzk8zgyO4ASD67uVMRt8k5bM4lLMDnXfriRhOpemw+NfT1eA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/is-potential-custom-element-name": {
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/is-potential-custom-element-name/-/is-potential-custom-element-name-1.0.1.tgz",
@@ -10273,6 +10994,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/json2mq": {
+      "version": "0.2.0",
+      "resolved": "https://registry.npmjs.org/json2mq/-/json2mq-0.2.0.tgz",
+      "integrity": "sha512-SzoRg7ux5DWTII9J2qkrZrqV1gt+rTaoufMxEzXbS26Uid0NwaJd123HcoB80TgubEppxxIGdNxCx50fEoEWQA==",
+      "license": "MIT",
+      "dependencies": {
+        "string-convert": "^0.2.0"
+      }
+    },
     "node_modules/json5": {
       "version": "2.2.3",
       "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
@@ -10507,6 +11237,12 @@
       "integrity": "sha512-H5ZhCF25riFd9uB5UCkVKo61m3S/xZk1x4wA6yp/L3RFP6Z/eHH1ymQcGLo7J3GMPfm0V/7m1tryHuGVxpqEBQ==",
       "license": "MIT"
     },
+    "node_modules/lodash.debounce": {
+      "version": "4.0.8",
+      "resolved": "https://registry.npmjs.org/lodash.debounce/-/lodash.debounce-4.0.8.tgz",
+      "integrity": "sha512-FT1yDzDYEoYWhnSGnpE/4Kj1fLZkDFyqRb7fNt6FdYOSxlUWAtp42Eh6Wb0rGIv/m9Bgo7x4GhQbm5Ys4SG5ow==",
+      "license": "MIT"
+    },
     "node_modules/lodash.includes": {
       "version": "4.3.0",
       "resolved": "https://registry.npmjs.org/lodash.includes/-/lodash.includes-4.3.0.tgz",
@@ -10569,6 +11305,16 @@
       "integrity": "sha512-ka87Jz3gcx/I7Hal94xaN2tZEOPoUOEVftkQqZx2EeQRN7LGdfLlI3FvZ+7WDplm+vK2Urx9ULrvSowtdCieng==",
       "license": "Apache-2.0"
     },
+    "node_modules/longest-streak": {
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/longest-streak/-/longest-streak-2.0.4.tgz",
+      "integrity": "sha512-vM6rUVCVUJJt33bnmHiZEvr7wPT78ztX7rojL+LW51bHtLh6HTjx84LA5W4+oa6aKEJA7jJu5LR6vQRBpA5DVg==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/loose-envify": {
       "version": "1.4.0",
       "resolved": "https://registry.npmjs.org/loose-envify/-/loose-envify-1.4.0.tgz",
@@ -10705,6 +11451,19 @@
         "url": "https://github.com/fb55/entities?sponsor=1"
       }
     },
+    "node_modules/markdown-table": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/markdown-table/-/markdown-table-2.0.0.tgz",
+      "integrity": "sha512-Ezda85ToJUBhM6WGaG6veasyym+Tbs3cMAw/ZhOPqXiYsr0jgocBV3j3nx+4lk47plLlIqjwuTm/ywVI+zjJ/A==",
+      "license": "MIT",
+      "dependencies": {
+        "repeat-string": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/marked": {
       "version": "4.3.0",
       "resolved": "https://registry.npmjs.org/marked/-/marked-4.3.0.tgz",
@@ -10727,6 +11486,177 @@
         "node": ">= 0.4"
       }
     },
+    "node_modules/mdast-util-definitions": {
+      "version": "4.0.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-definitions/-/mdast-util-definitions-4.0.0.tgz",
+      "integrity": "sha512-k8AJ6aNnUkB7IE+5azR9h81O5EQ/cTDXtWdMq9Kk5KcEW/8ritU5CeLg/9HhOC++nALHBlaogJ5jz0Ybk3kPMQ==",
+      "license": "MIT",
+      "dependencies": {
+        "unist-util-visit": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-find-and-replace": {
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/mdast-util-find-and-replace/-/mdast-util-find-and-replace-1.1.1.tgz",
+      "integrity": "sha512-9cKl33Y21lyckGzpSmEQnIDjEfeeWelN5s1kUW1LwdB0Fkuq2u+4GdqcGEygYxJE8GVqCl0741bYXHgamfWAZA==",
+      "license": "MIT",
+      "dependencies": {
+        "escape-string-regexp": "^4.0.0",
+        "unist-util-is": "^4.0.0",
+        "unist-util-visit-parents": "^3.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-from-markdown": {
+      "version": "0.8.5",
+      "resolved": "https://registry.npmjs.org/mdast-util-from-markdown/-/mdast-util-from-markdown-0.8.5.tgz",
+      "integrity": "sha512-2hkTXtYYnr+NubD/g6KGBS/0mFmBcifAsI0yIWRiRo0PjVs6SSOSOdtzbp6kSGnShDN6G5aWZpKQ2lWRy27mWQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/mdast": "^3.0.0",
+        "mdast-util-to-string": "^2.0.0",
+        "micromark": "~2.11.0",
+        "parse-entities": "^2.0.0",
+        "unist-util-stringify-position": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm": {
+      "version": "0.1.2",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm/-/mdast-util-gfm-0.1.2.tgz",
+      "integrity": "sha512-NNkhDx/qYcuOWB7xHUGWZYVXvjPFFd6afg6/e2g+SV4r9q5XUcCbV4Wfa3DLYIiD+xAEZc6K4MGaE/m0KDcPwQ==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-gfm-autolink-literal": "^0.1.0",
+        "mdast-util-gfm-strikethrough": "^0.2.0",
+        "mdast-util-gfm-table": "^0.1.0",
+        "mdast-util-gfm-task-list-item": "^0.1.0",
+        "mdast-util-to-markdown": "^0.6.1"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-autolink-literal": {
+      "version": "0.1.3",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-autolink-literal/-/mdast-util-gfm-autolink-literal-0.1.3.tgz",
+      "integrity": "sha512-GjmLjWrXg1wqMIO9+ZsRik/s7PLwTaeCHVB7vRxUwLntZc8mzmTsLVr6HW1yLokcnhfURsn5zmSVdi3/xWWu1A==",
+      "license": "MIT",
+      "dependencies": {
+        "ccount": "^1.0.0",
+        "mdast-util-find-and-replace": "^1.1.0",
+        "micromark": "^2.11.3"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-strikethrough": {
+      "version": "0.2.3",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-strikethrough/-/mdast-util-gfm-strikethrough-0.2.3.tgz",
+      "integrity": "sha512-5OQLXpt6qdbttcDG/UxYY7Yjj3e8P7X16LzvpX8pIQPYJ/C2Z1qFGMmcw+1PZMUM3Z8wt8NRfYTvCni93mgsgA==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-to-markdown": "^0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-table": {
+      "version": "0.1.6",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-table/-/mdast-util-gfm-table-0.1.6.tgz",
+      "integrity": "sha512-j4yDxQ66AJSBwGkbpFEp9uG/LS1tZV3P33fN1gkyRB2LoRL+RR3f76m0HPHaby6F4Z5xr9Fv1URmATlRRUIpRQ==",
+      "license": "MIT",
+      "dependencies": {
+        "markdown-table": "^2.0.0",
+        "mdast-util-to-markdown": "~0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-gfm-task-list-item": {
+      "version": "0.1.6",
+      "resolved": "https://registry.npmjs.org/mdast-util-gfm-task-list-item/-/mdast-util-gfm-task-list-item-0.1.6.tgz",
+      "integrity": "sha512-/d51FFIfPsSmCIRNp7E6pozM9z1GYPIkSy1urQ8s/o4TC22BZ7DqfHFWiqBD23bc7J3vV1Fc9O4QIHBlfuit8A==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-to-markdown": "~0.6.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-hast": {
+      "version": "10.2.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-hast/-/mdast-util-to-hast-10.2.0.tgz",
+      "integrity": "sha512-JoPBfJ3gBnHZ18icCwHR50orC9kNH81tiR1gs01D8Q5YpV6adHNO9nKNuFBCJQ941/32PT1a63UF/DitmS3amQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/mdast": "^3.0.0",
+        "@types/unist": "^2.0.0",
+        "mdast-util-definitions": "^4.0.0",
+        "mdurl": "^1.0.0",
+        "unist-builder": "^2.0.0",
+        "unist-util-generated": "^1.0.0",
+        "unist-util-position": "^3.0.0",
+        "unist-util-visit": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-hast/node_modules/mdurl": {
+      "version": "1.0.1",
+      "resolved": "https://registry.npmjs.org/mdurl/-/mdurl-1.0.1.tgz",
+      "integrity": "sha512-/sKlQJCBYVY9Ers9hqzKou4H6V5UWc/M59TH2dvkt+84itfnq7uFOMLpOiOS4ujvHP4etln18fmIxA5R5fll0g==",
+      "license": "MIT"
+    },
+    "node_modules/mdast-util-to-markdown": {
+      "version": "0.6.5",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-markdown/-/mdast-util-to-markdown-0.6.5.tgz",
+      "integrity": "sha512-XeV9sDE7ZlOQvs45C9UKMtfTcctcaj/pGwH8YLbMHoMOXNNCn2LsqVQOqrF1+/NU8lKDAqozme9SCXWyo9oAcQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "longest-streak": "^2.0.0",
+        "mdast-util-to-string": "^2.0.0",
+        "parse-entities": "^2.0.0",
+        "repeat-string": "^1.0.0",
+        "zwitch": "^1.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/mdast-util-to-string": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/mdast-util-to-string/-/mdast-util-to-string-2.0.0.tgz",
+      "integrity": "sha512-AW4DRS3QbBayY/jJmD8437V1Gombjf8RSOUCMFBuo5iHi58AGEgVCKQ+ezHkZZDpAQS75hcBMpLqjpJTjtUL7w==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
     "node_modules/mdurl": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/mdurl/-/mdurl-2.0.0.tgz",
@@ -10751,52 +11681,152 @@
         "node": ">= 8"
       }
     },
-    "node_modules/micromatch": {
-      "version": "4.0.8",
-      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
-      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
-      "dev": true,
+    "node_modules/micromark": {
+      "version": "2.11.4",
+      "resolved": "https://registry.npmjs.org/micromark/-/micromark-2.11.4.tgz",
+      "integrity": "sha512-+WoovN/ppKolQOFIAajxi7Lu9kInbPxFuTBVEavFcL8eAfVstoc5MocPmqBeAdBOJV00uaVjegzH4+MA0DN/uA==",
+      "funding": [
+        {
+          "type": "GitHub Sponsors",
+          "url": "https://github.com/sponsors/unifiedjs"
+        },
+        {
+          "type": "OpenCollective",
+          "url": "https://opencollective.com/unified"
+        }
+      ],
       "license": "MIT",
       "dependencies": {
-        "braces": "^3.0.3",
-        "picomatch": "^2.3.1"
-      },
-      "engines": {
-        "node": ">=8.6"
+        "debug": "^4.0.0",
+        "parse-entities": "^2.0.0"
       }
     },
-    "node_modules/mime": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/mime/-/mime-3.0.0.tgz",
-      "integrity": "sha512-jSCU7/VB1loIWBZe14aEYHU/+1UMEHoaO7qxCOVJOw9GgH72VAWppxNcjU+x9a2k3GSIBXNKxXQFqRvvZ7vr3A==",
+    "node_modules/micromark-extension-gfm": {
+      "version": "0.3.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm/-/micromark-extension-gfm-0.3.3.tgz",
+      "integrity": "sha512-oVN4zv5/tAIA+l3GbMi7lWeYpJ14oQyJ3uEim20ktYFAcfX1x3LNlFGGlmrZHt7u9YlKExmyJdDGaTt6cMSR/A==",
       "license": "MIT",
-      "optional": true,
-      "bin": {
-        "mime": "cli.js"
+      "dependencies": {
+        "micromark": "~2.11.0",
+        "micromark-extension-gfm-autolink-literal": "~0.5.0",
+        "micromark-extension-gfm-strikethrough": "~0.6.5",
+        "micromark-extension-gfm-table": "~0.4.0",
+        "micromark-extension-gfm-tagfilter": "~0.3.0",
+        "micromark-extension-gfm-task-list-item": "~0.3.0"
       },
-      "engines": {
-        "node": ">=10.0.0"
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
       }
     },
-    "node_modules/mime-db": {
-      "version": "1.52.0",
-      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
-      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
+    "node_modules/micromark-extension-gfm-autolink-literal": {
+      "version": "0.5.7",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-autolink-literal/-/micromark-extension-gfm-autolink-literal-0.5.7.tgz",
+      "integrity": "sha512-ePiDGH0/lhcngCe8FtH4ARFoxKTUelMp4L7Gg2pujYD5CSMb9PbblnyL+AAMud/SNMyusbS2XDSiPIRcQoNFAw==",
       "license": "MIT",
-      "engines": {
-        "node": ">= 0.6"
+      "dependencies": {
+        "micromark": "~2.11.3"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
       }
     },
-    "node_modules/mime-types": {
-      "version": "2.1.35",
-      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
-      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
+    "node_modules/micromark-extension-gfm-strikethrough": {
+      "version": "0.6.5",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-strikethrough/-/micromark-extension-gfm-strikethrough-0.6.5.tgz",
+      "integrity": "sha512-PpOKlgokpQRwUesRwWEp+fHjGGkZEejj83k9gU5iXCbDG+XBA92BqnRKYJdfqfkrRcZRgGuPuXb7DaK/DmxOhw==",
       "license": "MIT",
       "dependencies": {
-        "mime-db": "1.52.0"
+        "micromark": "~2.11.0"
       },
-      "engines": {
-        "node": ">= 0.6"
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-table": {
+      "version": "0.4.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-table/-/micromark-extension-gfm-table-0.4.3.tgz",
+      "integrity": "sha512-hVGvESPq0fk6ALWtomcwmgLvH8ZSVpcPjzi0AjPclB9FsVRgMtGZkUcpE0zgjOCFAznKepF4z3hX8z6e3HODdA==",
+      "license": "MIT",
+      "dependencies": {
+        "micromark": "~2.11.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-tagfilter": {
+      "version": "0.3.0",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-tagfilter/-/micromark-extension-gfm-tagfilter-0.3.0.tgz",
+      "integrity": "sha512-9GU0xBatryXifL//FJH+tAZ6i240xQuFrSL7mYi8f4oZSbc+NvXjkrHemeYP0+L4ZUT+Ptz3b95zhUZnMtoi/Q==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromark-extension-gfm-task-list-item": {
+      "version": "0.3.3",
+      "resolved": "https://registry.npmjs.org/micromark-extension-gfm-task-list-item/-/micromark-extension-gfm-task-list-item-0.3.3.tgz",
+      "integrity": "sha512-0zvM5iSLKrc/NQl84pZSjGo66aTGd57C1idmlWmE87lkMcXrTxg1uXa/nXomxJytoje9trP0NDLvw4bZ/Z/XCQ==",
+      "license": "MIT",
+      "dependencies": {
+        "micromark": "~2.11.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/micromatch": {
+      "version": "4.0.8",
+      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
+      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "braces": "^3.0.3",
+        "picomatch": "^2.3.1"
+      },
+      "engines": {
+        "node": ">=8.6"
+      }
+    },
+    "node_modules/mime": {
+      "version": "3.0.0",
+      "resolved": "https://registry.npmjs.org/mime/-/mime-3.0.0.tgz",
+      "integrity": "sha512-jSCU7/VB1loIWBZe14aEYHU/+1UMEHoaO7qxCOVJOw9GgH72VAWppxNcjU+x9a2k3GSIBXNKxXQFqRvvZ7vr3A==",
+      "license": "MIT",
+      "optional": true,
+      "bin": {
+        "mime": "cli.js"
+      },
+      "engines": {
+        "node": ">=10.0.0"
+      }
+    },
+    "node_modules/mime-db": {
+      "version": "1.52.0",
+      "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.52.0.tgz",
+      "integrity": "sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 0.6"
+      }
+    },
+    "node_modules/mime-types": {
+      "version": "2.1.35",
+      "resolved": "https://registry.npmjs.org/mime-types/-/mime-types-2.1.35.tgz",
+      "integrity": "sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==",
+      "license": "MIT",
+      "dependencies": {
+        "mime-db": "1.52.0"
+      },
+      "engines": {
+        "node": ">= 0.6"
       }
     },
     "node_modules/mimic-fn": {
@@ -11421,6 +12451,24 @@
         "node": ">=6"
       }
     },
+    "node_modules/parse-entities": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/parse-entities/-/parse-entities-2.0.0.tgz",
+      "integrity": "sha512-kkywGpCcRYhqQIchaWqZ875wzpS/bMKhz5HnN3p7wveJTkTtyAB/AlnS0f8DFSqYW1T82t6yEAkEcB+A1I3MbQ==",
+      "license": "MIT",
+      "dependencies": {
+        "character-entities": "^1.0.0",
+        "character-entities-legacy": "^1.0.0",
+        "character-reference-invalid": "^1.0.0",
+        "is-alphanumerical": "^1.0.0",
+        "is-decimal": "^1.0.0",
+        "is-hexadecimal": "^1.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/parse-json": {
       "version": "5.2.0",
       "resolved": "https://registry.npmjs.org/parse-json/-/parse-json-5.2.0.tgz",
@@ -11494,6 +12542,15 @@
       "integrity": "sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==",
       "license": "MIT"
     },
+    "node_modules/path-to-regexp": {
+      "version": "8.2.0",
+      "resolved": "https://registry.npmjs.org/path-to-regexp/-/path-to-regexp-8.2.0.tgz",
+      "integrity": "sha512-TdrF7fW9Rphjq4RjrW0Kp2AW0Ahwu9sRGTkS6bvDi0SCwZlEZYmcfDbEsTz8RVk0EHIS/Vd1bv3JhG+1xZuAyQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=16"
+      }
+    },
     "node_modules/path-type": {
       "version": "4.0.0",
       "resolved": "https://registry.npmjs.org/path-type/-/path-type-4.0.0.tgz",
@@ -11784,6 +12841,19 @@
       "integrity": "sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==",
       "license": "MIT"
     },
+    "node_modules/property-information": {
+      "version": "5.6.0",
+      "resolved": "https://registry.npmjs.org/property-information/-/property-information-5.6.0.tgz",
+      "integrity": "sha512-YUHSPk+A30YPv+0Qf8i9Mbfe/C0hdPXk1s1jPVToV8pk8BQtpw10ct89Eo7OWkutrwqvT0eicAxlOg3dOAu8JA==",
+      "license": "MIT",
+      "dependencies": {
+        "xtend": "^4.0.0"
+      },
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/proto3-json-serializer": {
       "version": "2.0.2",
       "resolved": "https://registry.npmjs.org/proto3-json-serializer/-/proto3-json-serializer-2.0.2.tgz",
@@ -11834,71 +12904,695 @@
       "resolved": "https://registry.npmjs.org/punycode.js/-/punycode.js-2.3.1.tgz",
       "integrity": "sha512-uxFIHU0YlHYhDQtV4R9J6a52SLx28BCjT+4ieh7IGbgwVJWO+km431c4yRlREUAsAmt/uMjQUyQHNEPf0M39CA==",
       "license": "MIT",
-      "engines": {
-        "node": ">=6"
+      "engines": {
+        "node": ">=6"
+      }
+    },
+    "node_modules/pure-rand": {
+      "version": "6.1.0",
+      "resolved": "https://registry.npmjs.org/pure-rand/-/pure-rand-6.1.0.tgz",
+      "integrity": "sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "individual",
+          "url": "https://github.com/sponsors/dubzzz"
+        },
+        {
+          "type": "opencollective",
+          "url": "https://opencollective.com/fast-check"
+        }
+      ],
+      "license": "MIT"
+    },
+    "node_modules/qs": {
+      "version": "6.14.0",
+      "resolved": "https://registry.npmjs.org/qs/-/qs-6.14.0.tgz",
+      "integrity": "sha512-YWWTjgABSKcvs/nWBi9PycY/JiPJqOD4JA6o9Sej2AtvSGarXxKC3OQSk4pAarbdQlKAh5D4FCQkJNkW+GAn3w==",
+      "license": "BSD-3-Clause",
+      "dependencies": {
+        "side-channel": "^1.1.0"
+      },
+      "engines": {
+        "node": ">=0.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/ljharb"
+      }
+    },
+    "node_modules/querystring-es3": {
+      "version": "0.2.1",
+      "resolved": "https://registry.npmjs.org/querystring-es3/-/querystring-es3-0.2.1.tgz",
+      "integrity": "sha512-773xhDQnZBMFobEiztv8LIl70ch5MSF/jUQVlhwFyBILqq96anmoctVIYz+ZRp0qbCKATTn6ev02M3r7Ga5vqA==",
+      "engines": {
+        "node": ">=0.4.x"
+      }
+    },
+    "node_modules/queue-microtask": {
+      "version": "1.2.3",
+      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
+      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/feross"
+        },
+        {
+          "type": "patreon",
+          "url": "https://www.patreon.com/feross"
+        },
+        {
+          "type": "consulting",
+          "url": "https://feross.org/support"
+        }
+      ],
+      "license": "MIT"
+    },
+    "node_modules/rc-cascader": {
+      "version": "3.34.0",
+      "resolved": "https://registry.npmjs.org/rc-cascader/-/rc-cascader-3.34.0.tgz",
+      "integrity": "sha512-KpXypcvju9ptjW9FaN2NFcA2QH9E9LHKq169Y0eWtH4e/wHQ5Wh5qZakAgvb8EKZ736WZ3B0zLLOBsrsja5Dag==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.25.7",
+        "classnames": "^2.3.1",
+        "rc-select": "~14.16.2",
+        "rc-tree": "~5.13.0",
+        "rc-util": "^5.43.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-checkbox": {
+      "version": "3.5.0",
+      "resolved": "https://registry.npmjs.org/rc-checkbox/-/rc-checkbox-3.5.0.tgz",
+      "integrity": "sha512-aOAQc3E98HteIIsSqm6Xk2FPKIER6+5vyEFMZfo73TqM+VVAIqOkHoPjgKLqSNtVLWScoaM7vY2ZrGEheI79yg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.25.2"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-checkbox/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/rc-collapse": {
+      "version": "3.9.0",
+      "resolved": "https://registry.npmjs.org/rc-collapse/-/rc-collapse-3.9.0.tgz",
+      "integrity": "sha512-swDdz4QZ4dFTo4RAUMLL50qP0EY62N2kvmk2We5xYdRwcRn8WcYtuetCJpwpaCbUfUt5+huLpVxhvmnK+PHrkA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.3.4",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-dialog": {
+      "version": "9.6.0",
+      "resolved": "https://registry.npmjs.org/rc-dialog/-/rc-dialog-9.6.0.tgz",
+      "integrity": "sha512-ApoVi9Z8PaCQg6FsUzS8yvBEQy0ZL2PkuvAgrmohPkN3okps5WZ5WQWPc1RNuiOKaAYv8B97ACdsFU5LizzCqg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/portal": "^1.0.0-8",
+        "classnames": "^2.2.6",
+        "rc-motion": "^2.3.0",
+        "rc-util": "^5.21.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-drawer": {
+      "version": "7.3.0",
+      "resolved": "https://registry.npmjs.org/rc-drawer/-/rc-drawer-7.3.0.tgz",
+      "integrity": "sha512-DX6CIgiBWNpJIMGFO8BAISFkxiuKitoizooj4BDyee8/SnBn0zwO2FHrNDpqqepj0E/TFTDpmEBCyFuTgC7MOg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.23.9",
+        "@rc-component/portal": "^1.1.1",
+        "classnames": "^2.2.6",
+        "rc-motion": "^2.6.1",
+        "rc-util": "^5.38.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-dropdown": {
+      "version": "4.2.1",
+      "resolved": "https://registry.npmjs.org/rc-dropdown/-/rc-dropdown-4.2.1.tgz",
+      "integrity": "sha512-YDAlXsPv3I1n42dv1JpdM7wJ+gSUBfeyPK59ZpBD9jQhK9jVuxpjj3NmWQHOBceA1zEPVX84T2wbdb2SD0UjmA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.3",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.44.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.11.0",
+        "react-dom": ">=16.11.0"
+      }
+    },
+    "node_modules/rc-field-form": {
+      "version": "2.7.0",
+      "resolved": "https://registry.npmjs.org/rc-field-form/-/rc-field-form-2.7.0.tgz",
+      "integrity": "sha512-hgKsCay2taxzVnBPZl+1n4ZondsV78G++XVsMIJCAoioMjlMQR9YwAp7JZDIECzIu2Z66R+f4SFIRrO2DjDNAA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.0",
+        "@rc-component/async-validator": "^5.0.3",
+        "rc-util": "^5.32.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-image": {
+      "version": "7.12.0",
+      "resolved": "https://registry.npmjs.org/rc-image/-/rc-image-7.12.0.tgz",
+      "integrity": "sha512-cZ3HTyyckPnNnUb9/DRqduqzLfrQRyi+CdHjdqgsyDpI3Ln5UX1kXnAhPBSJj9pVRzwRFgqkN7p9b6HBDjmu/Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.2",
+        "@rc-component/portal": "^1.0.2",
+        "classnames": "^2.2.6",
+        "rc-dialog": "~9.6.0",
+        "rc-motion": "^2.6.2",
+        "rc-util": "^5.34.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-input": {
+      "version": "1.8.0",
+      "resolved": "https://registry.npmjs.org/rc-input/-/rc-input-1.8.0.tgz",
+      "integrity": "sha512-KXvaTbX+7ha8a/k+eg6SYRVERK0NddX8QX7a7AnRvUa/rEH0CNMlpcBzBkhI0wp2C8C4HlMoYl8TImSN+fuHKA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.18.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/rc-input-number": {
+      "version": "9.5.0",
+      "resolved": "https://registry.npmjs.org/rc-input-number/-/rc-input-number-9.5.0.tgz",
+      "integrity": "sha512-bKaEvB5tHebUURAEXw35LDcnRZLq3x1k7GxfAqBMzmpHkDGzjAtnUL8y4y5N15rIFIg5IJgwr211jInl3cipag==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/mini-decimal": "^1.0.1",
+        "classnames": "^2.2.5",
+        "rc-input": "~1.8.0",
+        "rc-util": "^5.40.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-mentions": {
+      "version": "2.20.0",
+      "resolved": "https://registry.npmjs.org/rc-mentions/-/rc-mentions-2.20.0.tgz",
+      "integrity": "sha512-w8HCMZEh3f0nR8ZEd466ATqmXFCMGMN5UFCzEUL0bM/nGw/wOS2GgRzKBcm19K++jDyuWCOJOdgcKGXU3fXfbQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.22.5",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.6",
+        "rc-input": "~1.8.0",
+        "rc-menu": "~9.16.0",
+        "rc-textarea": "~1.10.0",
+        "rc-util": "^5.34.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-menu": {
+      "version": "9.16.1",
+      "resolved": "https://registry.npmjs.org/rc-menu/-/rc-menu-9.16.1.tgz",
+      "integrity": "sha512-ghHx6/6Dvp+fw8CJhDUHFHDJ84hJE3BXNCzSgLdmNiFErWSOaZNsihDAsKq9ByTALo/xkNIwtDFGIl6r+RPXBg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "2.x",
+        "rc-motion": "^2.4.3",
+        "rc-overflow": "^1.3.1",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-motion": {
+      "version": "2.9.5",
+      "resolved": "https://registry.npmjs.org/rc-motion/-/rc-motion-2.9.5.tgz",
+      "integrity": "sha512-w+XTUrfh7ArbYEd2582uDrEhmBHwK1ZENJiSJVb7uRxdE7qJSYjbO2eksRXmndqyKqKoYPc9ClpPh5242mV1vA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.44.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-notification": {
+      "version": "5.6.4",
+      "resolved": "https://registry.npmjs.org/rc-notification/-/rc-notification-5.6.4.tgz",
+      "integrity": "sha512-KcS4O6B4qzM3KH7lkwOB7ooLPZ4b6J+VMmQgT51VZCeEcmghdeR4IrMcFq0LG+RPdnbe/ArT086tGM8Snimgiw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.9.0",
+        "rc-util": "^5.20.1"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-overflow": {
+      "version": "1.4.1",
+      "resolved": "https://registry.npmjs.org/rc-overflow/-/rc-overflow-1.4.1.tgz",
+      "integrity": "sha512-3MoPQQPV1uKyOMVNd6SZfONi+f3st0r8PksexIdBTeIYbMX0Jr+k7pHEDvsXtR4BpCv90/Pv2MovVNhktKrwvw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-resize-observer": "^1.0.0",
+        "rc-util": "^5.37.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-pagination": {
+      "version": "5.1.0",
+      "resolved": "https://registry.npmjs.org/rc-pagination/-/rc-pagination-5.1.0.tgz",
+      "integrity": "sha512-8416Yip/+eclTFdHXLKTxZvn70duYVGTvUUWbckCCZoIl3jagqke3GLsFrMs0bsQBikiYpZLD9206Ej4SOdOXQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.3.2",
+        "rc-util": "^5.38.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-pagination/node_modules/classnames": {
+      "version": "2.5.1",
+      "resolved": "https://registry.npmjs.org/classnames/-/classnames-2.5.1.tgz",
+      "integrity": "sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==",
+      "license": "MIT"
+    },
+    "node_modules/rc-picker": {
+      "version": "4.11.3",
+      "resolved": "https://registry.npmjs.org/rc-picker/-/rc-picker-4.11.3.tgz",
+      "integrity": "sha512-MJ5teb7FlNE0NFHTncxXQ62Y5lytq6sh5nUw0iH8OkHL/TjARSEvSHpr940pWgjGANpjCwyMdvsEV55l5tYNSg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.24.7",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.2.1",
+        "rc-overflow": "^1.3.2",
+        "rc-resize-observer": "^1.4.0",
+        "rc-util": "^5.43.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "date-fns": ">= 2.x",
+        "dayjs": ">= 1.x",
+        "luxon": ">= 3.x",
+        "moment": ">= 2.x",
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      },
+      "peerDependenciesMeta": {
+        "date-fns": {
+          "optional": true
+        },
+        "dayjs": {
+          "optional": true
+        },
+        "luxon": {
+          "optional": true
+        },
+        "moment": {
+          "optional": true
+        }
+      }
+    },
+    "node_modules/rc-progress": {
+      "version": "4.0.0",
+      "resolved": "https://registry.npmjs.org/rc-progress/-/rc-progress-4.0.0.tgz",
+      "integrity": "sha512-oofVMMafOCokIUIBnZLNcOZFsABaUw8PPrf1/y0ZBvKZNpOiu5h4AO9vv11Sw0p4Hb3D0yGWuEattcQGtNJ/aw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.2.6",
+        "rc-util": "^5.16.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-rate": {
+      "version": "2.13.1",
+      "resolved": "https://registry.npmjs.org/rc-rate/-/rc-rate-2.13.1.tgz",
+      "integrity": "sha512-QUhQ9ivQ8Gy7mtMZPAjLbxBt5y9GRp65VcUyGUMF3N3fhiftivPHdpuDIaWIMOTEprAjZPC08bls1dQB+I1F2Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.2.5",
+        "rc-util": "^5.0.1"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-resize-observer": {
+      "version": "1.4.3",
+      "resolved": "https://registry.npmjs.org/rc-resize-observer/-/rc-resize-observer-1.4.3.tgz",
+      "integrity": "sha512-YZLjUbyIWox8E9i9C3Tm7ia+W7euPItNWSPX5sCcQTYbnwDb5uNpnLHQCG1f22oZWUhLw4Mv2tFmeWe68CDQRQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.20.7",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.44.1",
+        "resize-observer-polyfill": "^1.5.1"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-segmented": {
+      "version": "2.7.0",
+      "resolved": "https://registry.npmjs.org/rc-segmented/-/rc-segmented-2.7.0.tgz",
+      "integrity": "sha512-liijAjXz+KnTRVnxxXG2sYDGd6iLL7VpGGdR8gwoxAXy2KglviKCxLWZdjKYJzYzGSUwKDSTdYk8brj54Bn5BA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.1",
+        "classnames": "^2.2.1",
+        "rc-motion": "^2.4.4",
+        "rc-util": "^5.17.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.0.0",
+        "react-dom": ">=16.0.0"
+      }
+    },
+    "node_modules/rc-select": {
+      "version": "14.16.8",
+      "resolved": "https://registry.npmjs.org/rc-select/-/rc-select-14.16.8.tgz",
+      "integrity": "sha512-NOV5BZa1wZrsdkKaiK7LHRuo5ZjZYMDxPP6/1+09+FB4KoNi8jcG1ZqLE3AVCxEsYMBe65OBx71wFoHRTP3LRg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/trigger": "^2.1.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.0.1",
+        "rc-overflow": "^1.3.1",
+        "rc-util": "^5.16.1",
+        "rc-virtual-list": "^3.5.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": "*",
+        "react-dom": "*"
+      }
+    },
+    "node_modules/rc-slider": {
+      "version": "11.1.9",
+      "resolved": "https://registry.npmjs.org/rc-slider/-/rc-slider-11.1.9.tgz",
+      "integrity": "sha512-h8IknhzSh3FEM9u8ivkskh+Ef4Yo4JRIY2nj7MrH6GQmrwV6mcpJf5/4KgH5JaVI1H3E52yCdpOlVyGZIeph5A==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.2.5",
+        "rc-util": "^5.36.0"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-steps": {
+      "version": "6.0.1",
+      "resolved": "https://registry.npmjs.org/rc-steps/-/rc-steps-6.0.1.tgz",
+      "integrity": "sha512-lKHL+Sny0SeHkQKKDJlAjV5oZ8DwCdS2hFhAkIjuQt1/pB81M0cA0ErVFdHq9+jmPmFw1vJB2F5NBzFXLJxV+g==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.16.7",
+        "classnames": "^2.2.3",
+        "rc-util": "^5.16.1"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-switch": {
+      "version": "4.1.0",
+      "resolved": "https://registry.npmjs.org/rc-switch/-/rc-switch-4.1.0.tgz",
+      "integrity": "sha512-TI8ufP2Az9oEbvyCeVE4+90PDSljGyuwix3fV58p7HV2o4wBnVToEyomJRVyTaZeqNPAp+vqeo4Wnj5u0ZZQBg==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.21.0",
+        "classnames": "^2.2.1",
+        "rc-util": "^5.30.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-table": {
+      "version": "7.53.1",
+      "resolved": "https://registry.npmjs.org/rc-table/-/rc-table-7.53.1.tgz",
+      "integrity": "sha512-firAd7Z+liqIDS5TubJ1qqcoBd6YcANLKWQDZhFf3rfoOTt/UNPj4n3O+2vhl+z4QMqwPEUVAil661WHA8H8Aw==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "@rc-component/context": "^1.4.0",
+        "classnames": "^2.2.5",
+        "rc-resize-observer": "^1.1.0",
+        "rc-util": "^5.44.3",
+        "rc-virtual-list": "^3.14.2"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-tabs": {
+      "version": "15.7.0",
+      "resolved": "https://registry.npmjs.org/rc-tabs/-/rc-tabs-15.7.0.tgz",
+      "integrity": "sha512-ZepiE+6fmozYdWf/9gVp7k56PKHB1YYoDsKeQA1CBlJ/POIhjkcYiv0AGP0w2Jhzftd3AVvZP/K+V+Lpi2ankA==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.2",
+        "classnames": "2.x",
+        "rc-dropdown": "~4.2.0",
+        "rc-menu": "~9.16.0",
+        "rc-motion": "^2.6.2",
+        "rc-resize-observer": "^1.0.0",
+        "rc-util": "^5.34.1"
+      },
+      "engines": {
+        "node": ">=8.x"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-textarea": {
+      "version": "1.10.2",
+      "resolved": "https://registry.npmjs.org/rc-textarea/-/rc-textarea-1.10.2.tgz",
+      "integrity": "sha512-HfaeXiaSlpiSp0I/pvWpecFEHpVysZ9tpDLNkxQbMvMz6gsr7aVZ7FpWP9kt4t7DB+jJXesYS0us1uPZnlRnwQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "^2.2.1",
+        "rc-input": "~1.8.0",
+        "rc-resize-observer": "^1.0.0",
+        "rc-util": "^5.27.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-tooltip": {
+      "version": "6.4.0",
+      "resolved": "https://registry.npmjs.org/rc-tooltip/-/rc-tooltip-6.4.0.tgz",
+      "integrity": "sha512-kqyivim5cp8I5RkHmpsp1Nn/Wk+1oeloMv9c7LXNgDxUpGm+RbXJGL+OPvDlcRnx9DBeOe4wyOIl4OKUERyH1g==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.11.2",
+        "@rc-component/trigger": "^2.0.0",
+        "classnames": "^2.3.1",
+        "rc-util": "^5.44.3"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-tree": {
+      "version": "5.13.1",
+      "resolved": "https://registry.npmjs.org/rc-tree/-/rc-tree-5.13.1.tgz",
+      "integrity": "sha512-FNhIefhftobCdUJshO7M8uZTA9F4OPGVXqGfZkkD/5soDeOhwO06T/aKTrg0WD8gRg/pyfq+ql3aMymLHCTC4A==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.10.1",
+        "classnames": "2.x",
+        "rc-motion": "^2.0.1",
+        "rc-util": "^5.16.1",
+        "rc-virtual-list": "^3.5.1"
+      },
+      "engines": {
+        "node": ">=10.x"
+      },
+      "peerDependencies": {
+        "react": "*",
+        "react-dom": "*"
+      }
+    },
+    "node_modules/rc-tree-select": {
+      "version": "5.27.0",
+      "resolved": "https://registry.npmjs.org/rc-tree-select/-/rc-tree-select-5.27.0.tgz",
+      "integrity": "sha512-2qTBTzwIT7LRI1o7zLyrCzmo5tQanmyGbSaGTIf7sYimCklAToVVfpMC6OAldSKolcnjorBYPNSKQqJmN3TCww==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.25.7",
+        "classnames": "2.x",
+        "rc-select": "~14.16.2",
+        "rc-tree": "~5.13.0",
+        "rc-util": "^5.43.0"
+      },
+      "peerDependencies": {
+        "react": "*",
+        "react-dom": "*"
+      }
+    },
+    "node_modules/rc-upload": {
+      "version": "4.9.2",
+      "resolved": "https://registry.npmjs.org/rc-upload/-/rc-upload-4.9.2.tgz",
+      "integrity": "sha512-nHx+9rbd1FKMiMRYsqQ3NkXUv7COHPBo3X1Obwq9SWS6/diF/A0aJ5OHubvwUAIDs+4RMleljV0pcrNUc823GQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.3",
+        "classnames": "^2.2.5",
+        "rc-util": "^5.2.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
+    "node_modules/rc-util": {
+      "version": "5.44.4",
+      "resolved": "https://registry.npmjs.org/rc-util/-/rc-util-5.44.4.tgz",
+      "integrity": "sha512-resueRJzmHG9Q6rI/DfK6Kdv9/Lfls05vzMs1Sk3M2P+3cJa+MakaZyWY8IPfehVuhPJFKrIY1IK4GqbiaiY5w==",
+      "license": "MIT",
+      "dependencies": {
+        "@babel/runtime": "^7.18.3",
+        "react-is": "^18.2.0"
+      },
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
       }
     },
-    "node_modules/pure-rand": {
-      "version": "6.1.0",
-      "resolved": "https://registry.npmjs.org/pure-rand/-/pure-rand-6.1.0.tgz",
-      "integrity": "sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==",
-      "dev": true,
-      "funding": [
-        {
-          "type": "individual",
-          "url": "https://github.com/sponsors/dubzzz"
-        },
-        {
-          "type": "opencollective",
-          "url": "https://opencollective.com/fast-check"
-        }
-      ],
+    "node_modules/rc-util/node_modules/react-is": {
+      "version": "18.3.1",
+      "resolved": "https://registry.npmjs.org/react-is/-/react-is-18.3.1.tgz",
+      "integrity": "sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==",
       "license": "MIT"
     },
-    "node_modules/qs": {
-      "version": "6.14.0",
-      "resolved": "https://registry.npmjs.org/qs/-/qs-6.14.0.tgz",
-      "integrity": "sha512-YWWTjgABSKcvs/nWBi9PycY/JiPJqOD4JA6o9Sej2AtvSGarXxKC3OQSk4pAarbdQlKAh5D4FCQkJNkW+GAn3w==",
-      "license": "BSD-3-Clause",
+    "node_modules/rc-virtual-list": {
+      "version": "3.19.2",
+      "resolved": "https://registry.npmjs.org/rc-virtual-list/-/rc-virtual-list-3.19.2.tgz",
+      "integrity": "sha512-Ys6NcjwGkuwkeaWBDqfI3xWuZ7rDiQXlH1o2zLfFzATfEgXcqpk8CkgMfbJD81McqjcJVez25a3kPxCR807evA==",
+      "license": "MIT",
       "dependencies": {
-        "side-channel": "^1.1.0"
+        "@babel/runtime": "^7.20.0",
+        "classnames": "^2.2.6",
+        "rc-resize-observer": "^1.0.0",
+        "rc-util": "^5.36.0"
       },
       "engines": {
-        "node": ">=0.6"
+        "node": ">=8.x"
       },
-      "funding": {
-        "url": "https://github.com/sponsors/ljharb"
-      }
-    },
-    "node_modules/querystring-es3": {
-      "version": "0.2.1",
-      "resolved": "https://registry.npmjs.org/querystring-es3/-/querystring-es3-0.2.1.tgz",
-      "integrity": "sha512-773xhDQnZBMFobEiztv8LIl70ch5MSF/jUQVlhwFyBILqq96anmoctVIYz+ZRp0qbCKATTn6ev02M3r7Ga5vqA==",
-      "engines": {
-        "node": ">=0.4.x"
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
       }
     },
-    "node_modules/queue-microtask": {
-      "version": "1.2.3",
-      "resolved": "https://registry.npmjs.org/queue-microtask/-/queue-microtask-1.2.3.tgz",
-      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",
-      "dev": true,
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/feross"
-        },
-        {
-          "type": "patreon",
-          "url": "https://www.patreon.com/feross"
-        },
-        {
-          "type": "consulting",
-          "url": "https://feross.org/support"
-        }
-      ],
-      "license": "MIT"
-    },
     "node_modules/re-resizable": {
       "version": "6.11.2",
       "resolved": "https://registry.npmjs.org/re-resizable/-/re-resizable-6.11.2.tgz",
@@ -11963,6 +13657,41 @@
       "integrity": "sha512-x3Ax3kNSMIIkyVYhWPyO09bu0uttcAIoecO/um/rKGQ4EltYWVYtyiGkS/3xMynrbVQdS69Jhlv8FXUEZehlzA==",
       "license": "MIT"
     },
+    "node_modules/react-markdown": {
+      "version": "6.0.3",
+      "resolved": "https://registry.npmjs.org/react-markdown/-/react-markdown-6.0.3.tgz",
+      "integrity": "sha512-kQbpWiMoBHnj9myLlmZG9T1JdoT/OEyHK7hqM6CqFT14MAkgWiWBUYijLyBmxbntaN6dCDicPcUhWhci1QYodg==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/hast": "^2.0.0",
+        "@types/unist": "^2.0.3",
+        "comma-separated-tokens": "^1.0.0",
+        "prop-types": "^15.7.2",
+        "property-information": "^5.3.0",
+        "react-is": "^17.0.0",
+        "remark-parse": "^9.0.0",
+        "remark-rehype": "^8.0.0",
+        "space-separated-tokens": "^1.1.0",
+        "style-to-object": "^0.3.0",
+        "unified": "^9.0.0",
+        "unist-util-visit": "^2.0.0",
+        "vfile": "^4.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      },
+      "peerDependencies": {
+        "@types/react": ">=16",
+        "react": ">=16"
+      }
+    },
+    "node_modules/react-markdown/node_modules/react-is": {
+      "version": "17.0.2",
+      "resolved": "https://registry.npmjs.org/react-is/-/react-is-17.0.2.tgz",
+      "integrity": "sha512-w2GsyukL62IJnlaff/nRegPQR94C/XXamvMWmSHRJ4y7Ts/4ocGRmTHvOs8PSE6pB3dWOrD/nueuU5sduBsQ4w==",
+      "license": "MIT"
+    },
     "node_modules/react-rnd": {
       "version": "10.5.2",
       "resolved": "https://registry.npmjs.org/react-rnd/-/react-rnd-10.5.2.tgz",
@@ -12088,6 +13817,55 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/remark-gfm": {
+      "version": "1.0.0",
+      "resolved": "https://registry.npmjs.org/remark-gfm/-/remark-gfm-1.0.0.tgz",
+      "integrity": "sha512-KfexHJCiqvrdBZVbQ6RopMZGwaXz6wFJEfByIuEwGf0arvITHjiKKZ1dpXujjH9KZdm1//XJQwgfnJ3lmXaDPA==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-gfm": "^0.1.0",
+        "micromark-extension-gfm": "^0.3.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/remark-parse": {
+      "version": "9.0.0",
+      "resolved": "https://registry.npmjs.org/remark-parse/-/remark-parse-9.0.0.tgz",
+      "integrity": "sha512-geKatMwSzEXKHuzBNU1z676sGcDcFoChMK38TgdHJNAYfFtsfHDQG7MoJAjs6sgYMqyLduCYWDIWZIxiPeafEw==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-from-markdown": "^0.8.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/remark-rehype": {
+      "version": "8.1.0",
+      "resolved": "https://registry.npmjs.org/remark-rehype/-/remark-rehype-8.1.0.tgz",
+      "integrity": "sha512-EbCu9kHgAxKmW1yEYjx3QafMyGY3q8noUbNUI5xyKbaFP89wbhDrKxyIQNukNYthzjNHZu6J7hwFg7hRm1svYA==",
+      "license": "MIT",
+      "dependencies": {
+        "mdast-util-to-hast": "^10.2.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/repeat-string": {
+      "version": "1.6.1",
+      "resolved": "https://registry.npmjs.org/repeat-string/-/repeat-string-1.6.1.tgz",
+      "integrity": "sha512-PV0dzCYDNfRi1jCDbJzpW7jNNDRuCOG/jI5ctQcGKt/clZD+YcPS3yIlWuTJMmESC8aevCFmWJy5wjAFgNqN6w==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=0.10"
+      }
+    },
     "node_modules/require-directory": {
       "version": "2.1.1",
       "resolved": "https://registry.npmjs.org/require-directory/-/require-directory-2.1.1.tgz",
@@ -12107,6 +13885,12 @@
         "lodash": "^4.17.21"
       }
     },
+    "node_modules/resize-observer-polyfill": {
+      "version": "1.5.1",
+      "resolved": "https://registry.npmjs.org/resize-observer-polyfill/-/resize-observer-polyfill-1.5.1.tgz",
+      "integrity": "sha512-LwZrotdHOo12nQuZlHEmtuXdqGoOD0OhaxopaNFxWzInpEgaLWoVuAMbTzixuosCx2nEG58ngzW3vxdWoxIgdg==",
+      "license": "MIT"
+    },
     "node_modules/resolve": {
       "version": "1.22.10",
       "resolved": "https://registry.npmjs.org/resolve/-/resolve-1.22.10.tgz",
@@ -12327,6 +14111,15 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/safe-stable-stringify": {
+      "version": "2.5.0",
+      "resolved": "https://registry.npmjs.org/safe-stable-stringify/-/safe-stable-stringify-2.5.0.tgz",
+      "integrity": "sha512-b3rppTKm9T+PsVCBEOUR46GWI7fdOs00VKZ1+9c1EWDaDMvjQc6tUwuFyIprgGgTcWoVHSKrU8H31ZHA2e0RHA==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=10"
+      }
+    },
     "node_modules/safer-buffer": {
       "version": "2.1.2",
       "resolved": "https://registry.npmjs.org/safer-buffer/-/safer-buffer-2.1.2.tgz",
@@ -12356,6 +14149,15 @@
         "loose-envify": "^1.1.0"
       }
     },
+    "node_modules/scroll-into-view-if-needed": {
+      "version": "3.1.0",
+      "resolved": "https://registry.npmjs.org/scroll-into-view-if-needed/-/scroll-into-view-if-needed-3.1.0.tgz",
+      "integrity": "sha512-49oNpRjWRvnU8NyGVmUaYG4jtTkNonFZI86MmGRDqBphEK2EXT9gdEUoQPZhuBM8yWHxCWbobltqYO5M4XrUvQ==",
+      "license": "MIT",
+      "dependencies": {
+        "compute-scroll-into-view": "^3.0.2"
+      }
+    },
     "node_modules/semver": {
       "version": "7.7.2",
       "resolved": "https://registry.npmjs.org/semver/-/semver-7.7.2.tgz",
@@ -12639,6 +14441,16 @@
         "node": ">=0.10.0"
       }
     },
+    "node_modules/space-separated-tokens": {
+      "version": "1.1.5",
+      "resolved": "https://registry.npmjs.org/space-separated-tokens/-/space-separated-tokens-1.1.5.tgz",
+      "integrity": "sha512-q/JSVd1Lptzhf5bkYm4ob4iWPjx0KiRe3sRFBNrVqbJkFaBm5vbbowy1mymoPNLRa52+oadOhJ+K49wsSeSjTA==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/sprintf-js": {
       "version": "1.0.3",
       "resolved": "https://registry.npmjs.org/sprintf-js/-/sprintf-js-1.0.3.tgz",
@@ -12717,6 +14529,12 @@
         "safe-buffer": "~5.2.0"
       }
     },
+    "node_modules/string-convert": {
+      "version": "0.2.1",
+      "resolved": "https://registry.npmjs.org/string-convert/-/string-convert-0.2.1.tgz",
+      "integrity": "sha512-u/1tdPl4yQnPBjnVrmdLo9gtuLvELKsAoRapekWggdiQNvvvum+jYF329d84NAa660KQw7pB2n36KrIKVoXa3A==",
+      "license": "MIT"
+    },
     "node_modules/string-length": {
       "version": "4.0.2",
       "resolved": "https://registry.npmjs.org/string-length/-/string-length-4.0.2.tgz",
@@ -12920,6 +14738,15 @@
       "integrity": "sha512-PdHt7hHUJKxvTCgbKX9C1V/ftOcjJQgz8BZwNfV5c4B6dcGqlpelTbJ999jBGZ2jYiPAwcX5dP6oBwVlBlUbxw==",
       "license": "MIT"
     },
+    "node_modules/style-to-object": {
+      "version": "0.3.0",
+      "resolved": "https://registry.npmjs.org/style-to-object/-/style-to-object-0.3.0.tgz",
+      "integrity": "sha512-CzFnRRXhzWIdItT3OmF8SQfWyahHhjq3HwcMNCNLn+N7klOOqPjMeG/4JSu77D7ypZdGvSzvkrbyeTMizz2VrA==",
+      "license": "MIT",
+      "dependencies": {
+        "inline-style-parser": "0.1.1"
+      }
+    },
     "node_modules/styled-jsx": {
       "version": "5.1.6",
       "resolved": "https://registry.npmjs.org/styled-jsx/-/styled-jsx-5.1.6.tgz",
@@ -12949,6 +14776,16 @@
       "integrity": "sha512-Orov6g6BB1sDfYgzWfTHDOxamtX1bE/zo104Dh9e6fqJ3PooipYyfJ0pUmrZO2wAvO8YbEyeFrkV91XTsGMSrw==",
       "license": "MIT"
     },
+    "node_modules/sunflower-antd": {
+      "version": "1.0.0-beta.3",
+      "resolved": "https://registry.npmjs.org/sunflower-antd/-/sunflower-antd-1.0.0-beta.3.tgz",
+      "integrity": "sha512-SAdjHgNemTFNxUF/QJ2KdC0x6wWpY1EsMJMo+F5KIHCDRsUUahjAIldoK+ejH00rPgUoCOhAHQ/ob/J7eyZ5qg==",
+      "license": "MIT",
+      "peerDependencies": {
+        "react": ">=16.9.0",
+        "react-dom": ">=16.9.0"
+      }
+    },
     "node_modules/supports-color": {
       "version": "7.2.0",
       "resolved": "https://registry.npmjs.org/supports-color/-/supports-color-7.2.0.tgz",
@@ -12974,6 +14811,19 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/swr": {
+      "version": "2.3.6",
+      "resolved": "https://registry.npmjs.org/swr/-/swr-2.3.6.tgz",
+      "integrity": "sha512-wfHRmHWk/isGNMwlLGlZX5Gzz/uTgo0o2IRuTMcf4CPuPFJZlq0rDaKUx+ozB5nBOReNV1kiOyzMfj+MBMikLw==",
+      "license": "MIT",
+      "dependencies": {
+        "dequal": "^2.0.3",
+        "use-sync-external-store": "^1.4.0"
+      },
+      "peerDependencies": {
+        "react": "^16.11.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/symbol-tree": {
       "version": "3.2.4",
       "resolved": "https://registry.npmjs.org/symbol-tree/-/symbol-tree-3.2.4.tgz",
@@ -13091,6 +14941,15 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/throttle-debounce": {
+      "version": "5.0.2",
+      "resolved": "https://registry.npmjs.org/throttle-debounce/-/throttle-debounce-5.0.2.tgz",
+      "integrity": "sha512-B71/4oyj61iNH0KeCamLuE2rmKuTO5byTOSVwECM5FA7TiAiAW+UqTKZ9ERueC4qvgSttUhdmq1mXC3kJqGX7A==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=12.22"
+      }
+    },
     "node_modules/tiny-invariant": {
       "version": "1.2.0",
       "resolved": "https://registry.npmjs.org/tiny-invariant/-/tiny-invariant-1.2.0.tgz",
@@ -13147,6 +15006,12 @@
         "node": ">=8.0"
       }
     },
+    "node_modules/toggle-selection": {
+      "version": "1.0.6",
+      "resolved": "https://registry.npmjs.org/toggle-selection/-/toggle-selection-1.0.6.tgz",
+      "integrity": "sha512-BiZS+C1OS8g/q2RRbJmy59xpyghNBqrr6k5L/uKBGRsTfxmu3ffiRnd8mlGPUVayg8pvfi5urfnu8TU7DVOkLQ==",
+      "license": "MIT"
+    },
     "node_modules/tough-cookie": {
       "version": "5.1.2",
       "resolved": "https://registry.npmjs.org/tough-cookie/-/tough-cookie-5.1.2.tgz",
@@ -13172,6 +15037,16 @@
         "node": ">=18"
       }
     },
+    "node_modules/trough": {
+      "version": "1.0.5",
+      "resolved": "https://registry.npmjs.org/trough/-/trough-1.0.5.tgz",
+      "integrity": "sha512-rvuRbTarPXmMb79SmzEp8aqXNKcK+y0XaB298IXueQ8I2PsrATcPBCSPyK/dDNa2iWOhKlfNnOjdAOTBU/nkFA==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
+    },
     "node_modules/ts-api-utils": {
       "version": "2.1.0",
       "resolved": "https://registry.npmjs.org/ts-api-utils/-/ts-api-utils-2.1.0.tgz",
@@ -13505,6 +15380,106 @@
       "integrity": "sha512-Ny6QZ2Nju20vw1SRHe3d9jVu6gJ+4e3+MMpqu7pqE5HT6WsTSlce++GQmK5UXS8mzV8DSYHrQH+Xrf2jVcuKNg==",
       "license": "MIT"
     },
+    "node_modules/unified": {
+      "version": "9.2.2",
+      "resolved": "https://registry.npmjs.org/unified/-/unified-9.2.2.tgz",
+      "integrity": "sha512-Sg7j110mtefBD+qunSLO1lqOEKdrwBFBrR6Qd8f4uwkhWNlbkaqwHse6e7QvD3AP/MNoJdEDLaf8OxYyoWgorQ==",
+      "license": "MIT",
+      "dependencies": {
+        "bail": "^1.0.0",
+        "extend": "^3.0.0",
+        "is-buffer": "^2.0.0",
+        "is-plain-obj": "^2.0.0",
+        "trough": "^1.0.0",
+        "vfile": "^4.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-builder": {
+      "version": "2.0.3",
+      "resolved": "https://registry.npmjs.org/unist-builder/-/unist-builder-2.0.3.tgz",
+      "integrity": "sha512-f98yt5pnlMWlzP539tPc4grGMsFaQQlP/vM396b00jngsiINumNmsY8rkXjfoi1c6QaM8nQ3vaGDuoKWbe/1Uw==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-generated": {
+      "version": "1.1.6",
+      "resolved": "https://registry.npmjs.org/unist-util-generated/-/unist-util-generated-1.1.6.tgz",
+      "integrity": "sha512-cln2Mm1/CZzN5ttGK7vkoGw+RZ8VcUH6BtGbq98DDtRGquAAOXig1mrBQYelOwMXYS8rK+vZDyyojSjp7JX+Lg==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-is": {
+      "version": "4.1.0",
+      "resolved": "https://registry.npmjs.org/unist-util-is/-/unist-util-is-4.1.0.tgz",
+      "integrity": "sha512-ZOQSsnce92GrxSqlnEEseX0gi7GH9zTJZ0p9dtu87WRb/37mMPO2Ilx1s/t9vBHrFhbgweUwb+t7cIn5dxPhZg==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-position": {
+      "version": "3.1.0",
+      "resolved": "https://registry.npmjs.org/unist-util-position/-/unist-util-position-3.1.0.tgz",
+      "integrity": "sha512-w+PkwCbYSFw8vpgWD0v7zRCl1FpY3fjDSQ3/N/wNd9Ffa4gPi8+4keqt99N3XW6F99t/mUzp2xAhNmfKWp95QA==",
+      "license": "MIT",
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-stringify-position": {
+      "version": "2.0.3",
+      "resolved": "https://registry.npmjs.org/unist-util-stringify-position/-/unist-util-stringify-position-2.0.3.tgz",
+      "integrity": "sha512-3faScn5I+hy9VleOq/qNbAd6pAx7iH5jYBMS9I1HgQVijz/4mv5Bvw5iw1sC/90CODiKo81G/ps8AJrISn687g==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.2"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-visit": {
+      "version": "2.0.3",
+      "resolved": "https://registry.npmjs.org/unist-util-visit/-/unist-util-visit-2.0.3.tgz",
+      "integrity": "sha512-iJ4/RczbJMkD0712mGktuGpm/U4By4FfDonL7N/9tATGIF4imikjOuagyMY53tnZq3NP6BcmlrHhEKAfGWjh7Q==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "unist-util-is": "^4.0.0",
+        "unist-util-visit-parents": "^3.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/unist-util-visit-parents": {
+      "version": "3.1.1",
+      "resolved": "https://registry.npmjs.org/unist-util-visit-parents/-/unist-util-visit-parents-3.1.1.tgz",
+      "integrity": "sha512-1KROIZWo6bcMrZEwiH2UrXDyalAa0uqzWCxCJj6lPOvTve2WkfgCytoDTPaMnodXh1WrXOq0haVYHj99ynJlsg==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "unist-util-is": "^4.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
     "node_modules/update-browserslist-db": {
       "version": "1.1.3",
       "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.1.3.tgz",
@@ -13571,6 +15546,15 @@
       "integrity": "sha512-jmYNElW7yvO7TV33CjSmvSiE2yco3bV2czu/OzDKdMNVZQWfxCblURLhf+47syQRBntjfLdd/H0egrzIG+oaFQ==",
       "license": "MIT"
     },
+    "node_modules/use-sync-external-store": {
+      "version": "1.6.0",
+      "resolved": "https://registry.npmjs.org/use-sync-external-store/-/use-sync-external-store-1.6.0.tgz",
+      "integrity": "sha512-Pp6GSwGP/NrPIrxVFAIkOQeyw8lFenOHijQWkUTrDvrF4ALqylP2C/KCkeS9dpUM3KvYRQhna5vt7IL95+ZQ9w==",
+      "license": "MIT",
+      "peerDependencies": {
+        "react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
+      }
+    },
     "node_modules/util-deprecate": {
       "version": "1.0.2",
       "resolved": "https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz",
@@ -13619,6 +15603,36 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/vfile": {
+      "version": "4.2.1",
+      "resolved": "https://registry.npmjs.org/vfile/-/vfile-4.2.1.tgz",
+      "integrity": "sha512-O6AE4OskCG5S1emQ/4gl8zK586RqA3srz3nfK/Viy0UPToBc5Trp9BVFb1u0CjsKrAWwnpr4ifM/KBXPWwJbCA==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "is-buffer": "^2.0.0",
+        "unist-util-stringify-position": "^2.0.0",
+        "vfile-message": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
+    "node_modules/vfile-message": {
+      "version": "2.0.4",
+      "resolved": "https://registry.npmjs.org/vfile-message/-/vfile-message-2.0.4.tgz",
+      "integrity": "sha512-DjssxRGkMvifUOJre00juHoP9DPWuzjxKuMDrhNbk2TdaYYBNMStsNhEOt3idrtI12VQYM/1+iM0KOzXi4pxwQ==",
+      "license": "MIT",
+      "dependencies": {
+        "@types/unist": "^2.0.0",
+        "unist-util-stringify-position": "^2.0.0"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/unified"
+      }
+    },
     "node_modules/w3c-xmlserializer": {
       "version": "5.0.0",
       "resolved": "https://registry.npmjs.org/w3c-xmlserializer/-/w3c-xmlserializer-5.0.0.tgz",
@@ -13648,6 +15662,15 @@
       "integrity": "sha512-VkQZJbO8zVImzYFteBXvBOZEl1qL175WH8VmZcxF2fZAoudNhNDvHi+doCaAEdU2l2vtcIwa2zn0QK5+I1HQ3Q==",
       "license": "MIT"
     },
+    "node_modules/warning": {
+      "version": "4.0.3",
+      "resolved": "https://registry.npmjs.org/warning/-/warning-4.0.3.tgz",
+      "integrity": "sha512-rpJyN222KWIvHJ/F53XSZv0Zl/accqHR8et1kpaMTD/fLCRxtV8iX8czMzY7sVZupTI3zcUTg8eycS2kNF9l6w==",
+      "license": "MIT",
+      "dependencies": {
+        "loose-envify": "^1.0.0"
+      }
+    },
     "node_modules/web-vitals": {
       "version": "4.2.4",
       "resolved": "https://registry.npmjs.org/web-vitals/-/web-vitals-4.2.4.tgz",
@@ -13927,6 +15950,15 @@
       "license": "Apache-2.0",
       "optional": true
     },
+    "node_modules/xtend": {
+      "version": "4.0.2",
+      "resolved": "https://registry.npmjs.org/xtend/-/xtend-4.0.2.tgz",
+      "integrity": "sha512-LKYU1iAXJXUgAXn9URjiu+MWhyUXHsvfp7mcuYm9dSUKK0/CjtrUwFAxD82/mCWbtLsGjFIad0wIsod4zrTAEQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=0.4"
+      }
+    },
     "node_modules/y18n": {
       "version": "5.0.8",
       "resolved": "https://registry.npmjs.org/y18n/-/y18n-5.0.8.tgz",
@@ -14001,6 +16033,16 @@
       "funding": {
         "url": "https://github.com/sponsors/sindresorhus"
       }
+    },
+    "node_modules/zwitch": {
+      "version": "1.0.5",
+      "resolved": "https://registry.npmjs.org/zwitch/-/zwitch-1.0.5.tgz",
+      "integrity": "sha512-V50KMwwzqJV0NpZIZFwfOD5/lyny3WlSzRiXgA0G7VUnRlqttta1L6UQIHzd6EuBY/cHGfwTIck7w1yH6Q5zUw==",
+      "license": "MIT",
+      "funding": {
+        "type": "github",
+        "url": "https://github.com/sponsors/wooorm"
+      }
     }
   }
 }
diff --git a/package.json b/package.json
index ca560d6..cbfd9c3 100644
--- a/package.json
+++ b/package.json
@@ -4,14 +4,17 @@
   "description": "",
   "main": "index.js",
   "dependencies": {
+    "@ant-design/icons": "^5.5.3",
     "@emotion/react": "^11.14.0",
     "@emotion/styled": "^11.14.0",
     "@google-cloud/secret-manager": "^5.6.0",
     "@mui/icons-material": "^6.3.1",
     "@mui/material": "^6.4.7",
+    "@refinedev/antd": "^6.0.2",
     "@refinedev/core": "^5.0.4",
     "@refinedev/nextjs-router": "^7.0.1",
     "@tanstack/react-query": "^5.59.15",
+    "antd": "^5.23.0",
     "browserify-zlib": "^0.2.0",
     "date-fns": "^4.1.0",
     "dayjs": "^1.11.10",
@@ -25,6 +28,7 @@
     "notistack": "^3.0.1",
     "os-browserify": "^0.3.0",
     "path-browserify": "^1.0.1",
+    "lodash.debounce": "^4.0.8",
     "punycode.js": "^2.3.1",
     "querystring-es3": "^0.2.1",
     "react": "^18.2.0",
@@ -52,6 +56,7 @@
     "@testing-library/react": "^16.1.0",
     "@types/cypress": "^0.1.6",
     "@types/jest": "^30.0.0",
+    "@types/lodash.debounce": "^4.0.9",
     "@types/node": "^22.10.2",
     "@types/react": "^18.3.16",
     "@types/react-dom": "^18.3.2",
diff --git a/pages/_app.tsx b/pages/_app.tsx
index 98d42e7..313fa59 100644
--- a/pages/_app.tsx
+++ b/pages/_app.tsx
@@ -5,6 +5,7 @@ import { SnackbarProvider } from 'notistack';
 import type { AppProps } from 'next/app';
 import { setupClientLogging } from '../lib/clientLogger';
 import { Newsreader, Cantata_One, Nunito } from 'next/font/google';
+import 'antd/dist/reset.css';
 import '../styles/studentDialog.css';
 import '../styles/project-dialog.css';
 import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
index aae8352..20e706e 100644
--- a/pages/dashboard/new-ui/client-accounts.tsx
+++ b/pages/dashboard/new-ui/client-accounts.tsx
@@ -1,41 +1,285 @@
 import Head from "next/head"
 import dynamic from "next/dynamic"
-import { memo, useMemo, useState } from "react"
+import { useEffect, useMemo, useState, type ReactNode } from "react"
 import {
   Refine,
-  useList,
-  type DataProvider,
+  useMenu,
   type BaseRecord,
+  type CrudFilters,
+  type CrudSorting,
+  type DataProvider,
   type GetListResponse,
+  type HttpError,
 } from "@refinedev/core"
+import { List, FilterDropdown, useTable } from "@refinedev/antd"
 import routerProvider from "@refinedev/nextjs-router"
 import {
+  App as AntdApp,
   Avatar,
-  Box,
-  Card,
-  CardContent,
-  Chip,
-  CssBaseline,
+  Badge,
+  Button,
+  ConfigProvider,
+  Drawer,
+  Form,
   Grid,
-  InputAdornment,
-  LinearProgress,
-  Stack,
-  TextField,
-  ThemeProvider,
+  Input,
+  Layout,
+  Menu,
+  Pagination,
+  Radio,
+  Select,
+  Space,
+  Spin,
+  Table,
+  type TableProps,
+  Tag,
+  Tooltip,
   Typography,
-  createTheme,
-} from "@mui/material"
-import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
+} from "antd"
+import {
+  ApartmentOutlined,
+  AppstoreOutlined,
+  BarsOutlined,
+  BellOutlined,
+  CalendarOutlined,
+  CheckCircleOutlined,
+  EllipsisOutlined,
+  EyeOutlined,
+  FileTextOutlined,
+  MailOutlined,
+  MenuFoldOutlined,
+  MenuUnfoldOutlined,
+  MinusCircleOutlined,
+  PhoneOutlined,
+  PlayCircleFilled,
+  PlayCircleOutlined,
+  PlusCircleOutlined,
+  SearchOutlined,
+  SettingOutlined,
+  TeamOutlined,
+  ThunderboltFilled,
+  UnorderedListOutlined,
+} from "@ant-design/icons"
+import debounce from "lodash.debounce"
 import type { GetServerSideProps } from "next"
 import { getSession } from "next-auth/react"
 
 import type { ClientDirectoryRecord } from "../../../lib/clientDirectory"
 
+const { Header, Content, Sider } = Layout
+const { Text } = Typography
+
+const clientStatuses = [
+  "QUALIFIED",
+  "NEGOTIATION",
+  "CONTACTED",
+  "INTERESTED",
+  "NEW",
+  "UNQUALIFIED",
+  "LOST",
+  "WON",
+  "CHURNED",
+] as const
+
+type ContactStatus = (typeof clientStatuses)[number]
+
+type ClientAccountRow = {
+  id: string
+  name: string
+  email: string
+  jobTitle: string
+  phone: string
+  region: string
+  status: ContactStatus
+  company: { id: string; name: string }
+  avatarSeed: string
+}
+
+const directoryCache: { records: ClientAccountRow[] } = { records: [] }
+
+type ClientFilter = CrudFilters[number]
+
+const isFieldFilter = (filter: ClientFilter): filter is ClientFilter & { field: string } =>
+  typeof filter === "object" && filter !== null && "field" in filter
+
+const formatNullable = (value: string | null | undefined, fallback = "N/A") => {
+  if (!value) return fallback
+  const trimmed = value.trim()
+  return trimmed.length > 0 ? trimmed : fallback
+}
+
+const toCompanyId = (name: string, index: number) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "company"}-${index}`
+
+const hashString = (value: string) => {
+  let hash = 0
+  for (let i = 0; i < value.length; i += 1) {
+    hash = (hash << 5) - hash + value.charCodeAt(i)
+    hash |= 0
+  }
+  return hash
+}
+
+const getStatusForRecord = (record: ClientDirectoryRecord, index: number): ContactStatus => {
+  const seed = `${record.companyName ?? "client"}-${record.region ?? "region"}-${index}`
+  const paletteIndex = Math.abs(hashString(seed)) % clientStatuses.length
+  return clientStatuses[paletteIndex]
+}
+
+const getAvatarColor = (seed: string) => {
+  const base = Math.abs(hashString(seed))
+  const r = (base & 0xff0000) >> 16
+  const g = (base & 0x00ff00) >> 8
+  const b = base & 0x0000ff
+  return `rgb(${(r % 156) + 80}, ${(g % 156) + 80}, ${(b % 156) + 80})`
+}
+
+const getInitials = (value: string) => {
+  const pieces = value
+    .split(/\s+/)
+    .filter(Boolean)
+    .slice(0, 2)
+  if (pieces.length === 0) return "NA"
+  if (pieces.length === 1) return pieces[0].slice(0, 2).toUpperCase()
+  return `${pieces[0][0] ?? ""}${pieces[1][0] ?? ""}`.toUpperCase()
+}
+
+const statusStyles: Record<
+  ContactStatus,
+  { color: string; icon: ReactNode; label: string }
+> = {
+  QUALIFIED: { color: "green", icon: <PlayCircleFilled />, label: "Qualified" },
+  NEGOTIATION: { color: "blue", icon: <PlayCircleFilled />, label: "Negotiation" },
+  CONTACTED: { color: "cyan", icon: <PlayCircleOutlined />, label: "Contacted" },
+  INTERESTED: { color: "cyan", icon: <PlayCircleOutlined />, label: "Interested" },
+  NEW: { color: "geekblue", icon: <PlayCircleOutlined />, label: "New" },
+  UNQUALIFIED: { color: "red", icon: <PlayCircleOutlined />, label: "Unqualified" },
+  LOST: { color: "red", icon: <MinusCircleOutlined />, label: "Lost" },
+  WON: { color: "green", icon: <CheckCircleOutlined />, label: "Won" },
+  CHURNED: { color: "volcano", icon: <MinusCircleOutlined />, label: "Churned" },
+}
+
+const normalizeRecord = (
+  raw: ClientDirectoryRecord & { id: string | undefined },
+  index: number,
+): ClientAccountRow => {
+  const safeCompany = formatNullable(raw.companyName, "N/A")
+  const companyId = raw.id && raw.id.trim().length > 0 ? raw.id : toCompanyId(safeCompany, index)
+  const name = formatNullable(raw.nameAddressed ?? raw.name ?? raw.companyName, "N/A")
+  return {
+    id: companyId,
+    name,
+    email: formatNullable(raw.emailAddress, "N/A"),
+    jobTitle: formatNullable(raw.title, "N/A"),
+    phone: formatNullable(raw.phone, "N/A"),
+    region: formatNullable(raw.region, "N/A"),
+    company: {
+      id: companyId,
+      name: safeCompany,
+    },
+    status: getStatusForRecord(raw, index),
+    avatarSeed: name,
+  }
+}
+
+const applyFilters = (rows: ClientAccountRow[], filters?: CrudFilters): ClientAccountRow[] => {
+  if (!filters) return rows
+  return filters.reduce<ClientAccountRow[]>((result, filter) => {
+    if (!filter) return result
+    if (!isFieldFilter(filter)) {
+      return result
+    }
+    const { field, value } = filter
+    if (value == null || (Array.isArray(value) && value.length === 0)) {
+      return result
+    }
+    switch (field) {
+      case "name":
+        if (typeof value === "string" && value.trim().length > 0) {
+          const needle = value.trim().toLowerCase()
+          return result.filter((row) =>
+            [row.name, row.company.name, row.email, row.region]
+              .join(" ")
+              .toLowerCase()
+              .includes(needle),
+          )
+        }
+        return result
+      case "email":
+        if (typeof value === "string" && value.trim().length > 0) {
+          const needle = value.trim().toLowerCase()
+          return result.filter((row) => row.email.toLowerCase().includes(needle))
+        }
+        return result
+      case "companyName":
+      case "company.id":
+        if (typeof value === "string" && value.trim().length > 0) {
+          const match = value.trim().toLowerCase()
+          return result.filter((row) =>
+            row.company.id.toLowerCase() === match || row.company.name.toLowerCase() === match,
+          )
+        }
+        return result
+      case "jobTitle":
+        if (typeof value === "string" && value.trim().length > 0) {
+          const needle = value.trim().toLowerCase()
+          return result.filter((row) => row.jobTitle.toLowerCase().includes(needle))
+        }
+        return result
+      case "status":
+        if (Array.isArray(value)) {
+          const allowed = new Set(value.map((item) => String(item).toUpperCase()))
+          return result.filter((row) => allowed.has(row.status))
+        }
+        if (typeof value === "string" && value.trim().length > 0) {
+          return result.filter((row) => row.status === value.trim().toUpperCase())
+        }
+        return result
+      default:
+        return result
+    }
+  }, rows)
+}
+
+const applySorting = (rows: ClientAccountRow[], sorters?: CrudSorting): ClientAccountRow[] => {
+  if (!sorters || sorters.length === 0) return rows
+  const [{ field, order }] = sorters
+  if (!order) return rows
+  return [...rows].sort((a, b) => {
+    const direction = order === "asc" ? 1 : -1
+    const getValue = (record: ClientAccountRow) => {
+      switch (field) {
+        case "name":
+          return record.name
+        case "email":
+          return record.email
+        case "jobTitle":
+          return record.jobTitle
+        case "status":
+          return record.status
+        case "companyName":
+        case "company.id":
+        case "company.name":
+          return record.company.name
+        default:
+          return record.name
+      }
+    }
+    const aValue = getValue(a)
+    const bValue = getValue(b)
+    return aValue.localeCompare(bValue, undefined, { sensitivity: "base" }) * direction
+  })
+}
+
 const refineDataProvider: DataProvider = {
   getApiUrl: () => "/api",
-  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters }) => {
+  getList: async <TData extends BaseRecord = BaseRecord>({
+    resource,
+    pagination,
+    sorters,
+    filters,
+  }) => {
     if (resource !== "client-directory") {
-      return { data: [], total: 0 }
+      return { data: [], total: 0 } as GetListResponse<TData>
     }
 
     const response = await fetch("/api/client-directory", { credentials: "include" })
@@ -44,35 +288,22 @@ const refineDataProvider: DataProvider = {
     }
 
     const payload = await response.json()
-    const items: Array<ClientDirectoryRecord & { id: string }> = payload.data ?? []
-    const total = typeof payload.total === "number" ? payload.total : items.length
+    const rawItems: Array<ClientDirectoryRecord & { id?: string }> = payload.data ?? []
+    const normalized = rawItems.map((entry, index) => normalizeRecord({ ...entry, id: entry.id }, index))
+    directoryCache.records = normalized
 
-    const current = typeof pagination?.current === "number" ? pagination.current : 1
-    const pageSize = typeof pagination?.pageSize === "number" ? pagination.pageSize : total
-    const start = (current - 1) * pageSize
-    const end = start + pageSize
-
-    let sorted = items
-    if (sorters && sorters.length > 0) {
-      const [{ field, order }] = sorters
-      sorted = [...items].sort((a: any, b: any) => {
-        const aValue = a[field as keyof typeof a]
-        const bValue = b[field as keyof typeof b]
-        if (aValue == null && bValue == null) return 0
-        if (aValue == null) return order === "asc" ? -1 : 1
-        if (bValue == null) return order === "asc" ? 1 : -1
-        if (aValue < bValue) return order === "asc" ? -1 : 1
-        if (aValue > bValue) return order === "asc" ? 1 : -1
-        return 0
-      })
-    }
+    const filtered = applyFilters(normalized, filters)
+    const sorted = applySorting(filtered, sorters)
 
-    const page = sorted.slice(start, end)
+    const current = pagination?.current ?? 1
+    const pageSize = pagination?.pageSize ?? 12
+    const start = (current - 1) * pageSize
+    const paginated = sorted.slice(start, start + pageSize)
 
     return {
-      data: page as unknown as TData[],
-      total,
-    } as GetListResponse<TData>
+      data: paginated as unknown as TData[],
+      total: sorted.length,
+    }
   },
   getOne: () => Promise.reject(new Error("Not implemented")),
   getMany: () => Promise.reject(new Error("Not implemented")),
@@ -84,140 +315,663 @@ const refineDataProvider: DataProvider = {
   createMany: () => Promise.reject(new Error("Not implemented")),
 }
 
-const ClientAccountsGallery = memo(() => {
-  const { query, result } = useList<ClientDirectoryRecord & { id: string }>({
+const ContactStatusTag = ({ status }: { status: ContactStatus }) => {
+  const style = statusStyles[status]
+  return (
+    <Tag color={style.color} style={{ textTransform: "capitalize" }}>
+      <Space size={4}>
+        {style.icon}
+        {style.label}
+      </Space>
+    </Tag>
+  )
+}
+
+const CustomAvatar = ({ seed, name }: { seed: string; name: string }) => (
+  <Avatar style={{ backgroundColor: getAvatarColor(seed) }}>{getInitials(name)}</Avatar>
+)
+
+type ViewMode = "table" | "card"
+
+type TableViewProps = {
+  tableProps: TableProps<ClientAccountRow>
+  companyOptions: Array<{ value: string; label: string }>
+}
+
+const ClientAccountsTable = ({ tableProps, companyOptions }: TableViewProps) => (
+  <List
+    breadcrumb={false}
+    contentProps={{
+      style: {
+        marginTop: 28,
+      },
+    }}
+    title={<AddClientAction />}
+  >
+      <TableContent tableProps={tableProps} companyOptions={companyOptions} />
+  </List>
+)
+
+type TableContentProps = {
+  tableProps: TableProps<ClientAccountRow>
+  companyOptions: Array<{ value: string; label: string }>
+}
+
+const TableContent = ({ tableProps, companyOptions }: TableContentProps) => (
+  <Table<ClientAccountRow>
+    {...tableProps}
+    rowKey="id"
+    pagination={{
+      ...tableProps.pagination,
+      pageSizeOptions: ["12", "24", "48", "96"],
+      showTotal: (total) => <PaginationSummary total={total} />, 
+    }}
+  >
+    <Table.Column<ClientAccountRow>
+      dataIndex="name"
+      title="Name"
+      width={220}
+      render={(_, record) => (
+        <Space>
+          <CustomAvatar seed={record.avatarSeed} name={record.name} />
+          <div>
+            <Text strong>{record.name}</Text>
+            <div>
+              <Text type="secondary">{record.email}</Text>
+            </div>
+          </div>
+        </Space>
+      )}
+      filterDropdown={(props) => (
+        <FilterDropdown {...props}>
+          <Input placeholder="Search Name" />
+        </FilterDropdown>
+      )}
+    />
+    <Table.Column<ClientAccountRow>
+      dataIndex="email"
+      title="Email"
+      filterDropdown={(props) => (
+        <FilterDropdown {...props}>
+          <Input placeholder="Search Email" />
+        </FilterDropdown>
+      )}
+      render={(_, record) => <Text>{record.email}</Text>}
+    />
+    <Table.Column<ClientAccountRow>
+      dataIndex={["company", "name"]}
+      title="Company"
+      filterDropdown={(props) => (
+        <FilterDropdown {...props}>
+          <Select
+            placeholder="Search Company"
+            style={{ width: 220 }}
+            showSearch
+            options={companyOptions}
+            filterOption={(input, option) =>
+              (option?.label as string).toLowerCase().includes(input.toLowerCase())
+            }
+          />
+        </FilterDropdown>
+      )}
+    />
+    <Table.Column<ClientAccountRow>
+      dataIndex="jobTitle"
+      title="Title"
+      filterDropdown={(props) => (
+        <FilterDropdown {...props}>
+          <Input placeholder="Search Title" />
+        </FilterDropdown>
+      )}
+      render={(_, record) => <Text>{record.jobTitle}</Text>}
+    />
+    <Table.Column<ClientAccountRow>
+      dataIndex="status"
+      title="Status"
+      filterDropdown={(props) => (
+        <FilterDropdown {...props}>
+          <Select
+            mode="multiple"
+            allowClear
+            style={{ width: 240 }}
+            placeholder="Filter Status"
+            options={clientStatuses.map((status) => ({
+              label: statusStyles[status].label,
+              value: status,
+            }))}
+          />
+        </FilterDropdown>
+      )}
+      render={(value: ContactStatus) => <ContactStatusTag status={value} />}
+    />
+    <Table.Column<ClientAccountRow>
+      title="Actions"
+      fixed="right"
+      align="right"
+      render={(_, record) => (
+        <Space>
+          <Tooltip title="View details">
+            <Button type="text" size="small" icon={<EyeOutlined />} />
+          </Tooltip>
+          <Tooltip title="Send email">
+            <Button type="text" size="small" icon={<MailOutlined />} />
+          </Tooltip>
+          <Tooltip title="Call">
+            <Button type="text" size="small" icon={<PhoneOutlined />} />
+          </Tooltip>
+        </Space>
+      )}
+    />
+  </Table>
+)
+
+type CardGridProps = {
+  tableProps: TableProps<ClientAccountRow>
+  setCurrentPage: (page: number) => void
+  setPageSize: (size: number) => void
+}
+
+const ClientCards = ({
+  tableProps: { dataSource, pagination, loading },
+  setCurrentPage,
+  setPageSize,
+}: CardGridProps) => {
+  const data = useMemo(() => dataSource ?? [], [dataSource])
+  const isLoading = useMemo(() => {
+    if (typeof loading === "boolean") {
+      return loading
+    }
+    if (!loading) {
+      return false
+    }
+    if (typeof loading === "object" && "spinning" in loading) {
+      return Boolean(loading.spinning)
+    }
+    return Boolean(loading)
+  }, [loading])
+  const paginationConfig = pagination && typeof pagination === "object" ? pagination : undefined
+  const current = paginationConfig?.current ?? 1
+  const pageSize = paginationConfig?.pageSize ?? 12
+  const total = paginationConfig?.total ?? data.length
+
+  return (
+    <List
+      breadcrumb={false}
+      title={<AddClientAction />}
+      contentProps={{
+        style: {
+          marginTop: 28,
+        },
+      }}
+    >
+      <div
+        style={{
+          display: "grid",
+          gap: 24,
+          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
+        }}
+      >
+        {(isLoading
+          ? Array.from({ length: 12 }).map((_, index) => ({ ...placeholderCard, id: `placeholder-${index}` }))
+          : data
+        ).map(
+          (record) => (
+            <ClientCard key={record.id} record={record} loading={isLoading} />
+          ),
+        )}
+      </div>
+      <div
+        style={{
+          display: "flex",
+          justifyContent: "flex-end",
+          marginTop: 24,
+        }}
+      >
+        <Pagination
+          current={current}
+          pageSize={pageSize}
+          total={total}
+          hideOnSinglePage
+          pageSizeOptions={["12", "24", "48"]}
+          showLessItems
+          showSizeChanger
+          showTotal={(count) => <PaginationSummary total={count} />}
+          onChange={(page, nextPageSize) => {
+            setCurrentPage(page)
+            setPageSize(nextPageSize ?? pageSize)
+          }}
+        />
+      </div>
+    </List>
+  )
+}
+
+const placeholderCard: ClientAccountRow = {
+  id: "placeholder",
+  name: "Loading",
+  email: "loading@example.com",
+  jobTitle: "Loading",
+  phone: "N/A",
+  region: "N/A",
+  company: { id: "placeholder", name: "Loading" },
+  status: "NEW",
+  avatarSeed: "Loading",
+}
+
+type ClientCardProps = {
+  record: ClientAccountRow
+  loading?: boolean
+}
+
+const CardSection = ({ title, value }: { title: string; value: string }) => (
+  <div>
+    <Text type="secondary" style={{ display: "block", textTransform: "uppercase", fontSize: 12 }}>
+      {title}
+    </Text>
+    <Text strong>{value}</Text>
+  </div>
+)
+
+const ClientCard = ({ record, loading }: ClientCardProps) => (
+  <div
+    style={{
+      display: "flex",
+      flexDirection: "column",
+      borderRadius: 12,
+      background: "#fff",
+      boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
+      minHeight: 260,
+      position: "relative",
+      overflow: "hidden",
+    }}
+  >
+    <div
+      style={{
+        position: "absolute",
+        top: 12,
+        right: 12,
+      }}
+    >
+      <Tooltip title="More actions">
+        <Button type="text" icon={<EllipsisOutlined />} />
+      </Tooltip>
+    </div>
+    <div
+      style={{
+        padding: "32px 24px 16px",
+        display: "flex",
+        flexDirection: "column",
+        alignItems: "center",
+        gap: 12,
+        textAlign: "center",
+      }}
+    >
+      <Avatar size={64} style={{ backgroundColor: getAvatarColor(record.avatarSeed) }}>
+        {getInitials(record.name)}
+      </Avatar>
+      <div>
+        <Text strong style={{ fontSize: 18 }}>
+          {loading ? "Loading" : record.name}
+        </Text>
+        <div>
+          <Text type="secondary">{loading ? "" : record.email}</Text>
+        </div>
+      </div>
+      <ContactStatusTag status={record.status} />
+    </div>
+    <div
+      style={{
+        padding: "16px 24px",
+        borderTop: "1px solid #edf1f4",
+        display: "grid",
+        gap: 12,
+      }}
+    >
+      <CardSection title="Job title" value={loading ? "N/A" : record.jobTitle} />
+      <CardSection title="Company" value={record.company.name} />
```
