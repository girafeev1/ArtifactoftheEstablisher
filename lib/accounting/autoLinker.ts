/**
 * Auto-Linker Module
 *
 * Rule-based auto-categorization for imported bank transactions.
 * Matches transactions to GL accounts based on configurable rules.
 */

import type { Timestamp } from 'firebase/firestore'
import type { BankTransaction, BankTransactionInput } from './types'

// ============================================================================
// Rule Types
// ============================================================================

export type MatchField = 'payerName' | 'displayName' | 'originalDescription' | 'referenceNumber' | 'memo'

export type MatchOperator =
  | 'contains' // Case-insensitive substring match
  | 'equals' // Exact match (case-insensitive)
  | 'startsWith' // Case-insensitive prefix match
  | 'endsWith' // Case-insensitive suffix match
  | 'regex' // Regular expression match

export type AmountOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'

export interface FieldCondition {
  field: MatchField
  operator: MatchOperator
  value: string
}

export interface AmountCondition {
  operator: AmountOperator
  value: number
  valueTo?: number // For 'between' operator
}

export interface AutoLinkRule {
  id?: string
  name: string
  description?: string

  // Matching conditions (AND logic - all must match)
  conditions: FieldCondition[]
  amountCondition?: AmountCondition
  isDebit?: boolean // null = both, true = outgoing, false = incoming
  currency?: string // Optional currency filter

  // Action
  accountCode: string // GL account to categorize to
  displayNameOverride?: string // Optional: override display name

  // Metadata
  priority: number // Higher = checked first (1-100)
  enabled: boolean
  subsidiaryId?: string // Scope to specific subsidiary
  createdAt?: Timestamp
  createdBy?: string
  updatedAt?: Timestamp
  updatedBy?: string
}

export interface AutoLinkRuleInput {
  name: string
  description?: string
  conditions: FieldCondition[]
  amountCondition?: AmountCondition
  isDebit?: boolean
  currency?: string
  accountCode: string
  displayNameOverride?: string
  priority?: number
  enabled?: boolean
  subsidiaryId?: string
  createdBy: string
}

export interface AutoLinkResult {
  matched: boolean
  rule?: AutoLinkRule
  accountCode?: string
  displayNameOverride?: string
  confidence: number // 0-1, based on number of conditions matched
}

// ============================================================================
// Matching Engine
// ============================================================================

/**
 * Check if a field condition matches a transaction
 */
function matchFieldCondition(
  transaction: BankTransaction | BankTransactionInput,
  condition: FieldCondition
): boolean {
  const fieldValue = getFieldValue(transaction, condition.field)
  if (!fieldValue) return false

  const normalizedValue = fieldValue.toLowerCase()
  const normalizedCondition = condition.value.toLowerCase()

  switch (condition.operator) {
    case 'contains':
      return normalizedValue.includes(normalizedCondition)

    case 'equals':
      return normalizedValue === normalizedCondition

    case 'startsWith':
      return normalizedValue.startsWith(normalizedCondition)

    case 'endsWith':
      return normalizedValue.endsWith(normalizedCondition)

    case 'regex':
      try {
        const regex = new RegExp(condition.value, 'i')
        return regex.test(fieldValue)
      } catch {
        console.warn(`Invalid regex in auto-link rule: ${condition.value}`)
        return false
      }

    default:
      return false
  }
}

/**
 * Get field value from transaction
 */
function getFieldValue(
  transaction: BankTransaction | BankTransactionInput,
  field: MatchField
): string | undefined {
  switch (field) {
    case 'payerName':
      return transaction.payerName
    case 'displayName':
      return transaction.displayName
    case 'originalDescription':
      return transaction.originalDescription
    case 'referenceNumber':
      return transaction.referenceNumber
    case 'memo':
      return transaction.memo
    default:
      return undefined
  }
}

/**
 * Check if amount condition matches
 */
