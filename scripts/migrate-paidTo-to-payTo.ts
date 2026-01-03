/**
 * Migration Script: Rename paidTo to payTo
 *
 * This script renames the `paidTo` field to `payTo` on:
 * 1. Project documents (projects/{year}/projects/{projectId})
 * 2. Invoice documents (projects/{year}/projects/{projectId}/invoice/{invoiceNumber})
 *
 * Run with: npx tsx scripts/migrate-paidTo-to-payTo.ts [--dry-run]
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

interface MigrationStats {
  projectsScanned: number
  projectsUpdated: number
  invoicesScanned: number
  invoicesUpdated: number
  errors: string[]
}

async function migrateProjects(dryRun: boolean): Promise<MigrationStats> {
  const stats: MigrationStats = {
    projectsScanned: 0,
    projectsUpdated: 0,
    invoicesScanned: 0,
    invoicesUpdated: 0,
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

      // Check if project has paidTo field
      if ('paidTo' in projectData && projectData.paidTo !== undefined) {
        const paidToValue = projectData.paidTo

        if (dryRun) {
          console.log(`  [DRY-RUN] Would migrate project ${year}/${projectId}: paidTo="${paidToValue}" -> payTo`)
        } else {
          try {
            await projectDoc.ref.update({
              payTo: paidToValue,
              paidTo: FieldValue.delete(),
            })
            console.log(`  Migrated project ${year}/${projectId}: paidTo="${paidToValue}" -> payTo`)
            stats.projectsUpdated++
          } catch (e) {
            const error = `Failed to migrate project ${year}/${projectId}: ${e}`
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

        // Check if invoice has paidTo field
        if ('paidTo' in invoiceData && invoiceData.paidTo !== undefined) {
          const paidToValue = invoiceData.paidTo

          if (dryRun) {
            console.log(`    [DRY-RUN] Would migrate invoice ${year}/${projectId}/${invoiceNumber}: paidTo="${paidToValue}" -> payTo`)
          } else {
            try {
              await invoiceDoc.ref.update({
                payTo: paidToValue,
                paidTo: FieldValue.delete(),
              })
              console.log(`    Migrated invoice ${year}/${projectId}/${invoiceNumber}: paidTo="${paidToValue}" -> payTo`)
              stats.invoicesUpdated++
            } catch (e) {
              const error = `Failed to migrate invoice ${year}/${projectId}/${invoiceNumber}: ${e}`
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
  console.log('Migration: Rename paidTo to payTo')
  console.log('='.repeat(60))

  if (dryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n')
  } else {
    console.log('\n*** LIVE MODE - Changes will be applied ***\n')
    console.log('Starting in 3 seconds... Press Ctrl+C to cancel.')
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  const stats = await migrateProjects(dryRun)

  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`Projects scanned:  ${stats.projectsScanned}`)
  console.log(`Projects updated:  ${stats.projectsUpdated}`)
  console.log(`Invoices scanned:  ${stats.invoicesScanned}`)
  console.log(`Invoices updated:  ${stats.invoicesUpdated}`)
  console.log(`Errors:            ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\nErrors:')
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }

  if (dryRun) {
    console.log('\n*** This was a dry run. Run without --dry-run to apply changes. ***')
  }
}

main().catch(console.error)
