/**
 * Script to check Firestore indexes via the REST API
 *
 * Usage: node scripts/check-firestore-indexes.js
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

async function listIndexes() {
  const accessToken = await getAccessToken();

  // List all indexes for the database
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/collectionGroups/-/indexes`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list indexes: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.indexes || [];
}

async function main() {
  console.log('🔍 Checking Firestore indexes...\n');
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}\n`);

  try {
    const indexes = await listIndexes();

    if (indexes.length === 0) {
      console.log('No composite indexes found.');
      return;
    }

    console.log(`Found ${indexes.length} indexes:\n`);
    console.log('='.repeat(80));

    indexes.forEach((index, i) => {
      // Extract collection name from the index name
      // Format: projects/{project}/databases/{db}/collectionGroups/{collection}/indexes/{id}
      const parts = index.name.split('/');
      const collection = parts[parts.indexOf('collectionGroups') + 1];
      const indexId = parts[parts.length - 1];

      console.log(`\n[${i + 1}] Collection: ${collection}`);
      console.log(`    Index ID: ${indexId}`);
      console.log(`    State: ${index.state}`);
      console.log(`    Query Scope: ${index.queryScope}`);
      console.log('    Fields:');

      index.fields?.forEach(field => {
        const order = field.order || field.arrayConfig || 'N/A';
        console.log(`      - ${field.fieldPath}: ${order}`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Index check complete.');

    // Compare with required indexes
    console.log('\n📋 Required indexes from codebase analysis:');
    const requiredIndexes = [
      { collection: 'entries', fields: ['subsidiaryId (ASCENDING)', 'transactionDate (DESCENDING)'], purpose: 'List transactions by subsidiary' },
      { collection: 'entries', fields: ['subsidiaryId (ASCENDING)', 'postingDate (DESCENDING)'], purpose: 'List journals by subsidiary' },
      { collection: 'entries', fields: ['status (ASCENDING)', 'transactionDate (DESCENDING)'], purpose: 'Filter transactions by status' },
      { collection: 'entries', fields: ['status (ASCENDING)', 'postingDate (DESCENDING)'], purpose: 'Filter journals by status' },
      { collection: 'entries', fields: ['bankAccountId (ASCENDING)', 'transactionDate (DESCENDING)'], purpose: 'Filter by bank account' },
      { collection: 'entries', fields: ['source (ASCENDING)', 'transactionDate (DESCENDING)'], purpose: 'Filter by import source' },
      { collection: 'accounts', fields: ['type (ASCENDING)', 'code (ASCENDING)'], purpose: 'List accounts by type' },
    ];

    console.log('\nLegend: ✅ = Exists and Enabled | 🔄 = Building | ❌ = Missing\n');

    requiredIndexes.forEach((req, i) => {
      const matchingIndex = indexes.find(idx => {
        const parts = idx.name.split('/');
        const col = parts[parts.indexOf('collectionGroups') + 1];
        if (col !== req.collection) return false;

        // Check if fields match (ignore __name__ field which is auto-added)
        const idxFields = idx.fields?.filter(f => f.fieldPath !== '__name__') || [];
        if (idxFields.length !== req.fields.length) return false;

        return idxFields.every((f, idx) => {
          const reqField = req.fields[idx];
          return reqField === `${f.fieldPath} (${f.order})`;
        });
      });

      let status = '❌';
      let stateInfo = '';
      if (matchingIndex) {
        if (matchingIndex.state === 'READY') {
          status = '✅';
        } else {
          status = '🔄';
          stateInfo = ` (${matchingIndex.state})`;
        }
      }

      console.log(`${status} [${i + 1}] ${req.collection}: ${req.fields.join(' + ')}${stateInfo}`);
      console.log(`      Purpose: ${req.purpose}`);
    });

    // Check for unnecessary indexes (not in required list)
    console.log('\n📋 Checking for unnecessary indexes...\n');

    const unnecessaryIndexes = indexes.filter(idx => {
      const parts = idx.name.split('/');
      const col = parts[parts.indexOf('collectionGroups') + 1];
      const idxFields = idx.fields?.filter(f => f.fieldPath !== '__name__') || [];

      return !requiredIndexes.some(req => {
        if (col !== req.collection) return false;
        if (idxFields.length !== req.fields.length) return false;
        return idxFields.every((f, i) => req.fields[i] === `${f.fieldPath} (${f.order})`);
      });
    });

    if (unnecessaryIndexes.length === 0) {
      console.log('✅ No unnecessary indexes found. All indexes are being used.');
    } else {
      console.log(`⚠️  Found ${unnecessaryIndexes.length} indexes not in the required list:`);
      unnecessaryIndexes.forEach((idx, i) => {
        const parts = idx.name.split('/');
        const col = parts[parts.indexOf('collectionGroups') + 1];
        const fields = idx.fields?.map(f => `${f.fieldPath} (${f.order || f.arrayConfig})`).join(' + ');
        console.log(`   [${i + 1}] ${col}: ${fields}`);
      });
      console.log('\n   Note: These may be single-field auto-indexes or used by other queries.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