function matchAmountCondition(
  amount: number,
  condition: AmountCondition
): boolean {
  switch (condition.operator) {
    case 'eq':
      return Math.abs(amount - condition.value) < 0.01 // Float comparison tolerance

    case 'gt':
      return amount > condition.value

    case 'gte':
      return amount >= condition.value

    case 'lt':
      return amount < condition.value

    case 'lte':
      return amount <= condition.value

    case 'between':
      if (condition.valueTo === undefined) return false
      return amount >= condition.value && amount <= condition.valueTo

    default:
      return false
  }
}

/**
 * Check if a single rule matches a transaction
 */
export function matchRule(
  transaction: BankTransaction | BankTransactionInput,
  rule: AutoLinkRule
): AutoLinkResult {
  // Check if rule is enabled
  if (!rule.enabled) {
    return { matched: false, confidence: 0 }
  }

  // Check subsidiary filter
  if (rule.subsidiaryId && transaction.subsidiaryId !== rule.subsidiaryId) {
    return { matched: false, confidence: 0 }
  }

  // Check direction filter (isDebit)
  if (rule.isDebit !== undefined && rule.isDebit !== null) {
    const transactionIsDebit = 'isDebit' in transaction ? transaction.isDebit : true
    if (rule.isDebit !== transactionIsDebit) {
      return { matched: false, confidence: 0 }
    }
  }

  // Check currency filter
  if (rule.currency && transaction.currency !== rule.currency) {
    return { matched: false, confidence: 0 }
  }

  // Check amount condition
  if (rule.amountCondition) {
    if (!matchAmountCondition(transaction.amount, rule.amountCondition)) {
      return { matched: false, confidence: 0 }
    }
  }

  // Check field conditions (AND logic)
  if (rule.conditions.length === 0) {
    // No conditions = match everything (useful for catch-all rules)
    return {
      matched: true,
      rule,
      accountCode: rule.accountCode,
      displayNameOverride: rule.displayNameOverride,
      confidence: 0.5, // Lower confidence for catch-all
    }
  }

  let matchedConditions = 0
  for (const condition of rule.conditions) {
    if (!matchFieldCondition(transaction, condition)) {
      return { matched: false, confidence: 0 }
    }
    matchedConditions++
  }

  // Calculate confidence based on number of conditions
  const confidence = Math.min(1, 0.5 + (matchedConditions * 0.1))

  return {
    matched: true,
    rule,
    accountCode: rule.accountCode,
    displayNameOverride: rule.displayNameOverride,
    confidence,
  }
}

/**
 * Find the best matching rule for a transaction
 * Rules are sorted by priority (highest first)
 */
export function findMatchingRule(
  transaction: BankTransaction | BankTransactionInput,
  rules: AutoLinkRule[]
): AutoLinkResult {
  // Sort rules by priority (descending)
  const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  for (const rule of sortedRules) {
    const result = matchRule(transaction, rule)
    if (result.matched) {
      return result
    }
  }

  return { matched: false, confidence: 0 }
}

/**
 * Apply auto-linking to a batch of transactions
 * Returns transactions with accountCode set where rules match
 */
export function applyAutoLink(
  transactions: BankTransactionInput[],
  rules: AutoLinkRule[]
): {
  results: Array<{
    transaction: BankTransactionInput
    result: AutoLinkResult
  }>
  stats: {
    total: number
    matched: number
    unmatched: number
    byRule: Record<string, number>
  }
} {
  const results: Array<{ transaction: BankTransactionInput; result: AutoLinkResult }> = []
  const byRule: Record<string, number> = {}
  let matched = 0

  for (const transaction of transactions) {
    const result = findMatchingRule(transaction, rules)

    if (result.matched && result.accountCode) {
      // Apply the match
      transaction.accountCode = result.accountCode
      if (result.displayNameOverride) {
        transaction.displayName = result.displayNameOverride
      }

      // Update stats
      matched++
      const ruleName = result.rule?.name || 'Unknown'
      byRule[ruleName] = (byRule[ruleName] || 0) + 1
    }

    results.push({ transaction, result })
  }

  return {
    results,
    stats: {
      total: transactions.length,
      matched,
      unmatched: transactions.length - matched,
      byRule,
    },
  }
}

