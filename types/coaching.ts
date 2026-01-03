/**
 * Coaching Module Types
 *
 * Type definitions for the coaching/tutoring sessions management system.
 */

import type { Timestamp } from 'firebase/firestore'

// ============================================================================
// Tab Navigation Types
// ============================================================================

export type MainTab = 'overview' | 'personal' | 'sessions' | 'billing'
export type BillingSubTab = 'retainers' | 'payment-history' | 'session-vouchers' | null

// ============================================================================
// Student Types
// ============================================================================

export interface StudentInfo {
  abbr: string
  name: string
  email?: string
  phone?: string
  address?: string
  notes?: string
  baseRate?: number
  active?: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ============================================================================
// Session Types
// ============================================================================

export interface SessionRecord {
  id?: string
  date: Timestamp
  time?: string
  duration?: number // in minutes
  rate?: number
  notes?: string
  paid?: boolean
  paymentId?: string
  voucherId?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentRecord {
  id?: string
  amount: number
  date: Timestamp
  method?: 'cash' | 'bank_transfer' | 'check' | 'other'
  reference?: string
  notes?: string
  sessions?: string[] // session IDs covered by this payment
  createdAt?: Timestamp
  createdBy?: string
}

// ============================================================================
// Voucher Types
// ============================================================================

export interface VoucherRecord {
  id?: string
  count: number // number of sessions
  purchaseDate: Timestamp
  expiryDate?: Timestamp
  rate?: number // rate per session
  remaining?: number // sessions remaining
  notes?: string
  createdAt?: Timestamp
  createdBy?: string
}

// ============================================================================
// Retainer Types (re-exported from lib/retainer.ts)
// ============================================================================

export type { RetainerDoc, RetainerStatus, RetainerStatusColor } from '../lib/retainer'

// ============================================================================
// Table Row Types (for UI components)
// ============================================================================

export interface SessionTableRow extends SessionRecord {
  key: string
  ordinal?: number
  formattedDate?: string
  formattedTime?: string
  status?: 'paid' | 'unpaid' | 'voucher'
}

export interface PaymentTableRow extends PaymentRecord {
  key: string
  formattedDate?: string
  formattedAmount?: string
  sessionCount?: number
}

export interface VoucherTableRow extends VoucherRecord {
  key: string
  formattedPurchaseDate?: string
  formattedExpiryDate?: string
  usedCount?: number
  status?: 'active' | 'expired' | 'depleted'
}

// ============================================================================
// Dialog/Modal Props Types
// ============================================================================

export interface StudentDialogProps {
  studentId: string
  open: boolean
  onClose: () => void
  initialTab?: MainTab
  initialSubTab?: BillingSubTab
}

export interface SessionDetailProps {
  session: SessionRecord
  studentId: string
  onBack: () => void
  onUpdate?: (session: SessionRecord) => void
}

export interface PaymentModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => Promise<void>
  studentId: string
  unpaidSessions?: SessionRecord[]
}

export interface VoucherModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (voucher: Omit<VoucherRecord, 'id' | 'createdAt'>) => Promise<void>
  studentId: string
}

export interface RetainerModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (start: Date, rate: number) => Promise<void>
  studentId: string
}
