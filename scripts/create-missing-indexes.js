/**
 * Script to create missing Firestore indexes via the REST API
 *
 * Usage: node scripts/create-missing-indexes.js
 */

require('dotenv').config({ path: '.env.local' });

const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = 'aote-pms';
const DATABASE_ID = 'tebs-erl';

async function getAccessToken() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials: {
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function createIndex(accessToken, collectionId, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/collectionGroups/${collectionId}/indexes`;

  const indexData = {
    queryScope: 'COLLECTION',
    fields: fields,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(indexData),
  });

  const data = await response.json();

  if (!response.ok) {
    // Check if index already exists
    if (data.error?.status === 'ALREADY_EXISTS') {
      return { status: 'exists', data };
    }
    return { status: 'error', data };
  }

  return { status: 'created', data };
}

async function main() {
  console.log('🔧 Creating missing Firestore indexes...\n');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}\n`);

  const accessToken = await getAccessToken();

  const missingIndexes = [
    {
      collection: 'entries',
      fields: [
        { fieldPath: 'status', order: 'ASCENDING' },
        { fieldPath: 'transactionDate', order: 'DESCENDING' },
      ],
      purpose: 'Filter transactions by status',
    },
    {
      collection: 'entries',
      fields: [
        { fieldPath: 'bankAccountId', order: 'ASCENDING' },
        { fieldPath: 'transactionDate', order: 'DESCENDING' },
      ],
      purpose: 'Filter by bank account',
    },
    {
      collection: 'entries',
      fields: [
        { fieldPath: 'source', order: 'ASCENDING' },
        { fieldPath: 'transactionDate', order: 'DESCENDING' },
      ],
      purpose: 'Filter by import source',
    },
    {
      collection: 'accounts',
      fields: [
        { fieldPath: 'type', order: 'ASCENDING' },
        { fieldPath: 'code', order: 'ASCENDING' },
      ],
      purpose: 'List accounts by type',
    },
  ];

  console.log(`Creating ${missingIndexes.length} indexes...\n`);

  for (let i = 0; i < missingIndexes.length; i++) {
    const idx = missingIndexes[i];
    const fieldsStr = idx.fields.map(f => `${f.fieldPath} (${f.order})`).join(' + ');

    process.stdout.write(`[${i + 1}/${missingIndexes.length}] ${idx.collection}: ${fieldsStr}... `);

    try {
      const result = await createIndex(accessToken, idx.collection, idx.fields);

      if (result.status === 'created') {
        console.log('✅ Created (building)');
      } else if (result.status === 'exists') {
        console.log('⏭️  Already exists');
      } else {
        console.log(`❌ Error: ${result.data.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Done! Indexes may take 1-5 minutes to build.');
  console.log('Run `node scripts/check-firestore-indexes.js` to check status.');
}

main();
