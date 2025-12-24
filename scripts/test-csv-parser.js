/**
 * Test CSV parser to debug debit/credit issue
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// Import parser (compiled)
const { parseCSV } = require('../lib/accounting/csvParser');

const csvPath = path.join(__dirname, '../data/imports/OCBC_Statement_Savings.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

console.log('Testing CSV Parser\n');
console.log('First 5 lines of CSV:');
console.log(csvContent.split('\n').slice(0, 5).join('\n'));
console.log('\n---\n');

const result = parseCSV(csvContent, {
  preset: 'generic',
  defaultCurrency: 'HKD',
  subsidiaryId: 'erl',
  bankAccountId: 'ERL-OCBC-S',
});

console.log(`Total parsed: ${result.transactions.length}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Skipped: ${result.skipped}`);

// Count debits vs credits
const debits = result.transactions.filter(t => t.isDebit);
const credits = result.transactions.filter(t => !t.isDebit);

console.log(`\nDebits: ${debits.length}`);
console.log(`Credits: ${credits.length}`);

console.log('\nFirst 5 transactions:');
result.transactions.slice(0, 5).forEach((t, i) => {
  console.log(`[${i + 1}] ${t.isDebit ? 'DEBIT' : 'CREDIT'} $${t.amount} - ${t.memo?.substring(0, 40)}`);
});

console.log('\nLast 5 transactions:');
result.transactions.slice(-5).forEach((t, i) => {
  console.log(`[${result.transactions.length - 4 + i}] ${t.isDebit ? 'DEBIT' : 'CREDIT'} $${t.amount} - ${t.memo?.substring(0, 40)}`);
});