// ============================================================================
// Common Rule Templates
// ============================================================================

/**
 * Create a rule for Google/GCP charges
 */
export function createGCPRule(accountCode: string, subsidiaryId?: string): AutoLinkRuleInput {
  return {
    name: 'Google Cloud Platform',
    description: 'Auto-categorize GCP billing charges',
    conditions: [
      { field: 'payerName', operator: 'contains', value: 'Google Cloud' },
    ],
    isDebit: true,
    accountCode,
    displayNameOverride: 'GCP Charges',
    priority: 80,
    enabled: true,
    subsidiaryId,
    createdBy: 'system',
  }
}

/**
 * Create a rule for Airwallex fees
 */
export function createAirwallexFeeRule(accountCode: string, subsidiaryId?: string): AutoLinkRuleInput {
  return {
    name: 'Airwallex Fees',
    description: 'Auto-categorize Airwallex service fees',
    conditions: [
      { field: 'payerName', operator: 'contains', value: 'Airwallex' },
    ],
    amountCondition: { operator: 'lt', value: 100 }, // Fees are typically small
    isDebit: true,
    accountCode,
    displayNameOverride: 'Airwallex Fee',
    priority: 75,
    enabled: true,
    subsidiaryId,
    createdBy: 'system',
  }
}

/**
 * Create a rule for bank fees
 */
export function createBankFeeRule(bankName: string, accountCode: string, subsidiaryId?: string): AutoLinkRuleInput {
  return {
    name: `${bankName} Bank Fees`,
    description: `Auto-categorize ${bankName} service charges`,
    conditions: [
      { field: 'originalDescription', operator: 'contains', value: 'service charge' },
    ],
    isDebit: true,
    accountCode,
    displayNameOverride: `${bankName} Fee`,
    priority: 70,
    enabled: true,
    subsidiaryId,
    createdBy: 'system',
  }
}

// ============================================================================
// Rule Validation
// ============================================================================

export interface RuleValidationError {
  field: string
  message: string
}

export function validateRule(rule: AutoLinkRuleInput): RuleValidationError[] {
  const errors: RuleValidationError[] = []

  if (!rule.name?.trim()) {
    errors.push({ field: 'name', message: 'Rule name is required' })
  }

  if (!rule.accountCode?.trim()) {
    errors.push({ field: 'accountCode', message: 'Account code is required' })
  }

  if (rule.priority !== undefined && (rule.priority < 1 || rule.priority > 100)) {
    errors.push({ field: 'priority', message: 'Priority must be between 1 and 100' })
  }

  // Validate conditions
  for (let i = 0; i < rule.conditions.length; i++) {
    const condition = rule.conditions[i]
    if (!condition.value?.trim()) {
      errors.push({ field: `conditions[${i}].value`, message: 'Condition value is required' })
    }

    if (condition.operator === 'regex') {
      try {
        new RegExp(condition.value)
      } catch {
        errors.push({ field: `conditions[${i}].value`, message: 'Invalid regular expression' })
      }
    }
  }

  // Validate amount condition
  if (rule.amountCondition) {
    if (rule.amountCondition.value < 0) {
      errors.push({ field: 'amountCondition.value', message: 'Amount must be positive' })
    }
    if (rule.amountCondition.operator === 'between' && rule.amountCondition.valueTo === undefined) {
      errors.push({ field: 'amountCondition.valueTo', message: 'Upper bound required for between operator' })
    }
  }

  return errors
}

// ============================================================================
// Collection Constants
// ============================================================================

export const AUTO_LINK_RULES_COLLECTION = 'autoLinkRules'
