/**
 * Migrate Existing Invoices to GL
 *
 * Reads all existing invoices from Firestore and creates journal entries.
 * Run with: npx tsx scripts/migrate-invoices-to-gl.ts
 *
 * Options:
 *   --dry-run    Show what would be migrated without actually creating entries
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { Firestore } from '@google-cloud/firestore'
import { migrateInvoiceToGL, type InvoiceForMigration } from '../lib/accounting/admin'

// ============================================================================
// Setup
// ============================================================================

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
const privateKey = privateKeyRaw?.replace(/\\n/g, '\n')
const databaseId = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase Admin credentials')
  process.exit(1)
}

const db = new Firestore({
  projectId,
  credentials: { client_email: clientEmail, private_key: privateKey },
  databaseId,
})

const isDryRun = process.argv.includes('--dry-run')
const MIGRATED_BY = 'migration-script@system'

// ============================================================================
// Invoice Loading
// ============================================================================

interface RawInvoice {
  path: string
  invoiceNumber: string
  companyName: string
  paymentStatus: string
  onDate: Date | null
  paidOn: Date | null
  paidTo: string | null
  amount: number
}

function toDate(value: any): Date | null {
  if (!value) return null
  if (value._seconds) return new Date(value._seconds * 1000)
  if (value.toDate) return value.toDate()
  if (value instanceof Date) return value
  return null
}

function calculateInvoiceAmount(data: Record<string, any>): number {
  let total = 0
  const itemsCount = data.itemsCount || 0

  for (let i = 1; i <= itemsCount; i++) {
    const price = data[`item${i}UnitPrice`] || 0
    const qty = data[`item${i}Quantity`] || 0
    const discount = data[`item${i}Discount`] || 0
    total += (price * qty) - discount
  }

  const taxPercent = data.taxOrDiscountPercent || 0
  total = total * (1 + taxPercent / 100)

  return Math.round(total * 100) / 100
}

async function loadAllInvoices(): Promise<RawInvoice[]> {
  const invoices: RawInvoice[] = []

  const yearsSnapshot = await db.collection('projects').get()

  for (const yearDoc of yearsSnapshot.docs) {
    const year = yearDoc.id
    const projectsSnapshot = await yearDoc.ref.collection('projects').get()

    for (const projectDoc of projectsSnapshot.docs) {
      const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const data = invoiceDoc.data()
        const path = `projects/${year}/projects/${projectDoc.id}/invoice/${invoiceDoc.id}`

        invoices.push({
          path,
          invoiceNumber: invoiceDoc.id,
          companyName: data.companyName || 'Unknown',
          paymentStatus: data.paymentStatus || 'Unknown',
          onDate: toDate(data.onDate) || toDate(data.createdAt),
          paidOn: toDate(data.paidOn),
          paidTo: data.paidTo || null,
          amount: calculateInvoiceAmount(data),
        })
      }
    }
  }

  return invoices
}

// ============================================================================
// Migration
// ============================================================================

interface MigrationResult {
  invoice: string
  status: string
  issued?: { created: boolean; journalId?: string; skipped?: string }
  paid?: { created: boolean; journalId?: string; skipped?: string }
}

async function migrateInvoice(invoice: RawInvoice): Promise<MigrationResult> {
  const result: MigrationResult = {
    invoice: invoice.invoiceNumber,
    status: invoice.paymentStatus,
  }

  // Skip if no issue date
  if (!invoice.onDate) {
    result.issued = { created: false, skipped: 'No issue date' }
    return result
  }

  // Skip if zero amount
  if (invoice.amount <= 0) {
    result.issued = { created: false, skipped: 'Zero or negative amount' }
    return result
  }

  const invoiceForMigration: InvoiceForMigration = {
    path: invoice.path,
    invoiceNumber: invoice.invoiceNumber,
    companyName: invoice.companyName,
    amount: invoice.amount,
    onDate: invoice.onDate,
    paidOn: invoice.paidOn ?? undefined,
    paidTo: invoice.paidTo ?? undefined,
    paymentStatus: invoice.paymentStatus,
  }

  if (isDryRun) {
    // Simulate what would happen
    const status = invoice.paymentStatus.toLowerCase()
    const isCleared = ['cleared', 'paid', 'received', 'complete'].includes(status)
    const isDue = ['due', 'issued', 'pending', 'unpaid'].includes(status)

    if (isCleared || isDue) {
      result.issued = { created: true, journalId: '[dry-run]' }
    }
    if (isCleared && invoice.paidOn && invoice.paidTo) {
      result.paid = { created: true, journalId: '[dry-run]' }
    } else if (isCleared) {
      result.paid = { created: false, skipped: 'Missing paidOn or paidTo' }
    }
    return result
  }

  const migrationResult = await migrateInvoiceToGL(invoiceForMigration, MIGRATED_BY)
  result.issued = migrationResult.issuedEntry
  result.paid = migrationResult.paidEntry

  return result
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n📊 Invoice to GL Migration')
  console.log('='.repeat(70))

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  // Load invoices
  console.log('Loading invoices...')
  const invoices = await loadAllInvoices()
  console.log(`Found ${invoices.length} invoices\n`)

  // Group by status
  const byStatus = new Map<string, RawInvoice[]>()
  for (const inv of invoices) {
    const status = inv.paymentStatus
    if (!byStatus.has(status)) byStatus.set(status, [])
    byStatus.get(status)!.push(inv)
  }

  console.log('Status breakdown:')
  for (const [status, list] of byStatus) {
    const total = list.reduce((sum, i) => sum + i.amount, 0)
    console.log(`  ${status}: ${list.length} invoices, $${total.toLocaleString()}`)
  }

  console.log('\n' + '-'.repeat(70))
  console.log('Migrating invoices...\n')

  // Migrate each invoice
  const results: MigrationResult[] = []
  let issuedCreated = 0
  let paidCreated = 0
  let skipped = 0

  for (const invoice of invoices) {
    const result = await migrateInvoice(invoice)
    results.push(result)

    if (result.issued?.created) issuedCreated++
    if (result.paid?.created) paidCreated++
    if (result.issued?.skipped || result.paid?.skipped) skipped++

    // Progress indicator
    const icon = result.issued?.created || result.paid?.created ? '✓' : '○'
    const paidIcon = result.paid?.created ? '💰' : result.paid?.skipped ? '⏭' : ''
    console.log(
      `${icon} ${result.invoice.padEnd(20)} ${result.status.padEnd(10)} $${invoice.amount.toString().padStart(8)} ${paidIcon}`
    )
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('Migration Summary:')
  console.log(`  Total invoices: ${invoices.length}`)
  console.log(`  ISSUED entries created: ${issuedCreated}`)
  console.log(`  PAID entries created: ${paidCreated}`)
  console.log(`  Skipped/errors: ${skipped}`)

  if (isDryRun) {
    console.log('\n🔍 This was a dry run. Run without --dry-run to actually create entries.')
  } else {
    console.log('\n✅ Migration complete!')
  }
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error)
  process.exit(1)
})
