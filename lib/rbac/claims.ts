/**
 * Custom Claims Sync
 *
 * Functions to sync user roles/status to Firebase Auth custom claims.
 * Custom claims are included in the ID token and can be checked
 * by Firestore security rules.
 */

import { firebaseAdminAuth, getAdminFirestore } from '../firebaseAdmin'
import { SYNC_CLAIMS_WHEN_DISABLED, RBAC_ENABLED } from './config'
import type {
  CustomClaims,
  UserRole,
  UserStatus,
  UserProfile,
  CreateUserProfileInput,
  VendorAccess,
} from './types'

// Default database for users collection
const DEFAULT_DATABASE_ID = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'mel-sessions'
const USERS_COLLECTION = 'users'

// ============================================================================
// Custom Claims Management
// ============================================================================

/**
 * Set custom claims on a user's Firebase Auth record
 *
 * @param uid - Firebase Auth UID
 * @param claims - Claims to set
 */
export async function setUserCustomClaims(
  uid: string,
  claims: CustomClaims
): Promise<void> {
  // Skip if RBAC is disabled and we're not syncing claims
  if (!RBAC_ENABLED && !SYNC_CLAIMS_WHEN_DISABLED) {
    console.log(`[RBAC] Skipping claims sync for ${uid} (RBAC disabled)`)
    return
  }

  try {
    await firebaseAdminAuth.setCustomUserClaims(uid, claims)
    console.log(`[RBAC] Set claims for ${uid}:`, claims)
  } catch (error) {
    console.error(`[RBAC] Failed to set claims for ${uid}:`, error)
    throw error
  }
}

/**
 * Get custom claims from a user's Firebase Auth record
 */
export async function getUserCustomClaims(uid: string): Promise<CustomClaims | null> {
  try {
    const user = await firebaseAdminAuth.getUser(uid)
    return (user.customClaims as CustomClaims) || null
  } catch (error) {
    console.error(`[RBAC] Failed to get claims for ${uid}:`, error)
    return null
  }
}

/**
 * Build custom claims from a user profile
 */
export function buildClaimsFromProfile(profile: UserProfile): CustomClaims {
  const claims: CustomClaims = {
    role: profile.role,
    status: profile.status,
  }

  // Add vendor-specific claims
  if (profile.role === 'vendor' && profile.vendorAccess) {
    claims.vendorProjectIds = profile.vendorAccess.projectIds
    if (profile.vendorAccess.expiresAt) {
      claims.vendorExpiresAt = profile.vendorAccess.expiresAt.toMillis()
    }
  }

  return claims
}

/**
 * Sync a user profile's role/status to custom claims
 */
export async function syncUserClaims(profile: UserProfile): Promise<void> {
  const claims = buildClaimsFromProfile(profile)
  await setUserCustomClaims(profile.uid, claims)
}

// ============================================================================
// User Profile Management (Firestore)
// ============================================================================

/**
 * Get the Firestore instance for user operations
 */
function getUsersDb() {
  return getAdminFirestore(DEFAULT_DATABASE_ID)
}

/**
 * Get a user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const db = getUsersDb()
    const docRef = db.collection(USERS_COLLECTION).doc(uid)
    const doc = await docRef.get()

    if (!doc.exists) {
      return null
    }

    return doc.data() as UserProfile
  } catch (error) {
    console.error(`[RBAC] Failed to get user profile ${uid}:`, error)
    return null
  }
}

/**
 * Create a new user profile (pending status)
 */
export async function createUserProfile(
  input: CreateUserProfileInput
): Promise<UserProfile> {
  const db = getUsersDb()
  const docRef = db.collection(USERS_COLLECTION).doc(input.uid)

  const now = new Date()
  const profile: UserProfile = {
    uid: input.uid,
    email: input.email,
    displayName: input.displayName,
    photoURL: input.photoURL,
    role: 'pending',
    status: 'pending',
    createdAt: now as any, // Firestore will convert
    updatedAt: now as any,
    updatedBy: 'system',
  }

  await docRef.set(profile)

  // Sync claims
  await syncUserClaims(profile)

  console.log(`[RBAC] Created user profile for ${input.uid} (${input.email})`)
  return profile
}

