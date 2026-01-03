/**
 * Migration Script: Clean up legacy fields from projects and invoices
 *
 * This script:
 * 1. Removes deprecated/legacy fields from invoice documents
 * 2. Standardizes paymentStatus values to current format
 * 3. Removes computed aggregate fields (subtotal, total, amount)
 *
 * Run with: npx tsx scripts/cleanup-legacy-fields.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 */

import { config } from 'dotenv'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Load environment variables
config({ path: '.env.local' })

// Initialize Firebase Admin using environment variables
if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Admin credentials in .env.local')
    console.error('Required: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY')
    process.exit(1)
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

const databaseId = process.env.NEXT_PUBLIC_PROJECTS_FIRESTORE_DATABASE_ID || 'tebs-erl'
const db = getFirestore(databaseId)
console.log(`Using Firestore database: ${databaseId}`)

// Legacy invoice fields to remove
const LEGACY_INVOICE_FIELDS = [
  // Replaced by payTo (payment instructions)
  'paidTo',              // Was renamed - now derived from transactions if needed
  'paymentRecipient',
  // Replaced by paymentStatus
  'status',
  'invoiceStatus',
  'payment_status',
  'paymentStatusLabel',
  // Legacy boolean payment flags (now derived from transactions)
  'paid',
  'paymentReceived',
  'invoicePaid',
  'paymentComplete',
  // Legacy date fields (now derived from transactions)
  'paidOnIso',           // Derived from transaction matching
  'paidOnDate',
  'paymentReceivedOn',
  'paymentDate',
  'paidDate',
  'receivedOn',
  'paidOnDisplay',       // Derived from transaction matching
  // Computed aggregates (calculated at read time)
  'subtotal',
  'total',
  'amount',
  // Old linked transaction references (now in accounting system)
  'linkedTransactions',
  'transactionLinks',
]

// Legacy project fields to remove
const LEGACY_PROJECT_FIELDS = [
  'paidTo', // Already migrated to payTo
]

// Payment status normalization map
const STATUS_NORMALIZATION: Record<string, string> = {
  // Normalize to 'Draft'
  'draft': 'Draft',
  'drafted': 'Draft',
  'pending': 'Draft',
  'unpaid': 'Draft',
  'new': 'Draft',
  // Normalize to 'Due'
  'due': 'Due',
  'issued': 'Due',
  'sent': 'Due',
  'outstanding': 'Due',
  'awaiting': 'Due',
  'awaiting payment': 'Due',
  // Normalize to 'Cleared'
  'cleared': 'Cleared',
  'paid': 'Cleared',
  'complete': 'Cleared',
  'completed': 'Cleared',
  'received': 'Cleared',
}

interface MigrationStats {
  projectsScanned: number
  projectsUpdated: number
  invoicesScanned: number
  invoicesUpdated: number
  legacyFieldsRemoved: number
  statusesNormalized: number
  errors: string[]
}

