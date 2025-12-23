/**
 * Seed Accounting Data
 *
 * Initializes the Chart of Accounts and settings.
 * Run with: npx tsx scripts/seed-accounting.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { initializeAccounting, listAccounts, getSettings } from '../lib/accounting/admin'

async function main() {
  console.log('\n🌱 Seeding Accounting Data...\n')
  console.log('='.repeat(60))

  try {
    const result = await initializeAccounting()

    // Display settings
    console.log('\n📋 Settings:')
    console.log(`   Default Basis: ${result.settings.defaultBasis}`)
    console.log(`   Currency: ${result.settings.currency}`)
    console.log(`   Fiscal Year Start: Month ${result.settings.fiscalYearStartMonth}`)

    // Display accounts
    console.log('\n📊 Chart of Accounts:')
    if (result.accounts.created.length > 0) {
      console.log(`   Created: ${result.accounts.created.join(', ')}`)
    }
    if (result.accounts.skipped.length > 0) {
      console.log(`   Skipped (already exist): ${result.accounts.skipped.join(', ')}`)
    }

    // List all accounts
    console.log('\n📒 Full Chart of Accounts:')
    const accounts = await listAccounts()
    console.log('-'.repeat(60))
    console.log(`${'Code'.padEnd(8)} ${'Name'.padEnd(30)} ${'Type'.padEnd(10)} Active`)
    console.log('-'.repeat(60))
    for (const account of accounts) {
      console.log(
        `${account.code.padEnd(8)} ${account.name.padEnd(30)} ${account.type.padEnd(10)} ${account.active ? '✓' : '✗'}`
      )
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Accounting data seeded successfully!\n')
  } catch (error) {
    console.error('\n❌ Error seeding accounting data:', error)
    process.exit(1)
  }
}

main()
