/**
 * OCBC OAuth Root Handler
 * This handles the case where OCBC redirects to http://localhost:8080
 * instead of http://localhost:8080/api/ocbc/callback
 *
 * It simply forwards the OAuth params to the actual callback handler
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // If this is an OAuth callback (has code or error param), redirect to the callback handler
  const { code, state, error, error_description } = req.query

  if (code || error) {
    // Build the callback URL with all query params
    const params = new URLSearchParams()
    if (code) params.set('code', String(code))
    if (state) params.set('state', String(state))
    if (error) params.set('error', String(error))
    if (error_description) params.set('error_description', String(error_description))

    // Redirect to the actual callback handler
    return res.redirect(`/api/ocbc/callback?${params.toString()}`)
  }

  // Otherwise, return info about available endpoints
  return res.status(200).json({
    message: 'OCBC API endpoints',
    endpoints: {
      auth: '/api/ocbc/auth',
      callback: '/api/ocbc/callback',
      accounts: '/api/ocbc/accounts',
      transactions: '/api/ocbc/transactions',
      transfer: '/api/ocbc/transfer',
      beneficiaries: '/api/ocbc/beneficiaries',
    },
  })
}
