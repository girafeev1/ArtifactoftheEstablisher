# PR #258 — Diff Summary

- **Base (target)**: `332da4bfa690be735d61edd798182f78d1fddcf8`
- **Head (source)**: `aac922c0b48fa113df124a856bbc572f789fa6a2`
- **Repo**: `girafeev1/ArtifactoftheEstablisher`

## Changed Files

```txt
A	__tests__/pages/auth/signin.test.tsx
M	pages/auth/signin.tsx
```

## Stats

```txt
 __tests__/pages/auth/signin.test.tsx | 87 ++++++++++++++++++++++++++++++++++++
 pages/auth/signin.tsx                | 12 +++--
 2 files changed, 92 insertions(+), 7 deletions(-)
```

## Unified Diff (truncated to first 4000 lines)

```diff
diff --git a/__tests__/pages/auth/signin.test.tsx b/__tests__/pages/auth/signin.test.tsx
new file mode 100644
index 0000000..15e9d2d
--- /dev/null
+++ b/__tests__/pages/auth/signin.test.tsx
@@ -0,0 +1,87 @@
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
+  beforeEach(() => {
+    mockSignIn.mockReset()
+    mockSignInWithPopup.mockReset()
+    mockCredentialFromResult.mockReset()
+  })
+
+  afterEach(() => {
+    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
+    delete (global as Record<string, unknown>).fetch
+  })
+
+  it('shows diagnostic message when credentials sign-in fails', async () => {
+    const diagnosticMessage = 'Detailed Firebase diagnostics message'
+
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
+    global.fetch = jest.fn().mockResolvedValue({
+      ok: true,
+      json: async () => ({ ok: false, message: diagnosticMessage }),
+    }) as unknown as typeof fetch
+
+    const { default: SignInPage } = await import('../../../pages/auth/signin')
+
+    render(<SignInPage />)
+
+    const googleButton = screen.getByRole('button', { name: /continue with google/i })
+    fireEvent.click(googleButton)
+
+    await waitFor(() => {
+      expect(screen.getByRole('alert')).toHaveTextContent(diagnosticMessage)
+    })
+  })
+})
diff --git a/pages/auth/signin.tsx b/pages/auth/signin.tsx
index bed353d..3aa3a23 100644
--- a/pages/auth/signin.tsx
+++ b/pages/auth/signin.tsx
@@ -134,13 +134,11 @@ export default function SignInPage() {
 
     if (response.error) {
       console.error('[auth] NextAuth credential exchange failed', response)
-      let mappedError = response.error
-
-      if (response.error === 'CredentialsSignin') {
-        mappedError =
-          (await diagnoseCredentialFailure(params.idToken)) ??
-          'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'
-      }
+      const diagnosticMessage = await diagnoseCredentialFailure(params.idToken)
+      const mappedError =
+        diagnosticMessage ??
+        response.error ??
+        'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'
 
       throw new Error(mappedError)
     }
```
