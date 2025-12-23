/**
 * Explore Firestore data structure - Summary view
 * Run with: npx tsx scripts/explore-firestore.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { Firestore } from '@google-cloud/firestore'

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
const privateKey = privateKeyRaw?.replace(/\\n/g, '\n')

const DATABASE_ID = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials in .env.local')
  process.exit(1)
}

const db = new Firestore({
  projectId,
  credentials: { client_email: clientEmail, private_key: privateKey },
  databaseId: DATABASE_ID,
})

interface InvoiceSummary {
  path: string
  invoiceNumber: string
  companyName: string
  paymentStatus: string
  amount: number
  onDate: Date | null
  paidOn: Date | null
  paidTo: string
}

async function main() {
  console.log(`\n🔥 FIRESTORE DATA SUMMARY - Database: ${DATABASE_ID}\n`)
  console.log('='.repeat(80))

  const allInvoices: InvoiceSummary[] = []
  const subsidiaries = new Set<string>()
  const companies = new Set<string>()
  const paymentStatuses = new Map<string, number>()
  const bankAccountsUsed = new Set<string>()

  // Iterate all years
  const yearsSnapshot = await db.collection('projects').get()
  console.log(`\nYears found: ${yearsSnapshot.docs.map(d => d.id).join(', ')}`)

  for (const yearDoc of yearsSnapshot.docs) {
    const year = yearDoc.id
    const projectsSnapshot = await yearDoc.ref.collection('projects').get()

    for (const projectDoc of projectsSnapshot.docs) {
      const pData = projectDoc.data()
      if (pData.subsidiary) subsidiaries.add(pData.subsidiary)

      const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()

      for (const invoiceDoc of invoicesSnapshot.docs) {
        const iData = invoiceDoc.data()

        // Calculate invoice total
        let total = 0
        const itemsCount = iData.itemsCount || 0
        for (let i = 1; i <= itemsCount; i++) {
          const price = iData[`item${i}UnitPrice`] || 0
          const qty = iData[`item${i}Quantity`] || 0
          const discount = iData[`item${i}Discount`] || 0
          total += (price * qty) - discount
        }
        const taxPercent = iData.taxOrDiscountPercent || 0
        total = total * (1 + taxPercent / 100)

        // Track stats
        const status = iData.paymentStatus || 'Unknown'
        paymentStatuses.set(status, (paymentStatuses.get(status) || 0) + 1)
        if (iData.companyName) companies.add(iData.companyName)
        if (iData.paidTo) bankAccountsUsed.add(iData.paidTo)

        const toDate = (v: any): Date | null => {
          if (!v) return null
          if (v._seconds) return new Date(v._seconds * 1000)
          if (v.toDate) return v.toDate()
          return null
        }

        allInvoices.push({
          path: `projects/${year}/projects/${projectDoc.id}/invoice/${invoiceDoc.id}`,
          invoiceNumber: invoiceDoc.id,
          companyName: iData.companyName || '',
          paymentStatus: status,
          amount: Math.round(total * 100) / 100,
          onDate: toDate(iData.onDate),
          paidOn: toDate(iData.paidOn),
          paidTo: iData.paidTo || '',
        })
      }
    }
  }

  // Summary stats
  console.log('\n' + '-'.repeat(80))
  console.log('STATISTICS:')
  console.log('-'.repeat(80))
  console.log(`Total invoices: ${allInvoices.length}`)
  console.log(`Unique subsidiaries: ${[...subsidiaries].join(', ')}`)
  console.log(`Unique client companies: ${companies.size}`)
  console.log(`Bank accounts used for payments: ${[...bankAccountsUsed].join(', ')}`)

  console.log('\nPayment status breakdown:')
  for (const [status, count] of paymentStatuses) {
    console.log(`  ${status}: ${count}`)
  }

  // Financial summary
  const cleared = allInvoices.filter(i => i.paymentStatus === 'Cleared')
  const due = allInvoices.filter(i => i.paymentStatus === 'Due')
  const draft = allInvoices.filter(i => i.paymentStatus === 'Draft' || i.paymentStatus === 'Unknown')

  const sumAmount = (invoices: InvoiceSummary[]) =>
    invoices.reduce((sum, i) => sum + i.amount, 0)

  console.log('\nFinancial summary (calculated from items):')
  console.log(`  Cleared (paid): $${sumAmount(cleared).toLocaleString()} (${cleared.length} invoices)`)
  console.log(`  Due (unpaid): $${sumAmount(due).toLocaleString()} (${due.length} invoices)`)
  console.log(`  Draft: $${sumAmount(draft).toLocaleString()} (${draft.length} invoices)`)

  // Recent invoices
  console.log('\n' + '-'.repeat(80))
  console.log('RECENT INVOICES (last 10):')
  console.log('-'.repeat(80))

  const sorted = allInvoices
    .filter(i => i.onDate)
    .sort((a, b) => (b.onDate?.getTime() || 0) - (a.onDate?.getTime() || 0))
    .slice(0, 10)

  for (const inv of sorted) {
    const dateStr = inv.onDate?.toISOString().split('T')[0] || '(no date)'
    const paidStr = inv.paidOn?.toISOString().split('T')[0] || ''
    console.log(`  ${inv.invoiceNumber.padEnd(18)} ${dateStr}  $${inv.amount.toString().padStart(8)}  ${inv.paymentStatus.padEnd(8)}  ${paidStr}  ${inv.paidTo}`)
  }

  // Bank accounts
  console.log('\n' + '-'.repeat(80))
  console.log('BANK ACCOUNTS:')
  console.log('-'.repeat(80))

  const bankAccounts = await db.collection('bankAccount').get()
  for (const doc of bankAccounts.docs) {
    const d = doc.data()
    const usageCount = allInvoices.filter(i => i.paidTo === doc.id).length
    console.log(`  ${doc.id.padEnd(15)} ${d.bankName?.padEnd(40)} ${d.accountType?.padEnd(10)} used: ${usageCount} invoices`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('DATA MODEL ANALYSIS FOR ACCOUNTING:')
  console.log('='.repeat(80))
  console.log(`
CURRENT STRUCTURE:
  projects/{year}/projects/{projectId}
    Fields: projectNumber, projectTitle, subsidiary, projectDate, projectNature, amount, presenterWorkType
    └── invoice/{invoiceNumber}
        Fields: invoiceNumber, baseInvoiceNumber, companyName, addressLine1-3, region,
                representative, paymentStatus, paidOn, onDate, paidTo,
                itemsCount, taxOrDiscountPercent, item{n}Title/FeeType/UnitPrice/Quantity/Discount
        └── updateLogs/{logId}
            Fields: field, previousValue, newValue, editedBy, timestamp

  bankAccount/{accountId}
    Fields: bankCode, bankName, accountNumber, accountType, status, FPS ID/Email

KEY OBSERVATIONS:
  1. Invoice "paymentStatus" drives accounting events:
     - "Draft" → no accounting entry
     - "Due" → invoice issued → Dr AR / Cr Revenue
     - "Cleared" → payment received → Dr Bank / Cr AR

  2. "onDate" = invoice issue date (when to recognize revenue in accrual)
  3. "paidOn" = payment date (when cash was received)
  4. "paidTo" links to bankAccount/{accountId} for bank reconciliation

  5. NO existing accounting data - GL/journals would be new collections

MIGRATION CONSIDERATION:
  - ${allInvoices.filter(i => i.paymentStatus === 'Cleared').length} invoices already "Cleared" need backfill entries
  - ${allInvoices.filter(i => i.paymentStatus === 'Due').length} invoices already "Due" need AR entries
`)
}

main().catch(console.error)