/**
 * Update a user profile and sync claims
 */
export async function updateUserProfile(
  uid: string,
  updates: {
    role?: UserRole
    status?: UserStatus
    vendorAccess?: VendorAccess
    approvedAt?: Date
    approvedBy?: string
  },
  updatedBy: string
): Promise<UserProfile | null> {
  const db = getUsersDb()
  const docRef = db.collection(USERS_COLLECTION).doc(uid)

  const doc = await docRef.get()
  if (!doc.exists) {
    console.error(`[RBAC] User profile not found: ${uid}`)
    return null
  }

  const current = doc.data() as UserProfile
  const now = new Date()

  const updated = {
    ...updates,
    updatedAt: now,
    updatedBy,
  } as unknown as Partial<UserProfile>

  await docRef.update(updated)

  // Get the updated profile and sync claims
  const updatedProfile: UserProfile = {
    ...current,
    ...updated,
  } as UserProfile

  await syncUserClaims(updatedProfile)

  console.log(`[RBAC] Updated user profile for ${uid}:`, updates)
  return updatedProfile
}

/**
 * Approve a pending user
 */
export async function approveUser(
  uid: string,
  role: UserRole,
  approvedBy: string,
  vendorAccess?: VendorAccess
): Promise<UserProfile | null> {
  if (role === 'pending') {
    throw new Error('Cannot approve user with pending role')
  }

  const updates: Parameters<typeof updateUserProfile>[1] = {
    role,
    status: 'active',
    approvedAt: new Date(),
    approvedBy,
  }

  if (role === 'vendor' && vendorAccess) {
    updates.vendorAccess = vendorAccess
  }

  return updateUserProfile(uid, updates, approvedBy)
}

/**
 * Suspend a user
 */
export async function suspendUser(
  uid: string,
  suspendedBy: string
): Promise<UserProfile | null> {
  return updateUserProfile(uid, { status: 'suspended' }, suspendedBy)
}

/**
 * Reactivate a suspended user
 */
export async function reactivateUser(
  uid: string,
  reactivatedBy: string
): Promise<UserProfile | null> {
  return updateUserProfile(uid, { status: 'active' }, reactivatedBy)
}

/**
 * Get or create a user profile
 * Used during sign-in to ensure a profile exists
 */
export async function getOrCreateUserProfile(
  input: CreateUserProfileInput
): Promise<{ profile: UserProfile; created: boolean }> {
  const existing = await getUserProfile(input.uid)

  if (existing) {
    // Update last login
    const db = getUsersDb()
    await db.collection(USERS_COLLECTION).doc(input.uid).update({
      lastLoginAt: new Date(),
    })

    return { profile: existing, created: false }
  }

  const profile = await createUserProfile(input)
  return { profile, created: true }
}

/**
 * List all users (for admin)
 */
export async function listUsers(options?: {
  status?: UserStatus
  role?: UserRole
  limit?: number
  offset?: number
}): Promise<UserProfile[]> {
  const db = getUsersDb()
  let query = db.collection(USERS_COLLECTION).orderBy('createdAt', 'desc')

  if (options?.status) {
    query = query.where('status', '==', options.status)
  }

  if (options?.role) {
    query = query.where('role', '==', options.role)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.offset(options.offset)
  }

  const snapshot = await query.get()
  return snapshot.docs.map((doc) => doc.data() as UserProfile)
}

/**
 * Count users by status
 */
export async function countUsersByStatus(): Promise<Record<UserStatus, number>> {
  const db = getUsersDb()
  const snapshot = await db.collection(USERS_COLLECTION).get()

  const counts: Record<UserStatus, number> = {
    pending: 0,
    active: 0,
    suspended: 0,
  }

  snapshot.docs.forEach((doc) => {
    const status = (doc.data() as UserProfile).status
    counts[status] = (counts[status] || 0) + 1
  })

  return counts
}
