// functions/src/index.ts
import * as functions from 'firebase-functions';
import { initializeApis } from '../../lib/googleApi';
import { loadSecrets } from '../../lib/server/loadSecrets';
import { findPMSReferenceLogFile, fetchAddressBook, fetchBankAccounts, fetchReferenceNames, fetchSubsidiaryData } from '../../lib/pmsReference';
import { listProjectOverviewFiles, fetchProjectRows } from '../../lib/projectOverview';

export const clients = functions.https.onRequest(async (req, res) => {
  try {
    const creds = loadSecrets();
    const { drive, sheets } = initializeApis('service', {
      credentials: {
        project_id: creds.projectId,
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
    });
    const logId = await findPMSReferenceLogFile(drive);
    const clientsData = await fetchAddressBook(sheets, logId);
    const bankAccounts = await fetchBankAccounts(sheets, logId);
    res.status(200).json({ clients: clientsData, bankAccounts });
  } catch (err: any) {
    console.error('[functions] clients error', err);
    res.status(500).json({ error: err.message });
  }
});

export const businesses = functions.https.onRequest(async (req, res) => {
  try {
    const creds = loadSecrets();
    const { drive, sheets } = initializeApis('service', {
      credentials: {
        project_id: creds.projectId,
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
    });
    const fileId = req.query.fileId as string | undefined;

    if (fileId) {
      const projectsByCategory = await listProjectOverviewFiles(drive);
      const logId = await findPMSReferenceLogFile(drive);
      const referenceMapping = await fetchReferenceNames(sheets, logId);

      if (fileId === 'select') {
        const addressBook = await fetchAddressBook(sheets, logId);
        const clients = addressBook.map(c => ({ companyName: c.companyName }));
        const bankAccounts = await fetchBankAccounts(sheets, logId);
        const allSubsidiaries = await fetchSubsidiaryData(sheets, logId);
        return res.status(200).json({
          fileId: 'select',
          fileLabel: '',
          projects: [],
          yearCode: '',
          fullCompanyName: '',
          clients,
          bankAccounts,
          subsidiaryInfo: null,
          projectsByCategory,
          referenceMapping,
        });
      }

      try {
        const fileMeta = await drive.files.get({
          fileId,
          fields: 'id, name',
          supportsAllDrives: true,
        });

        const rawName = fileMeta.data.name || '';
        const match = rawName.match(/^(\d{4})\s+(\S+)\s+Project Overview/i);
        const yearCode = match ? match[1] : '';
        const shortCode = match ? match[2] : '';
        const fullCompanyName = referenceMapping[shortCode] || shortCode;
        const projects = await fetchProjectRows(sheets, fileId, 6);
        const addressBook = await fetchAddressBook(sheets, logId);
        const clients = addressBook.map(c => ({ companyName: c.companyName }));
        const bankAccounts = await fetchBankAccounts(sheets, logId);
        const allSubsidiaries = await fetchSubsidiaryData(sheets, logId);
        const subsidiaryInfo = allSubsidiaries.find(r => r.identifier === shortCode) || null;

        return res.status(200).json({
          fileId,
          fileLabel: `${fullCompanyName} - ${yearCode}`,
          projects,
          yearCode,
          fullCompanyName,
          clients,
          bankAccounts,
          subsidiaryInfo,
          projectsByCategory,
          referenceMapping,
        });
      } catch (err) {
        return res.status(400).json({ error: 'Invalid file ID' });
      }
    } else {
      const projectsByCategory = await listProjectOverviewFiles(drive, []);
      res.status(200).json({ projectsByCategory });
    }
  } catch (err: any) {
    console.error('[functions] businesses error', err);
    res.status(500).json({ error: err.message });
  }
});