async function cleanupDocuments(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    projectsScanned: 0,
    projectsUpdated: 0,
    invoicesScanned: 0,
    invoicesUpdated: 0,
    legacyFieldsRemoved: 0,
    statusesNormalized: 0,
    errors: [],
  }

  // Get all year collections
  const yearsSnapshot = await db.collection('projects').listDocuments()

  for (const yearDoc of yearsSnapshot) {
    const year = yearDoc.id
    console.log(`\nProcessing year: ${year}`)

    // Get all projects in this year
    const projectsRef = db.collection('projects').doc(year).collection('projects')
    const projectsSnapshot = await projectsRef.get()

    for (const projectDoc of projectsSnapshot.docs) {
      stats.projectsScanned++
      const projectData = projectDoc.data()
      const projectId = projectDoc.id

      // Check for legacy fields in project
      const projectUpdates: Record<string, any> = {}
      const projectDeletes: string[] = []

      for (const field of LEGACY_PROJECT_FIELDS) {
        if (field in projectData && projectData[field] !== undefined) {
          projectDeletes.push(field)
          stats.legacyFieldsRemoved++
        }
      }

      if (projectDeletes.length > 0) {
        if (dryRun) {
          console.log(`  [DRY-RUN] Would remove from project ${year}/${projectId}: ${projectDeletes.join(', ')}`)
        } else {
          try {
            const deleteUpdates: Record<string, any> = {}
            for (const field of projectDeletes) {
              deleteUpdates[field] = FieldValue.delete()
            }
            await projectDoc.ref.update(deleteUpdates)
            console.log(`  Removed from project ${year}/${projectId}: ${projectDeletes.join(', ')}`)
            stats.projectsUpdated++
          } catch (e) {
            const error = `Failed to update project ${year}/${projectId}: ${e}`
            console.error(`  ${error}`)
            stats.errors.push(error)
          }
        }
      }

      // Check invoices subcollection
      const invoicesRef = projectDoc.ref.collection('invoice')
      const invoicesSnapshot = await invoicesRef.get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        stats.invoicesScanned++
        const invoiceData = invoiceDoc.data()
        const invoiceNumber = invoiceDoc.id

        const invoiceUpdates: Record<string, any> = {}
        const invoiceDeletes: string[] = []

        // Check for legacy fields
        for (const field of LEGACY_INVOICE_FIELDS) {
          if (field in invoiceData && invoiceData[field] !== undefined) {
            invoiceDeletes.push(field)
            stats.legacyFieldsRemoved++
          }
        }

        // Normalize payment status
        const currentStatus = invoiceData.paymentStatus
        if (currentStatus && typeof currentStatus === 'string') {
          const normalized = STATUS_NORMALIZATION[currentStatus.toLowerCase().trim()]
          if (normalized && normalized !== currentStatus) {
            invoiceUpdates.paymentStatus = normalized
            stats.statusesNormalized++
          }
        }

        // Apply updates if any
        if (invoiceDeletes.length > 0 || Object.keys(invoiceUpdates).length > 0) {
          if (dryRun) {
            if (invoiceDeletes.length > 0) {
              console.log(`    [DRY-RUN] Would remove from invoice ${year}/${projectId}/${invoiceNumber}: ${invoiceDeletes.join(', ')}`)
            }
            if (Object.keys(invoiceUpdates).length > 0) {
              console.log(`    [DRY-RUN] Would update invoice ${year}/${projectId}/${invoiceNumber}: ${JSON.stringify(invoiceUpdates)}`)
            }
          } else {
            try {
              const updates: Record<string, any> = { ...invoiceUpdates }
              for (const field of invoiceDeletes) {
                updates[field] = FieldValue.delete()
              }
              await invoiceDoc.ref.update(updates)
              if (invoiceDeletes.length > 0) {
                console.log(`    Removed from invoice ${year}/${projectId}/${invoiceNumber}: ${invoiceDeletes.join(', ')}`)
              }
              if (Object.keys(invoiceUpdates).length > 0) {
                console.log(`    Updated invoice ${year}/${projectId}/${invoiceNumber}: ${JSON.stringify(invoiceUpdates)}`)
              }
              stats.invoicesUpdated++
            } catch (e) {
              const error = `Failed to update invoice ${year}/${projectId}/${invoiceNumber}: ${e}`
              console.error(`    ${error}`)
              stats.errors.push(error)
            }
          }
        }
      }
    }
  }

  return stats
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('='.repeat(60))
  console.log('Migration: Clean up legacy fields from projects and invoices')
  console.log('='.repeat(60))

  console.log('\nLegacy invoice fields to remove:')
  LEGACY_INVOICE_FIELDS.forEach(f => console.log(`  - ${f}`))

  console.log('\nLegacy project fields to remove:')
  LEGACY_PROJECT_FIELDS.forEach(f => console.log(`  - ${f}`))

  console.log('\nPayment status normalization:')
  Object.entries(STATUS_NORMALIZATION).forEach(([from, to]) => {
    console.log(`  "${from}" → "${to}"`)
  })

  if (dryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n')
  } else {
    console.log('\n*** LIVE MODE - Changes will be applied ***\n')
    console.log('Starting in 5 seconds... Press Ctrl+C to cancel.')
    await new Promise(resolve => setTimeout(resolve, 5000))
  }

  const stats = await cleanupDocuments(dryRun)

  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`Projects scanned:       ${stats.projectsScanned}`)
  console.log(`Projects updated:       ${stats.projectsUpdated}`)
  console.log(`Invoices scanned:       ${stats.invoicesScanned}`)
  console.log(`Invoices updated:       ${stats.invoicesUpdated}`)
  console.log(`Legacy fields removed:  ${stats.legacyFieldsRemoved}`)
  console.log(`Statuses normalized:    ${stats.statusesNormalized}`)
  console.log(`Errors:                 ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }

  if (dryRun) {
    console.log('\n*** This was a dry run. Run without --dry-run to apply changes. ***')
  }
}

main().catch(console.error)
