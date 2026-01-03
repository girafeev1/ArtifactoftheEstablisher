/**
 * Form Utilities
 *
 * Centralized form handling with react-hook-form and zod validation.
 * Re-exports commonly used form utilities for easy importing.
 */

// Re-export react-hook-form essentials
export {
  useForm,
  useFormContext,
  useWatch,
  useFieldArray,
  useController,
  FormProvider,
  Controller,
} from 'react-hook-form'

export type {
  UseFormReturn,
  UseFormProps,
  FieldValues,
  FieldErrors,
  SubmitHandler,
  SubmitErrorHandler,
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormGetValues,
  UseFormWatch,
  UseFormTrigger,
  UseFormReset,
  Path,
  PathValue,
  FieldPath,
} from 'react-hook-form'

import type { FieldErrors, FieldValues } from 'react-hook-form'

// Re-export zod
export { z } from 'zod'
export type { ZodSchema, ZodType, ZodError } from 'zod'

// Re-export resolver
export { zodResolver } from '@hookform/resolvers/zod'

// ============================================================================
// Common Validation Schemas
// ============================================================================

import { z } from 'zod'

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email address')

/**
 * Required string schema
 */
export const requiredString = z.string().min(1, 'This field is required')

/**
 * Optional string schema (allows empty string)
 */
export const optionalString = z.string().optional()

/**
 * Positive number schema
 */
export const positiveNumber = z.number().positive('Must be a positive number')

/**
 * Non-negative number schema
 */
export const nonNegativeNumber = z.number().min(0, 'Must be zero or greater')

/**
 * Currency amount schema (2 decimal places)
 */
export const currencyAmount = z.number()
  .min(0, 'Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

/**
 * Date string schema (ISO format)
 */
export const dateString = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Invalid date format (expected YYYY-MM-DD)'
)

/**
 * Phone number schema (flexible)
 */
export const phoneNumber = z.string()
  .regex(/^[+]?[\d\s()-]+$/, 'Invalid phone number')
  .optional()
  .or(z.literal(''))

/**
 * URL schema
 */
export const urlSchema = z.string().url('Invalid URL').optional().or(z.literal(''))

// ============================================================================
// Form Helper Types
// ============================================================================

/**
 * Extract form data type from a zod schema
 */
export type FormData<T extends z.ZodType> = z.infer<T>

/**
 * Form field error message
 */
export interface FieldError {
  message?: string
  type?: string
}

// ============================================================================
// Common Form Schemas
// ============================================================================

/**
 * Contact information schema
 */
export const contactInfoSchema = z.object({
  name: requiredString,
  email: emailSchema,
  phone: phoneNumber,
  address: optionalString,
})

/**
 * Bank account schema
 */
export const bankAccountSchema = z.object({
  bankName: requiredString,
  accountName: requiredString,
  accountNumber: requiredString,
  swiftCode: z.string().optional(),
  bankCode: z.string().optional(),
  branchCode: z.string().optional(),
})

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: dateString,
  endDate: dateString,
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'End date must be after start date', path: ['endDate'] }
)

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

// ============================================================================
// Form Utilities
// ============================================================================

/**
 * Convert Ant Design form values to form data
 * Handles undefined values and empty strings
 */
export function sanitizeFormValues<T extends Record<string, unknown>>(values: T): T {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '') {
      sanitized[key] = undefined
    } else if (typeof value === 'string') {
      sanitized[key] = value.trim()
    } else {
      sanitized[key] = value
    }
  }

  return sanitized as T
}

/**
 * Get first error message from field errors
 */
export function getFirstError(errors: FieldErrors<FieldValues>): string | undefined {
  const firstError = Object.values(errors)[0]
  if (firstError && 'message' in firstError) {
    return firstError.message as string
  }
  return undefined
}

/**
 * Check if form has any errors
 */
export function hasErrors(errors: FieldErrors<FieldValues>): boolean {
  return Object.keys(errors).length > 0
}
