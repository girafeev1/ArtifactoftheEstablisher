import { useCallback, useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth } from '../../lib/firebaseClientAuth'
import { signIn, useSession } from 'next-auth/react'
import { Alert, Button, Divider, Input, Space, Typography } from 'antd'

const { Title, Text, Link } = Typography

type FirebaseDiagnosticsResponse =
  | { ok: true; uid: string; projectId: string | null }
  | {
      ok: false
      message: string
      code?: string
      config: {
        hasProjectId: boolean
        hasClientEmail: boolean
        hasPrivateKey: boolean
        credentialSource: 'service-account' | 'default'
      }
    }

type FirebaseDiagnosticsResult =
  | { status: 'success'; projectId: string | null }
  | { status: 'failure'; message: string }
  | { status: 'unavailable' }

type NextAuthDiagnosticsResponse =
  | { ok: true }
  | { ok: false; message?: string; name?: string }

type NextAuthDiagnosticsResult =
  | { status: 'success' }
  | { status: 'failure'; message: string }
  | { status: 'unavailable' }

type CredentialExchangeParams = {
  idToken: string
  accessToken?: string | null
  refreshToken?: string | null
}

const buttonStyle: React.CSSProperties = {
  height: 48,
  fontWeight: 600,
}

export default function SignInPage() {
  const router = useRouter()
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      void router.replace('/')
      return
    }
    // Strip leftover provider error param (e.g., error=google) from URL to avoid
    // polluting NextAuth signIn('credentials') result.
    if (router.isReady && typeof router.query.error === 'string') {
      const { callbackUrl } = router.query
      void router.replace(
        {
          pathname: router.pathname,
          query: callbackUrl ? { callbackUrl } : undefined,
        },
        undefined,
        { shallow: true },
      )
    }
  }, [status, router])

  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/drive')
    provider.addScope('https://www.googleapis.com/auth/spreadsheets')
    provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' })
    return provider
  }, [])

  const runFirebaseDiagnostics = useCallback(async (idToken: string): Promise<FirebaseDiagnosticsResult> => {
    try {
      const response = await fetch('/api/auth/firebase-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        return { status: 'unavailable' }
      }

      const data = (await response.json()) as FirebaseDiagnosticsResponse

      if (data.ok) {
        return { status: 'success', projectId: data.projectId ?? null }
      }

      const messageParts: string[] = []

      if ('message' in data && data.message) {
        messageParts.push(data.message)
      }

      if ('code' in data && data.code) {
        messageParts.push(`(code: ${data.code})`)
      }

      if ('config' in data && data.config) {
        if (data.config.credentialSource !== 'service-account') {
          messageParts.push(
            'Firebase Admin is running without service-account credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.'
          )
        } else {
          const missing: string[] = []
          if (!data.config.hasProjectId) missing.push('FIREBASE_ADMIN_PROJECT_ID')
          if (!data.config.hasClientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL')
          if (!data.config.hasPrivateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY')

          if (missing.length) {
            messageParts.push(`Missing environment variables: ${missing.join(', ')}`)
          }
        }
      }

      if (messageParts.length) {
        return { status: 'failure', message: messageParts.join(' ') }
      }

      return {
        status: 'failure',
        message: 'Firebase diagnostics returned an error without details.',
      }
    } catch (diagnosticError) {
      console.error('[auth] Failed to run Firebase diagnostics', diagnosticError)
      return { status: 'unavailable' }
    }
  }, [])

  const runNextAuthDiagnostics = useCallback(
    async (params: CredentialExchangeParams): Promise<NextAuthDiagnosticsResult> => {
      try {
        const response = await fetch('/api/auth/nextauth-credentials-diagnostics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: params.idToken,
            accessToken: params.accessToken ?? undefined,
            refreshToken: params.refreshToken ?? undefined,
          }),
        })

        if (!response.ok) {
          return { status: 'unavailable' }
        }

        const data = (await response.json()) as NextAuthDiagnosticsResponse

        if (data.ok) {
          return { status: 'success' }
        }

        const messageParts: string[] = []
        if ('message' in data && data.message) {
          messageParts.push(data.message)
        }

        if ('name' in data && data.name) {
          messageParts.push(`(${data.name})`)
        }

        if (messageParts.length) {
          return { status: 'failure', message: messageParts.join(' ') }
        }

        return {
          status: 'failure',
          message: 'NextAuth diagnostics returned an error without details.',
        }
      } catch (diagnosticError) {
        console.error('[auth] Failed to run NextAuth diagnostics', diagnosticError)
        return { status: 'unavailable' }
      }
    },
    []
  )

  const diagnoseCredentialFailure = useCallback(
    async (params: CredentialExchangeParams, responseError?: string | null) => {
      const [nextAuthDiagnostics, firebaseDiagnostics] = await Promise.all([
        runNextAuthDiagnostics(params),
        runFirebaseDiagnostics(params.idToken),
      ])

      if (nextAuthDiagnostics.status === 'failure') {
        return nextAuthDiagnostics.message
      }

      if (firebaseDiagnostics.status === 'failure') {
        return firebaseDiagnostics.message
      }

      const quotedError = responseError ? `"${responseError}"` : 'an unspecified error'

      if (nextAuthDiagnostics.status === 'success' && firebaseDiagnostics.status === 'success') {
        return `NextAuth authorize() and Firebase Admin both accepted the credentials when retried directly, but the sign-in endpoint still responded with ${quotedError}. Check the server logs for callback or session errors.`
      }

      if (nextAuthDiagnostics.status === 'success') {
        return `NextAuth authorize() accepted the credentials when retried directly, but the sign-in endpoint still responded with ${quotedError}. Check the server logs for callback or session errors.`
      }

      if (firebaseDiagnostics.status === 'success') {
        return 'Firebase Admin accepted the token when retried directly, but NextAuth still rejected the exchange. Check the server logs for additional context.'
      }

      return null
    },
    [runFirebaseDiagnostics, runNextAuthDiagnostics]
  )

  const completeNextAuth = async (params: CredentialExchangeParams) => {
    const response = await signIn('credentials', {
      idToken: params.idToken,
      accessToken: params.accessToken ?? '',
      refreshToken: params.refreshToken ?? '',
      redirect: false,
    })

    if (!response) {
      throw new Error('No response from authentication service')
    }

    // Some URLs may retain a stale ?error=... query from an earlier redirect.
    // Treat as failure only if NextAuth reports ok === false or status >= 400.
    if ((response.ok === false) || (!!response.error && response.status && response.status >= 400)) {
      console.error('[auth] NextAuth credential exchange failed', response)
      const diagnosticMessage = await diagnoseCredentialFailure(params, response.error)
      const mappedError =
        diagnosticMessage ??
        response.error ??
        'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'

      throw new Error(mappedError)
    }

    await router.replace(response.url ?? '/')
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const idToken = await result.user.getIdToken()
      await completeNextAuth({
        idToken,
        accessToken: credential?.accessToken ?? null,
        refreshToken: result.user.refreshToken ?? null,
      })
    } catch (err: any) {
      console.error('[auth] Google sign-in failed', err)
      setError(err.message ?? 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Discord web login intentionally disabled (mobile Discord app will be used via bot)

  const handleEmailAuth = async (mode: 'signIn' | 'signUp') => {
    setError(null)
    setSubmitting(true)
    try {
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      if (mode === 'signUp') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }

      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('No authenticated user returned from Firebase')
      }

      const idToken = await currentUser.getIdToken()
      await completeNextAuth({ idToken })
    } catch (err: any) {
      console.error('[auth] Email authentication failed', err)
      setError(err.message ?? 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign in · Establish Portal</title>
      </Head>
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          padding: '0 16px',
        }}
      >
        <div style={{ width: '100%', paddingTop: 48, paddingBottom: 48 }}>
          <Title level={3} style={{ fontWeight: 600, marginBottom: 8 }}>
            Welcome back
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 32 }}>
            Sign in with Google or your email to continue.
          </Text>

          {error && (
            <Alert
              type="error"
              message={error}
              style={{ marginBottom: 24 }}
              showIcon
            />
          )}

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              onClick={handleGoogleSignIn}
              type="primary"
              disabled={submitting}
              block
              style={buttonStyle}
            >
              Continue with Google
            </Button>

            <Divider plain>or</Divider>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                size="large"
              />
              <Input.Password
                placeholder="Password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                size="large"
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <Button
                  type="primary"
                  disabled={submitting}
                  onClick={() => handleEmailAuth('signIn')}
                  style={{ ...buttonStyle, flex: 1 }}
                >
                  Sign in
                </Button>
                <Button
                  disabled={submitting}
                  onClick={() => handleEmailAuth('signUp')}
                  style={{ ...buttonStyle, flex: 1 }}
                >
                  Create account
                </Button>
              </div>
            </Space>
          </Space>

          <Text type="secondary" style={{ marginTop: 32, display: 'block', fontSize: 12 }}>
            By signing in you agree to the Establish Productions internal use policy. Problems signing in? Contact
            <Link href="mailto:support@establish.com">{' support@establish.com'}</Link>.
          </Text>
        </div>
      </div>
    </>
  )
}
