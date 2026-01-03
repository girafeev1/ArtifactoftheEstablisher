/**
 * Shared/Common Types
 *
 * Utility types and common patterns used across the application.
 */

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API success response wrapper
 */
export interface ApiResponse<T> {
  success: true
  data: T
  message?: string
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false
  error: string
  code?: string
  details?: Record<string, unknown>
}

/**
 * Combined API response type
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ============================================================================
// Common Utility Types
// ============================================================================

/**
 * Sort direction for tables and lists
 */
export type SortDirection = 'asc' | 'desc' | 'ascend' | 'descend' | null

/**
 * Date range filter
 */
export interface DateRange {
  start: Date | null
  end: Date | null
}

/**
 * Generic filter state
 */
export interface FilterState<T = string> {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith'
  value: T
}

/**
 * Loading state for async operations
 */
export interface LoadingState {
  isLoading: boolean
  error: string | null
}

/**
 * Selection state for tables
 */
export interface SelectionState<T = string> {
  selectedKeys: T[]
  selectAll: boolean
}

// ============================================================================
// Form Types
// ============================================================================

/**
 * Generic form field state
 */
export interface FormFieldState<T = string> {
  value: T
  error?: string
  touched: boolean
  dirty: boolean
}

/**
 * Form submission state
 */
export interface FormSubmitState {
  isSubmitting: boolean
  submitError: string | null
  submitSuccess: boolean
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * Base entity with common fields
 */
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
}

/**
 * Soft-deletable entity
 */
export interface SoftDeletableEntity extends BaseEntity {
  deletedAt?: Date
  deletedBy?: string
  isDeleted: boolean
}

/**
 * Auditable entity with change tracking
 */
export interface AuditableEntity extends BaseEntity {
  version: number
  lastModifiedAction?: string
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Modal/Dialog state
 */
export interface ModalState {
  isOpen: boolean
  mode: 'create' | 'edit' | 'view' | 'delete'
  entityId?: string
}

/**
 * Tab state
 */
export interface TabState<T extends string = string> {
  activeTab: T
  previousTab?: T
}

/**
 * Notification/Alert types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  description?: string
  duration?: number
  dismissible?: boolean
}

// ============================================================================
// Currency & Money Types
// ============================================================================

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = 'USD' | 'SGD' | 'HKD' | 'EUR' | 'GBP' | 'CNY' | 'JPY' | string

/**
 * Money amount with currency
 */
export interface Money {
  amount: number
  currency: CurrencyCode
}

/**
 * Exchange rate
 */
export interface ExchangeRate {
  from: CurrencyCode
  to: CurrencyCode
  rate: number
  timestamp: Date
}

// ============================================================================
// File/Upload Types
// ============================================================================

/**
 * File upload state
 */
export interface UploadState {
  file: File | null
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
  url?: string
}

/**
 * File metadata
 */
export interface FileMetadata {
  name: string
  size: number
  mimeType: string
  url: string
  uploadedAt: Date
  uploadedBy?: string
}
