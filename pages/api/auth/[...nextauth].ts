import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import {
  firebaseAdminAuth,
  firebaseAdminConfigStatus,
} from '../../../lib/firebaseAdmin'
import { loadSecrets } from '../../../lib/server/secretManager'

async function buildAuthOptions(): Promise<NextAuthOptions> {
  const { secrets } = await loadSecrets()


  const providers = [
      CredentialsProvider({
        name: 'Firebase',
        credentials: {
          idToken: { label: 'Firebase ID Token', type: 'text' },
          accessToken: { label: 'Google Access Token', type: 'text' },
          refreshToken: { label: 'Google Refresh Token', type: 'text' },
        },
        async authorize(credentials) {
          // Development bypass: allow sign-in without Firebase Admin credentials
          // Set DEV_AUTH_BYPASS=1 in .env.local to enable. LOCAL ONLY.
          if (process.env.DEV_AUTH_BYPASS === '1') {
            const devUser = {
              id: 'dev-user',
              name: 'Dev User',
              email: 'dev@example.com',
              image: null,
              firebase: {
                claims: { devBypass: true },
                idToken: credentials?.idToken ?? null,
              },
              google: {
                accessToken: credentials?.accessToken ?? null,
                refreshToken: credentials?.refreshToken ?? null,
              },
            } as any
            return devUser
          }

          if (!credentials?.idToken) {
            throw new Error('Missing Firebase ID token')
          }

          if (firebaseAdminConfigStatus.credentialSource !== 'service-account') {
            throw new Error(
              'Firebase Admin credentials are missing or incomplete. Please configure FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.'
            )
          }

          try {
            const decoded = await firebaseAdminAuth.verifyIdToken(credentials.idToken)
            const userRecord = await firebaseAdminAuth
              .getUser(decoded.uid)
              .catch(() => null)

            return {
              id: decoded.uid,
              name: userRecord?.displayName ?? decoded.name ?? null,
              email: userRecord?.email ?? decoded.email ?? null,
              image: userRecord?.photoURL ?? decoded.picture ?? null,
              firebase: {
                claims: decoded,
                idToken: credentials.idToken,
              },
              google: {
                accessToken: credentials.accessToken ?? null,
                refreshToken: credentials.refreshToken ?? null,
              },
            } as any
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? `Firebase token verification failed: ${error.message}`
                : 'Firebase token verification failed'
            console.error('[auth] Failed to verify Firebase ID token', error)
            throw new Error(errorMessage)
          }
        },
      }),
    ] as NextAuthOptions['providers']

  // Discord web OAuth removed

  return {
    providers,
    pages: {
      signIn: '/auth/signin',
    },
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const typedUser = user as any
          token.user = {
            id: typedUser.id,
            name: typedUser.name,
            email: typedUser.email,
            image: typedUser.image,
          }
          token.firebase = typedUser.firebase
          token.google = typedUser.google
        }
        return token
      },
      async session({ session, token }) {
        const typedSession = session as any
        typedSession.user = token.user ?? session.user
        typedSession.firebase = token.firebase ?? null
        typedSession.google = token.google ?? null
        return session
      },
    },
    secret: secrets.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
  }
}

let cachedOptions: NextAuthOptions | null = null

export async function getAuthOptions(): Promise<NextAuthOptions> {
  if (!cachedOptions) {
    cachedOptions = await buildAuthOptions()
  }
  return cachedOptions
}

export default async function auth(req, res) {
  const options = await getAuthOptions()
  return NextAuth(req, res, options)
}
