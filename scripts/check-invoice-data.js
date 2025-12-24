/**
 * Check invoice data to see what amount field is used
 */

require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore('tebs-erl');

async function main() {
  console.log('Checking invoice data...\n');

  // Get 2024 and 2025 projects (more likely to have invoices)
  const yearsSnapshot = await db.collection('projects').get();

  let found = 0;
  for (const yearDoc of yearsSnapshot.docs) {
    if (found >= 3) break;

    const projectsSnapshot = await db
      .collection('projects')
      .doc(yearDoc.id)
      .collection('projects')
      .get();

    for (const projectDoc of projectsSnapshot.docs) {
      if (found >= 3) break;

      const invoicesSnapshot = await db
        .collection('projects')
        .doc(yearDoc.id)
        .collection('projects')
        .doc(projectDoc.id)
        .collection('invoice')
        .limit(1)
        .get();

      for (const invoiceDoc of invoicesSnapshot.docs) {
        found++;
        const data = invoiceDoc.data();
        console.log(`[${found}] Year: ${yearDoc.id}, Project: ${projectDoc.id}, Invoice: ${invoiceDoc.id}`);
        console.log(`    amountDue: ${data.amountDue}`);
        console.log(`    totalAmount: ${data.totalAmount}`);
        console.log(`    amount: ${data.amount}`);
        console.log(`    total: ${data.total}`);
        console.log(`    grandTotal: ${data.grandTotal}`);
        console.log(`    paymentStatus: ${data.paymentStatus}`);
        console.log(`    Keys: ${Object.keys(data).slice(0, 15).join(', ')}...`);
        console.log('');
      }
    }
  }
}

main().catch(console.error);
