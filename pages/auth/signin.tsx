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
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'

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

const buttonStyles = {
  height: 48,
  justifyContent: 'center',
  textTransform: 'none' as const,
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
    }
  }, [status, router])

  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider()
    provider.addScope('https://www.googleapis.com/auth/drive')
    provider.addScope('https://www.googleapis.com/auth/spreadsheets')
    provider.setCustomParameters({ prompt: 'consent', access_type: 'offline' })
    return provider
  }, [])

  const diagnoseCredentialFailure = useCallback(async (idToken: string) => {
    try {
      const response = await fetch('/api/auth/firebase-diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!response.ok) {
        return null
      }

      const data = (await response.json()) as FirebaseDiagnosticsResponse

      if (data.ok) {
        return 'Firebase Admin accepted the token when retried directly, but NextAuth still rejected the exchange. Check the server logs for additional context.'
      }

      const failure = data as Extract<FirebaseDiagnosticsResponse, { ok: false }>
      const messageParts: string[] = []

      if (failure.message) {
        messageParts.push(failure.message)
      }

      if (failure.code) {
        messageParts.push(`(code: ${failure.code})`)
      }

      const { config } = failure
      if (config) {
        if (config.credentialSource !== 'service-account') {
          messageParts.push(
            'Firebase Admin is running without service-account credentials. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.'
          )
        } else {
          const missing: string[] = []
          if (!config.hasProjectId) missing.push('FIREBASE_ADMIN_PROJECT_ID')
          if (!config.hasClientEmail) missing.push('FIREBASE_ADMIN_CLIENT_EMAIL')
          if (!config.hasPrivateKey) missing.push('FIREBASE_ADMIN_PRIVATE_KEY')

          if (missing.length) {
            messageParts.push(`Missing environment variables: ${missing.join(', ')}`)
          }
        }
      }

      return messageParts.join(' ')
    } catch (diagnosticError) {
      console.error('[auth] Failed to run Firebase diagnostics', diagnosticError)
      return null
    }
  }, [])

  const completeNextAuth = async (params: {
    idToken: string
    accessToken?: string | null
    refreshToken?: string | null
  }) => {
    const response = await signIn('credentials', {
      idToken: params.idToken,
      accessToken: params.accessToken ?? '',
      refreshToken: params.refreshToken ?? '',
      redirect: false,
    })

    if (!response) {
      throw new Error('No response from authentication service')
    }

    if (response.error) {
      console.error('[auth] NextAuth credential exchange failed', response)
      let mappedError = response.error

      if (response.error === 'CredentialsSignin') {
        mappedError =
          (await diagnoseCredentialFailure(params.idToken)) ??
          'Google sign-in was rejected by the server. Please verify the Firebase Admin environment variables.'
      }

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
      <Container maxWidth='sm' sx={{ display: 'flex', minHeight: '100vh', alignItems: 'center' }}>
        <Box sx={{ width: '100%', py: 6 }}>
          <Typography variant='h4' fontWeight={600} gutterBottom>
            Welcome back
          </Typography>
          <Typography variant='body1' color='text.secondary' sx={{ mb: 4 }}>
            Sign in with Google or your email to continue.
          </Typography>

          {error && (
            <Alert severity='error' sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={2}>
            <Button
              onClick={handleGoogleSignIn}
              variant='contained'
              color='primary'
              disabled={submitting}
              sx={buttonStyles}
            >
              Continue with Google
            </Button>

            <Divider>or</Divider>

            <Stack spacing={2}>
              <TextField
                label='Email'
                type='email'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                fullWidth
                required
              />
              <TextField
                label='Password'
                type='password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                required
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  fullWidth
                  variant='contained'
                  disabled={submitting}
                  onClick={() => handleEmailAuth('signIn')}
                  sx={buttonStyles}
                >
                  Sign in
                </Button>
                <Button
                  fullWidth
                  variant='outlined'
                  disabled={submitting}
                  onClick={() => handleEmailAuth('signUp')}
                  sx={buttonStyles}
                >
                  Create account
                </Button>
              </Stack>
            </Stack>
          </Stack>

          <Typography variant='caption' color='text.secondary' sx={{ mt: 4, display: 'block' }}>
            By signing in you agree to the Establish Productions internal use policy. Problems signing in? Contact
            <Link href='mailto:support@establish.com'>{' support@establish.com'}</Link>.
          </Typography>
        </Box>
      </Container>
    </>
  )
}
