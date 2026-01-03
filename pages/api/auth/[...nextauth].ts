import type { NextApiRequest, NextApiResponse } from 'next'
import type { NextAuthOptions } from 'next-auth'
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import {
  firebaseAdminAuth,
  firebaseAdminConfigStatus,
} from '../../../lib/firebaseAdmin'
import { loadSecrets } from '../../../lib/server/secretManager'
import {
  getOrCreateUserProfile,
  getUserCustomClaims,
  CREATE_PROFILES_WHEN_DISABLED,
} from '../../../lib/rbac'
import type { UserRole, UserStatus } from '../../../lib/rbac/types'

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
              // RBAC: dev user is admin
              role: 'admin' as UserRole,
              status: 'active' as UserStatus,
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

            // Get or create RBAC user profile
            let role: UserRole = 'pending'
            let status: UserStatus = 'pending'
            let vendorProjectIds: string[] | undefined
            let vendorExpiresAt: number | undefined

            if (CREATE_PROFILES_WHEN_DISABLED) {
              try {
                const { profile, created } = await getOrCreateUserProfile({
                  uid: decoded.uid,
                  email: userRecord?.email ?? decoded.email ?? '',
                  displayName: userRecord?.displayName ?? decoded.name ?? null,
                  photoURL: userRecord?.photoURL ?? decoded.picture ?? null,
                })

                role = profile.role
                status = profile.status

                if (profile.role === 'vendor' && profile.vendorAccess) {
                  vendorProjectIds = profile.vendorAccess.projectIds
                  if (profile.vendorAccess.expiresAt) {
                    vendorExpiresAt = profile.vendorAccess.expiresAt.toMillis()
                  }
                }

                if (created) {
                  console.log(`[auth] Created new user profile for ${decoded.uid}`)
                }
              } catch (profileError) {
                console.error('[auth] Failed to get/create user profile:', profileError)
                // Continue with default pending status
              }
            } else {
              // Try to get existing claims
              const claims = await getUserCustomClaims(decoded.uid)
              if (claims) {
                role = claims.role
                status = claims.status
                vendorProjectIds = claims.vendorProjectIds
                vendorExpiresAt = claims.vendorExpiresAt
              }
            }

            return {
              id: decoded.uid,
              name: userRecord?.displayName ?? decoded.name ?? null,
              email: userRecord?.email ?? decoded.email ?? null,
              image: userRecord?.photoURL ?? decoded.picture ?? null,
              // RBAC fields
              role,
              status,
              vendorProjectIds,
              vendorExpiresAt,
              // Legacy fields
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
            name: typedUser.name ?? null,
            email: typedUser.email ?? null,
            image: typedUser.image ?? null,
            // RBAC fields - use null instead of undefined for serialization
            role: typedUser.role ?? null,
            status: typedUser.status ?? null,
            vendorProjectIds: typedUser.vendorProjectIds ?? null,
            vendorExpiresAt: typedUser.vendorExpiresAt ?? null,
          }
        }
        return token
      },
      async session({ session, token }) {
        if (token.user) {
          session.user = {
            id: token.user.id,
            name: token.user.name ?? null,
            email: token.user.email ?? null,
            image: token.user.image ?? null,
            // RBAC fields - use null instead of undefined for serialization
            role: token.user.role ?? null,
            status: token.user.status ?? null,
            vendorProjectIds: token.user.vendorProjectIds ?? null,
            vendorExpiresAt: token.user.vendorExpiresAt ?? null,
          }
        }
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

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  const options = await getAuthOptions()
  return NextAuth(req, res, options)
}
