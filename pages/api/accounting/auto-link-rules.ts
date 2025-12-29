/**
 * Auto-Link Rules API
 *
 * CRUD operations for auto-link rules that categorize transactions.
 *
 * GET    - List all rules (sorted by priority)
 * POST   - Create a new rule
 * PUT    - Update an existing rule (requires id in body)
 * DELETE - Delete a rule (requires id in query)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { projectsDb } from '../../../lib/firebase'
import {
  AUTO_LINK_RULES_COLLECTION,
  validateRule,
  type AutoLinkRule,
  type AutoLinkRuleInput,
} from '../../../lib/accounting/autoLinker'

interface ApiResponse {
  success: boolean
  data?: AutoLinkRule | AutoLinkRule[]
  error?: string
  errors?: Array<{ field: string; message: string }>
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res)
      case 'POST':
        return await handlePost(req, res)
      case 'PUT':
        return await handlePut(req, res)
      case 'DELETE':
        return await handleDelete(req, res)
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Auto-link rules API error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}

/**
 * GET - List all rules
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { subsidiaryId, enabled } = req.query

  const rulesRef = collection(projectsDb, AUTO_LINK_RULES_COLLECTION)
  let q = query(rulesRef, orderBy('priority', 'desc'))

  // Apply filters if provided
  if (subsidiaryId && typeof subsidiaryId === 'string') {
    q = query(rulesRef, where('subsidiaryId', '==', subsidiaryId), orderBy('priority', 'desc'))
  }

  const snapshot = await getDocs(q)
  let rules: AutoLinkRule[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as AutoLinkRule[]

  // Filter by enabled status if provided
  if (enabled !== undefined) {
    const enabledBool = enabled === 'true'
    rules = rules.filter((rule) => rule.enabled === enabledBool)
  }

  return res.status(200).json({ success: true, data: rules })
}

/**
 * POST - Create a new rule
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const input = req.body as AutoLinkRuleInput

  // Validate the rule
  const validationErrors = validateRule(input)
  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: validationErrors,
    })
  }

  // Set defaults
  const rule: Omit<AutoLinkRule, 'id'> = {
    name: input.name.trim(),
    description: input.description?.trim(),
    conditions: input.conditions,
    amountCondition: input.amountCondition,
    isDebit: input.isDebit,
    currency: input.currency,
    accountCode: input.accountCode.trim(),
    displayNameOverride: input.displayNameOverride?.trim(),
    priority: input.priority || 50,
    enabled: input.enabled !== false,
    subsidiaryId: input.subsidiaryId,
    createdBy: input.createdBy,
    createdAt: serverTimestamp() as unknown as import('firebase/firestore').Timestamp,
  }

  const rulesRef = collection(projectsDb, AUTO_LINK_RULES_COLLECTION)
  const docRef = await addDoc(rulesRef, rule)

  return res.status(201).json({
    success: true,
    data: { id: docRef.id, ...rule },
  })
}

/**
 * PUT - Update an existing rule
 */
async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id, ...input } = req.body as AutoLinkRuleInput & { id: string }

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Rule ID is required',
    })
  }

  // Validate the rule
  const validationErrors = validateRule(input as AutoLinkRuleInput)
  if (validationErrors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: validationErrors,
    })
  }

  const ruleRef = doc(projectsDb, AUTO_LINK_RULES_COLLECTION, id)
  const updateData = {
    name: input.name?.trim(),
    description: input.description?.trim(),
    conditions: input.conditions,
    amountCondition: input.amountCondition,
    isDebit: input.isDebit,
    currency: input.currency,
    accountCode: input.accountCode?.trim(),
    displayNameOverride: input.displayNameOverride?.trim(),
    priority: input.priority || 50,
    enabled: input.enabled !== false,
    subsidiaryId: input.subsidiaryId,
    updatedBy: input.createdBy, // Use createdBy field for updatedBy
    updatedAt: serverTimestamp(),
  }

  await updateDoc(ruleRef, updateData)

  return res.status(200).json({
    success: true,
    data: { id, ...updateData } as AutoLinkRule,
  })
}

/**
 * DELETE - Delete a rule
 */
async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Rule ID is required',
    })
  }

  const ruleRef = doc(projectsDb, AUTO_LINK_RULES_COLLECTION, id)
  await deleteDoc(ruleRef)

  return res.status(200).json({ success: true })
}
