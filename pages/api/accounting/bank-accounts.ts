/**
 * API: GET /api/accounting/bank-accounts
 * Returns bank account details for linked accounts in COA
 * Query: ?ids=ERL-DBS-S,ERL-OCBC-C (comma-separated identifiers)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '../auth/[...nextauth]'
import { resolveBankAccountIdentifier, listAllBankAccounts } from '../../../lib/erlDirectory'
import { fetchSubsidiaries } from '../../../lib/subsidiaries'

// Words to skip when creating abbreviations (only small connector words)
const SKIP_WORDS = new Set(['and', 'of', 'the', 'for', 'in', 'at', 'to'])

// Abbreviate bank name: if 4+ words, take first letter of each significant word
const abbreviateBankName = (bankName: string): string => {
  // Split by spaces and hyphens to get all word parts
  const words = bankName.split(/[\s-]+/).filter(w => w.length > 0)

  if (words.length < 4) {
    return bankName // Keep as-is for short names
  }

  // Take first letter of each word, skipping common small words
  const abbr = words
    .filter(word => !SKIP_WORDS.has(word.toLowerCase()))
    .map(word => word.charAt(0).toUpperCase())
    .join('')

  return abbr || bankName // Fallback to original if abbreviation is empty
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authOptions = await getAuthOptions()
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { ids } = req.query

    // Fetch subsidiary info for mapping identifier prefix to full name
    const subsidiaries = await fetchSubsidiaries()
    const subsidiaryMap = new Map<string, string>()
    for (const sub of subsidiaries) {
      subsidiaryMap.set(sub.identifier.toUpperCase(), sub.englishName || sub.identifier)
    }

    // If no specific IDs requested, return all bank accounts from directory
    if (!ids || typeof ids !== 'string') {
      const allAccounts = await listAllBankAccounts()
      const bankAccounts: Record<string, {
        bankName: string
        accountType: string | null
        displayName: string
      }> = {}

      for (const acc of allAccounts) {
        // Extract subsidiary prefix from identifier (e.g., erl-ocbc-s -> ERL)
        const prefix = acc.id.split('-')[0]?.toUpperCase()
        const subsidiaryName = prefix ? subsidiaryMap.get(prefix) || null : null

        // Bank name from document, abbreviated if 4+ words
        const rawBankName = acc.bankName || ''
        const bankName = abbreviateBankName(rawBankName)

        // Build display name: <Subsidiary Full Name> - <Bank Name>
        // Account type shown as tag separately
        const displayName = subsidiaryName && bankName
          ? `${subsidiaryName} - ${bankName}`
          : bankName || acc.id

        bankAccounts[acc.id] = {
          bankName,
          accountType: acc.accountType,
          displayName,
        }
      }

      return res.status(200).json({ bankAccounts })
    }

    // Specific IDs requested - resolve each one
    const identifiers = ids.split(',').map((id) => id.trim()).filter(Boolean)
    if (identifiers.length === 0) {
      return res.status(200).json({ bankAccounts: {} })
    }

    // Resolve each identifier
    const bankAccounts: Record<string, {
      bankName: string
      accountType: string | null
      subsidiaryName: string | null
      displayName: string
    }> = {}

    for (const id of identifiers) {
      try {
        const info = await resolveBankAccountIdentifier(id)
        if (info) {
          // Extract subsidiary prefix from identifier (e.g., erl-ocbc-s -> ERL)
          const prefix = id.split('-')[0]?.toUpperCase()
          const subsidiaryName = prefix ? subsidiaryMap.get(prefix) || null : null

          // Bank name from document, abbreviated if 4+ words
          const rawBankName = info.bankName || ''
          const bankName = abbreviateBankName(rawBankName)

          // Build display name: <Subsidiary Full Name> - <Bank Name>
          // Account type shown as tag separately
          const displayName = subsidiaryName && bankName
            ? `${subsidiaryName} - ${bankName}`
            : bankName || id

          bankAccounts[id] = {
            bankName,
            accountType: info.accountType || null,
            subsidiaryName,
            displayName,
          }
        }
      } catch (err) {
        console.error(`[accounting/bank-accounts] Failed to resolve ${id}:`, err)
      }
    }

    return res.status(200).json({ bankAccounts })
  } catch (err) {
    console.error('[accounting/bank-accounts] Error:', err)
    return res.status(500).json({ error: 'Failed to fetch bank accounts' })
  }
}
