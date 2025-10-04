import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import { firebaseAdminAuth } from '../../../lib/firebaseAdmin'
import { loadSecrets } from '../../../lib/server/secretManager'

async function buildAuthOptions(): Promise<NextAuthOptions> {
  const { secrets } = await loadSecrets()

  return {
    providers: [
      CredentialsProvider({
        name: 'Firebase',
        credentials: {
          idToken: { label: 'Firebase ID Token', type: 'text' },
          accessToken: { label: 'Google Access Token', type: 'text' },
          refreshToken: { label: 'Google Refresh Token', type: 'text' },
        },
        async authorize(credentials) {
          if (!credentials?.idToken) {
            throw new Error('Missing Firebase ID token')
          }

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
        },
      }),
    ],
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
