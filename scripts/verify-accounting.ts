/**
 * Verify Accounting Data
 *
 * Shows a trial balance and summary of journal entries.
 * Run with: npx tsx scripts/verify-accounting.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { listAccounts } from '../lib/accounting/admin'
import { Firestore } from '@google-cloud/firestore'

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')!
const databaseId = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

const db = new Firestore({
  projectId,
  credentials: { client_email: clientEmail, private_key: privateKey },
  databaseId,
})

async function main() {
  console.log('\n📊 Accounting Data Verification\n')
  console.log('='.repeat(70))

  // Get accounts
  const accounts = await listAccounts()
  const accountMap = new Map(accounts.map((a) => [a.code, a]))

  // Get journal entries (simple query without index)
  const snapshot = await db
    .collection('accounting')
    .doc('settings')
    .collection('journals')
    .get()

  const allEntries = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as any[]
  // Filter to posted only
  const entries = allEntries.filter((e) => e.status === 'posted')
  console.log(`\nTotal journal entries: ${entries.length}`)

  // Count by event type
  const byEvent = new Map<string, number>()
  for (const entry of entries) {
    const event = entry.source?.event || 'unknown'
    byEvent.set(event, (byEvent.get(event) || 0) + 1)
  }
  console.log('\nBy event type:')
  for (const [event, count] of byEvent) {
    console.log(`  ${event}: ${count}`)
  }

  // Calculate balances
  const balances = new Map<string, { debit: number; credit: number }>()
  for (const entry of entries) {
    for (const line of entry.lines || []) {
      const current = balances.get(line.accountCode) || { debit: 0, credit: 0 }
      balances.set(line.accountCode, {
        debit: current.debit + (line.debit || 0),
        credit: current.credit + (line.credit || 0),
      })
    }
  }

  // Trial Balance
  console.log('\n' + '-'.repeat(70))
  console.log('TRIAL BALANCE')
  console.log('-'.repeat(70))
  console.log(`${'Code'.padEnd(8)} ${'Account'.padEnd(30)} ${'Debit'.padStart(12)} ${'Credit'.padStart(12)}`)
  console.log('-'.repeat(70))

  let totalDebits = 0
  let totalCredits = 0

  const sortedCodes = [...balances.keys()].sort()
  for (const code of sortedCodes) {
    const { debit, credit } = balances.get(code)!
    const account = accountMap.get(code)
    const name = account?.name || 'Unknown'

    totalDebits += debit
    totalCredits += credit

    console.log(
      `${code.padEnd(8)} ${name.padEnd(30)} ${debit > 0 ? `$${debit.toLocaleString()}`.padStart(12) : ''.padStart(12)} ${credit > 0 ? `$${credit.toLocaleString()}`.padStart(12) : ''.padStart(12)}`
    )
  }

  console.log('-'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(8)} ${''.padEnd(30)} ${`$${totalDebits.toLocaleString()}`.padStart(12)} ${`$${totalCredits.toLocaleString()}`.padStart(12)}`
  )

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01
  console.log(`\n${isBalanced ? '✅ Trial Balance is BALANCED' : '❌ Trial Balance is NOT balanced!'}`)

  // Summary stats
  console.log('\n' + '-'.repeat(70))
  console.log('SUMMARY')
  console.log('-'.repeat(70))

  // AR = current AR balance
  const ar = balances.get('1100') || { debit: 0, credit: 0 }
  const arBalance = ar.debit - ar.credit
  console.log(`Accounts Receivable: $${arBalance.toLocaleString()}`)

  // Revenue
  const revenue = balances.get('4000') || { debit: 0, credit: 0 }
  const revenueBalance = revenue.credit - revenue.debit
  console.log(`Total Revenue: $${revenueBalance.toLocaleString()}`)

  // Cash in bank
  let cashInBank = 0
  for (const code of ['1000', '1001', '1002', '1003', '1004']) {
    const bank = balances.get(code) || { debit: 0, credit: 0 }
    cashInBank += bank.debit - bank.credit
  }
  console.log(`Cash in Banks: $${cashInBank.toLocaleString()}`)

  console.log('\n' + '='.repeat(70))
}

main().catch(console.error)
