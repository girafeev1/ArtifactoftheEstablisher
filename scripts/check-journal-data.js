/**
 * Check journal entry data in Firestore
 */

require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app, 'tebs-erl');

async function main() {
  console.log('Checking journal entries...\n');

  const snapshot = await db.collection('accounting').doc('journals').collection('entries').limit(5).get();

  console.log(`Found ${snapshot.size} entries\n`);

  let i = 0;
  snapshot.forEach((doc) => {
    i++;
    const data = doc.data();
    console.log(`[${i}] ID: ${doc.id}`);
    console.log(`    Description: ${data.description || 'N/A'}`);
    console.log(`    Status: ${data.status}`);
    console.log(`    Lines: ${data.lines?.length || 0}`);

    if (data.lines && data.lines.length > 0) {
      data.lines.forEach((line, j) => {
        console.log(`      Line ${j + 1}: ${JSON.stringify(line)}`);
      });
    } else {
      console.log('      No lines found!');
    }
    console.log('');
  });
}

main().catch(console.error);
