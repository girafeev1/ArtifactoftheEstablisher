// functions/src/index.ts
import * as functions from 'firebase-functions';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook, fetchBankAccounts } from '../../lib/pmsReference';

export const clients = functions.https.onRequest(async (req, res) => {
  try {
    const { drive, sheets } = initializeApis('service', {});
    const logId = await findPMSReferenceLogFile(drive);
    const clientsData = await fetchAddressBook(sheets, logId);
    const bankAccounts = await fetchBankAccounts(sheets, logId);
    res.status(200).json({ clients: clientsData, bankAccounts });
  } catch (err: any) {
    console.error('[functions] clients error', err);
    res.status(500).json({ error: err.message });
  }
});
