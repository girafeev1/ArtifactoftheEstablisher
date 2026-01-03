import 'next-auth'
import type { UserRole, UserStatus } from '@/lib/rbac/types'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      // RBAC fields (null when not set, for JSON serialization)
      role?: UserRole | null
      status?: UserStatus | null
      vendorProjectIds?: string[] | null
      vendorExpiresAt?: number | null
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    // RBAC fields from custom claims
    role?: UserRole | null
    status?: UserStatus | null
    vendorProjectIds?: string[] | null
    vendorExpiresAt?: number | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      // RBAC fields
      role?: UserRole | null
      status?: UserStatus | null
      vendorProjectIds?: string[] | null
      vendorExpiresAt?: number | null
    }
  }
}
