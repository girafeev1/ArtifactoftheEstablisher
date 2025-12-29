/**
 * Test script to explore Airwallex API responses
 * Run with: npx tsx scripts/test-airwallex-api.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { authenticate, createAirwallexClient } from '../lib/airwallex/client'

async function exploreApi() {
  console.log('='.repeat(60))
  console.log('AIRWALLEX API EXPLORATION')
  console.log('='.repeat(60))

  // Get credentials from env (after dotenv loaded them)
  const clientId = process.env.AIRWALLEX_CLIENT_ID || ''
  const apiKey = process.env.AIRWALLEX_API_KEY || ''
  const baseUrl = process.env.AIRWALLEX_API_BASE_URL || 'https://api.airwallex.com'

  console.log('\nCredentials check:')
  console.log(`  clientId: ${clientId ? clientId.slice(0, 8) + '...' : 'MISSING'}`)
  console.log(`  apiKey length: ${apiKey.length}`)

  if (!clientId || !apiKey) {
    console.error('\nERROR: Missing AIRWALLEX_CLIENT_ID or AIRWALLEX_API_KEY in .env.local')
    return
  }

  try {
    // 1. Authenticate
    console.log('\n[1] AUTHENTICATION')
    console.log('-'.repeat(40))
    const token = await authenticate(clientId, apiKey, baseUrl)
    console.log('Token received:', {
      tokenLength: token.token.length,
      expiresAt: token.expiresAt,
    })

    const client = createAirwallexClient(token.token)

    // 2. Get Accounts/Balances
    console.log('\n[2] ACCOUNTS (Balances)')
    console.log('-'.repeat(40))
    const { accounts } = await client.getAccounts()
    console.log(`Found ${accounts.length} currency wallets:`)
    accounts.forEach(acc => {
      console.log(`  ${acc.currency}: available=${acc.available_balance}, pending=${acc.pending_balance}, total=${acc.total_balance}`)
    })
    console.log('\nFull first account object:')
    console.log(JSON.stringify(accounts[0], null, 2))

    // 3. Get Transactions (last 30 days)
    console.log('\n[3] TRANSACTIONS (last 30 days)')
    console.log('-'.repeat(40))
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { transactions, hasMore } = await client.getTransactions({
      from_created_at: thirtyDaysAgo,
      page_size: 10,
    })
    console.log(`Found ${transactions.length} transactions (hasMore: ${hasMore})`)
    if (transactions.length > 0) {
      console.log('\nFirst transaction object:')
      console.log(JSON.stringify(transactions[0], null, 2))
    }

    // 4. Get Beneficiaries (now normalized)
    console.log('\n[4] BENEFICIARIES (normalized)')
    console.log('-'.repeat(40))
    const { beneficiaries } = await client.getBeneficiaries()
    console.log(`Found ${beneficiaries.length} beneficiaries`)
    if (beneficiaries.length > 0) {
      console.log('\nNormalized beneficiary:')
      console.log(JSON.stringify(beneficiaries[0], null, 2))
    }

    // 5. Get Payments
    console.log('\n[5] PAYMENTS')
    console.log('-'.repeat(40))
    const { payments } = await client.getPayments()
    console.log(`Found ${payments.length} payments`)
    if (payments.length > 0) {
      console.log('\nFirst payment object:')
      console.log(JSON.stringify(payments[0], null, 2))
    }

    // 6. Try Global Accounts API (may not be available)
    console.log('\n[6] GLOBAL ACCOUNTS (experimental)')
    console.log('-'.repeat(40))
    try {
      const globalAccountsResponse = await fetch(`${baseUrl}/api/v1/global_accounts`, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
      })
      const globalAccountsData = await globalAccountsResponse.json()
      console.log('Global Accounts response:')
      console.log(JSON.stringify(globalAccountsData, null, 2))
    } catch (err) {
      console.log('Global Accounts API not available or error:', err)
    }

    // 7. Try Transfers API (may be different from Payments)
    console.log('\n[7] TRANSFERS (experimental)')
    console.log('-'.repeat(40))
    try {
      const transfersResponse = await fetch(`${baseUrl}/api/v1/transfers?page_size=5`, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
      })
      const transfersData = await transfersResponse.json()
      console.log('Transfers response:')
      console.log(JSON.stringify(transfersData, null, 2))
    } catch (err) {
      console.log('Transfers API not available or error:', err)
    }

    // 8. Try FX Rates API
    console.log('\n[8] FX RATES (experimental)')
    console.log('-'.repeat(40))
    try {
      const ratesResponse = await fetch(`${baseUrl}/api/v1/fx/rates?sell_currency=HKD&buy_currency=USD`, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
      })
      const ratesData = await ratesResponse.json()
      console.log('FX Rates response:')
      console.log(JSON.stringify(ratesData, null, 2))
    } catch (err) {
      console.log('FX Rates API not available or error:', err)
    }

    // 9. Try Card Transactions API
    console.log('\n[9] CARD TRANSACTIONS (experimental)')
    console.log('-'.repeat(40))
    try {
      const cardTxResponse = await fetch(`${baseUrl}/api/v1/issuing/card_transactions?page_size=5`, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
          'x-client-id': clientId,
        },
      })
      const cardTxData = await cardTxResponse.json()
      console.log('Card Transactions response:')
      console.log(JSON.stringify(cardTxData, null, 2))
    } catch (err) {
      console.log('Card Transactions API not available or error:', err)
    }

    // 10. Get a single financial transaction detail (if we have transactions)
    if (transactions.length > 0) {
      console.log('\n[10] SINGLE TRANSACTION DETAIL (experimental)')
      console.log('-'.repeat(40))
      const txId = transactions[0].id
      try {
        const txDetailResponse = await fetch(`${baseUrl}/api/v1/financial_transactions/${txId}`, {
          headers: {
            'Authorization': `Bearer ${token.token}`,
            'Content-Type': 'application/json',
            'x-client-id': clientId,
          },
        })
        const txDetailData = await txDetailResponse.json()
        console.log('Transaction detail response:')
        console.log(JSON.stringify(txDetailData, null, 2))
      } catch (err) {
        console.log('Transaction detail API not available or error:', err)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('EXPLORATION COMPLETE')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('Error:', error)
  }
}

exploreApi()
