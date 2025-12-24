/**
 * Create Firestore indexes using REST API with broader credentials
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleAuth } = require('google-auth-library');

const PROJECT_ID = 'aote-pms';
const DATABASE_ID = 'tebs-erl';

async function getAccessToken() {
  // Use the Firebase Admin credentials directly from env
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.error('Missing FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore'],
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
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
  return { status: response.status, data };
}

async function main() {
  console.log('🔧 Creating Firestore indexes via REST API...\n');

  const accessToken = await getAccessToken();

  const indexes = [
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

  for (let i = 0; i < indexes.length; i++) {
    const idx = indexes[i];
    const fieldsStr = idx.fields.map(f => `${f.fieldPath} (${f.order})`).join(' + ');

    process.stdout.write(`[${i + 1}/${indexes.length}] ${idx.collection}: ${fieldsStr}... `);

    const result = await createIndex(accessToken, idx.collection, idx.fields);

    if (result.status === 200 || result.status === 201) {
      console.log('✅ Created');
    } else if (result.data?.error?.status === 'ALREADY_EXISTS') {
      console.log('⏭️  Already exists');
    } else if (result.status === 403) {
      console.log(`❌ Permission denied`);
    } else {
      console.log(`❌ Error: ${result.data?.error?.message || JSON.stringify(result.data)}`);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
