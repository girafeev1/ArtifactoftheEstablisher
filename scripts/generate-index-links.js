/**
 * Generate Firebase Console links to create missing indexes
 */

const PROJECT_ID = 'aote-pms';
const DATABASE_ID = 'tebs-erl';

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

console.log('📋 Missing Firestore Indexes - Create via Console\n');
console.log('Click each link below to create the index:\n');

missingIndexes.forEach((idx, i) => {
  const fieldsStr = idx.fields.map(f => `${f.fieldPath} (${f.order})`).join(' + ');

  // Generate the console URL for creating an index
  const baseUrl = `https://console.firebase.google.com/project/${PROJECT_ID}/firestore/databases/${DATABASE_ID}/indexes`;

  console.log(`[${i + 1}] ${idx.collection}: ${fieldsStr}`);
  console.log(`    Purpose: ${idx.purpose}`);
  console.log(`    URL: ${baseUrl}`);
  console.log('');
});

console.log('\nAlternatively, run: firebase deploy --only firestore:indexes');
console.log('(Requires: firebase login first)\n');
