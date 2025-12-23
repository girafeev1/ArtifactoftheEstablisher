/**
 * API: GET /api/accounting/bank-accounts
 * Returns bank account details for linked accounts in COA
 * Query: ?ids=ERL-DBS-S,ERL-OCBC-C (comma-separated identifiers)
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { getAuthOptions } from '../auth/[...nextauth]'
import { resolveBankAccountIdentifier } from '../../../lib/erlDirectory'
import { fetchSubsidiaries } from '../../../lib/subsidiaries'

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
    if (!ids || typeof ids !== 'string') {
      return res.status(400).json({ error: 'ids query parameter required' })
    }

    const identifiers = ids.split(',').map((id) => id.trim()).filter(Boolean)
    if (identifiers.length === 0) {
      return res.status(200).json({ bankAccounts: {} })
    }

    // Fetch subsidiary info for mapping identifier prefix to full name
    const subsidiaries = await fetchSubsidiaries()
    const subsidiaryMap = new Map<string, string>()
    for (const sub of subsidiaries) {
      subsidiaryMap.set(sub.identifier.toUpperCase(), sub.englishName || sub.identifier)
    }

    // Helper to abbreviate long names (4+ words)
    const abbreviateName = (name: string): string => {
      const tokens = name.replace(/-/g, ' ').split(/\s+/).filter(Boolean)
      if (tokens.length >= 4) {
        // Build acronym from capitalized words only
        const acronym = tokens
          .filter((t) => t[0] === t[0].toUpperCase())
          .map((t) => t[0])
          .join('')
        return acronym || name
      }
      return name
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
          // Extract subsidiary prefix from identifier (e.g., ERL-DBS-S -> ERL)
          const prefix = id.split('-')[0]?.toUpperCase()
          const subsidiaryName = prefix ? subsidiaryMap.get(prefix) || null : null

          // Abbreviate bank name if 4+ words
          const displayBankName = info.bankName ? abbreviateName(info.bankName) : ''

          // Build display name: <Subsidiary> - <Bank Name> (<Account Type> Account)
          const accountTypeLabel = info.accountType
            ? `${info.accountType} Account`
            : 'Account'
          const displayName = subsidiaryName && displayBankName
            ? `${subsidiaryName} - ${displayBankName} (${accountTypeLabel})`
            : displayBankName
              ? `${displayBankName} (${accountTypeLabel})`
              : id

          bankAccounts[id] = {
            bankName: info.bankName || '',
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
