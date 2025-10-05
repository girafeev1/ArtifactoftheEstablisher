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
  beforeEach(() => {
    mockSignIn.mockReset()
    mockSignInWithPopup.mockReset()
    mockCredentialFromResult.mockReset()
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (global as Record<string, unknown>).fetch
  })

  it('shows diagnostic message when credentials sign-in fails', async () => {
    const diagnosticMessage = 'Detailed Firebase diagnostics message'

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

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, message: diagnosticMessage }),
    }) as unknown as typeof fetch

    const { default: SignInPage } = await import('../../../pages/auth/signin')

    render(<SignInPage />)

    const googleButton = screen.getByRole('button', { name: /continue with google/i })
    fireEvent.click(googleButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(diagnosticMessage)
    })
  })
})
