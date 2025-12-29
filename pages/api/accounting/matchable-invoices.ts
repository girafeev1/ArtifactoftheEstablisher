/**
 * Matchable Invoices API
 *
 * Returns invoices that can be matched to bank transactions.
 * Includes project details for display and paidOn dates for suggestion logic.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '../auth/[...nextauth]'
import { Firestore } from '@google-cloud/firestore'

// Initialize Firestore Admin
function getFirestoreAdmin(): Firestore {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const privateKey = privateKeyRaw?.replace(/\\n/g, '\n')
  const databaseId = process.env.NEXT_PUBLIC_DEFAULT_FIRESTORE_DATABASE_ID || 'tebs-erl'

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials')
  }

  return new Firestore({
    projectId,
    credentials: { client_email: clientEmail, private_key: privateKey },
    databaseId,
  })
}

interface MatchableInvoice {
  invoiceNumber: string
  projectId: string
  year: string
  // Project display fields
  presenter?: string
  workType?: string
  projectTitle?: string
  projectNature?: string
  companyName: string
  // Invoice fields
  amount: number
  amountDue: number
  invoiceDate: string | null
  paidOn: string | null
  paymentStatus: string
  // For linking
  invoicePath: string
}

function toISOString(value: any): string | null {
  if (!value) return null
  if (value._seconds) return new Date(value._seconds * 1000).toISOString()
  if (value.toDate) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Prevent caching - always fetch fresh data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authOptions = await getAuthOptions()
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const db = getFirestoreAdmin()
    const invoices: MatchableInvoice[] = []

    // Build a map of invoice payments from transactions
    // Key: "{year}/{projectId}/{invoiceNumber}" -> { amountPaid, paidOn, paidTo }
    const paymentMap = new Map<string, { amountPaid: number; paidOn: string | null; paidTo: string | null }>()

    // Fetch matched/partial transactions
    const transactionsRef = db.collection('accounting').doc('transactions').collection('entries')
    const transactionsSnapshot = await transactionsRef
      .where('status', 'in', ['matched', 'partial'])
      .get()

    for (const txDoc of transactionsSnapshot.docs) {
      const txData = txDoc.data()
      const matchedInvoices = txData.matchedInvoices || []
      const txDate = toISOString(txData.transactionDate)
      const bankAccountId = txData.bankAccountId

      for (const match of matchedInvoices) {
        const key = `${match.year}/${match.projectId}/${match.invoiceNumber}`
        const existing = paymentMap.get(key) || { amountPaid: 0, paidOn: null, paidTo: null }
        existing.amountPaid += match.amount || 0
        if (!existing.paidOn && txDate) {
          existing.paidOn = txDate
          existing.paidTo = bankAccountId
        }
        paymentMap.set(key, existing)
      }
    }

    // Only fetch from recent years for performance (current year and previous 2 years)
    const currentYear = new Date().getFullYear()
    const yearsToFetch = [
      String(currentYear),
      String(currentYear - 1),
      String(currentYear - 2),
    ]

    // Fetch years in parallel
    const yearPromises = yearsToFetch.map(async (year) => {
      try {
        const yearRef = db.collection('projects').doc(year)
        const yearDoc = await yearRef.get()
        if (!yearDoc.exists) return []

        const projectsSnapshot = await yearRef.collection('projects').get()

        // Fetch all project invoices in parallel
        const projectPromises = projectsSnapshot.docs.map(async (projectDoc) => {
          const projectData = projectDoc.data()
          const invoicesSnapshot = await projectDoc.ref.collection('invoice').get()
          const projectInvoices: MatchableInvoice[] = []

          for (const invoiceDoc of invoicesSnapshot.docs) {
            const data = invoiceDoc.data()
            const path = `projects/${year}/projects/${projectDoc.id}/invoice/${invoiceDoc.id}`

            // Skip if company name is unknown or missing
            const companyName = data.companyName || ''
            if (!companyName || companyName === 'Unknown' || companyName === 'Unknown Client') {
              continue
            }

            const amount = calculateInvoiceAmount(data)

            // Skip zero amount invoices
            if (amount <= 0) {
              continue
            }

            const paymentStatus = data.paymentStatus || ''

            // Get payment info from transactions (derived, not stored)
            const paymentKey = `${year}/${projectDoc.id}/${invoiceDoc.id}`
            const payment = paymentMap.get(paymentKey)
            const amountPaid = payment?.amountPaid || 0
            const amountDue = Math.max(0, amount - amountPaid)

            // paidOn comes from transaction, not stored on invoice
            const paidOn = payment?.paidOn || null

            projectInvoices.push({
              invoiceNumber: invoiceDoc.id,
              projectId: projectDoc.id,
              year,
              presenter: projectData?.presenter || projectData?.workType || undefined,
              workType: projectData?.workType || undefined,
              projectTitle: projectData?.projectTitle || projectData?.title || undefined,
              projectNature: projectData?.projectNature || projectData?.nature || undefined,
              companyName,
              amount,
              amountDue,
              invoiceDate: toISOString(data.onDate) || toISOString(data.createdAt),
              paidOn,
              paymentStatus,
              invoicePath: path,
            })
          }

          return projectInvoices
        })

        const projectResults = await Promise.all(projectPromises)
        return projectResults.flat()
      } catch {
        return []
      }
    })

    const yearResults = await Promise.all(yearPromises)
    invoices.push(...yearResults.flat())

    // Sort by invoice date descending (most recent first)
    invoices.sort((a, b) => {
      const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0
      const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0
      return dateB - dateA
    })

    return res.status(200).json({ invoices })
  } catch (error) {
    console.error('[api/accounting/matchable-invoices] Error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
}
