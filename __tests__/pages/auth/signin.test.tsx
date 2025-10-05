/** @jest-environment jsdom */

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('next/router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}))

const mockSignIn = jest.fn()

jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  useSession: () => ({ status: 'unauthenticated' }),
}))

const mockCredentialFromResult = jest.fn()
const mockSignInWithPopup = jest.fn()

jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: Object.assign(
    function GoogleAuthProvider(this: any) {
      this.addScope = jest.fn()
      this.setCustomParameters = jest.fn()
    },
    {
      credentialFromResult: (...args: unknown[]) => mockCredentialFromResult(...args),
    }
  ),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
}))

jest.mock('../../../lib/firebaseClientAuth', () => ({
  auth: {},
}))

describe('SignInPage Google diagnostics', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    mockSignIn.mockReset()
    mockSignInWithPopup.mockReset()
    mockCredentialFromResult.mockReset()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as Record<string, unknown>).fetch
    consoleErrorSpy.mockRestore()
  })

  it('surfaces NextAuth diagnostics failures ahead of other messaging', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        getIdToken: jest.fn().mockResolvedValue('id-token'),
        refreshToken: 'refresh-token',
      },
    })

    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })

    mockSignIn.mockResolvedValue({
      error: 'CredentialsSignin',
      ok: false,
      status: 401,
    })

    const nextAuthDiagnosticsMessage = 'NextAuth authorize exploded'

    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('nextauth-credentials-diagnostics')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: false, message: nextAuthDiagnosticsMessage, name: 'AuthorizeError' }),
          })
        }

        if (url.includes('firebase-diagnostics')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }),
          })
        }

        throw new Error(`Unexpected fetch call to ${url}`)
      }) as unknown as typeof fetch

    const { default: SignInPage } = await import('../../../pages/auth/signin')

    render(<SignInPage />)

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthDiagnosticsMessage)
    })
  })

  it('combines diagnostics when both Firebase and NextAuth accept the credentials', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        getIdToken: jest.fn().mockResolvedValue('id-token'),
        refreshToken: 'refresh-token',
      },
    })

    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })

    mockSignIn.mockResolvedValue({
      error: 'CredentialsSignin',
      ok: false,
      status: 401,
    })

    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('nextauth-credentials-diagnostics')) {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true }) })
        }

        if (url.includes('firebase-diagnostics')) {
          return Promise.resolve({ ok: true, json: async () => ({ ok: true, uid: 'uid', projectId: 'project' }) })
        }

        throw new Error(`Unexpected fetch call to ${url}`)
      }) as unknown as typeof fetch

    const { default: SignInPage } = await import('../../../pages/auth/signin')

    render(<SignInPage />)

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'NextAuth authorize() and Firebase Admin both accepted the credentials when retried directly, but the sign-in endpoint still responded with "CredentialsSignin". Check the server logs for callback or session errors.'
      )
    })
  })

  it('falls back to NextAuth error when diagnostics return nothing', async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: {
        getIdToken: jest.fn().mockResolvedValue('id-token'),
        refreshToken: 'refresh-token',
      },
    })

    mockCredentialFromResult.mockReturnValue({ accessToken: 'access-token' })

    const nextAuthError = 'Server rejected credentials'

    mockSignIn.mockResolvedValue({
      error: nextAuthError,
      ok: false,
      status: 401,
    })

    global.fetch = jest
      .fn()
      .mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('nextauth-credentials-diagnostics')) {
          return Promise.resolve({ ok: false })
        }

        if (url.includes('firebase-diagnostics')) {
          return Promise.resolve({ ok: false })
        }

        throw new Error(`Unexpected fetch call to ${url}`)
      }) as unknown as typeof fetch

    const { default: SignInPage } = await import('../../../pages/auth/signin')

    render(<SignInPage />)

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(nextAuthError)
    })
  })
})
