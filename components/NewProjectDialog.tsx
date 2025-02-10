// components/NewProjectDialog.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import NewProjectPage1 from './NewProjectDialog/NewProjectPage1';
import NewProjectPage2 from './NewProjectDialog/NewProjectPage2';

interface ClientEntry {
  companyName: string;
}
interface InvoiceBankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  identifier?: string;
}
interface SubsidiaryData {
  identifier: string;
  englishName: string;
  chineseName: string;
  email: string;
  phone: string;
  room: string;
  building: string;
  street: string;
  district: string;
  region: string;
}

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  fileId: string;
  yearCode: string;
  fullCompanyName: string;
  clientsData: ClientEntry[];
  defaultProjectNumber?: string;
  bankAccounts?: InvoiceBankAccount[];
  subsidiaryInfo?: SubsidiaryData | null;
  initialPageIndex?: number;
  cameFromEditProject?: boolean;
  onGoBackToEditProject?: () => void;
  existingProjectNumber?: string;
  existingProjectDate?: string;
}

export default function NewProjectDialog({
  open,
  onClose,
  onProjectAdded,
  fileId,
  yearCode,
  fullCompanyName,
  clientsData,
  defaultProjectNumber = '',
  bankAccounts = [],
  subsidiaryInfo,
  initialPageIndex = 0,
  cameFromEditProject = false,
  onGoBackToEditProject,
  existingProjectNumber,
  existingProjectDate,
}: NewProjectDialogProps) {
  console.log('[NewProjectDialog] rendering => open=', open, ' cameFromEditProject=', cameFromEditProject);

  const [pageIndex, setPageIndex] = useState(initialPageIndex);

  // ---------- Page 1 States ----------
  const [projectNumber, setProjectNumber] = useState(defaultProjectNumber);
  const [editingProjectNumber, setEditingProjectNumber] = useState(false);
  const [projectDate, setProjectDate] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [useManualCompany, setUseManualCompany] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectNature, setProjectNature] = useState('');
  const [amount, setAmount] = useState('');

  // ---------- Page 2 States ----------
  const [issuerEnglish, setIssuerEnglish] = useState('');
  const [issuerChinese, setIssuerChinese] = useState('');
  const [issuerRoom, setIssuerRoom] = useState('');
  const [issuerBuilding, setIssuerBuilding] = useState('');
  const [issuerStreet, setIssuerStreet] = useState('');
  const [issuerDistrict, setIssuerDistrict] = useState('');
  const [issuerRegion, setIssuerRegion] = useState('');
  const [issuerEmail, setIssuerEmail] = useState('');
  const [issuerPhone, setIssuerPhone] = useState('');

  const relevantBanks = bankAccounts.filter(b => b.companyName === fullCompanyName);
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');
  const matchedBank = relevantBanks.find(
    b => b.bankName === selectedBank && b.accountType === selectedAccountType
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      console.log('[NewProjectDialog] open => resetting. cameFromEditProject=', cameFromEditProject);
      setPageIndex(initialPageIndex || 0);
      if (cameFromEditProject && existingProjectNumber && existingProjectDate) {
        console.log('[NewProjectDialog] using existing project date/number =>', existingProjectNumber, existingProjectDate);
        setProjectNumber(existingProjectNumber);
        setProjectDate(existingProjectDate);
        setEditingProjectNumber(false);
      } else {
        setProjectNumber(defaultProjectNumber);
        setEditingProjectNumber(false);
        setProjectDate('');
      }
      setClientCompany('');
      setManualCompany('');
      setUseManualCompany(false);
      setProjectTitle('');
      setProjectNature('');
      setAmount('');
      setIssuerEnglish(subsidiaryInfo?.englishName || fullCompanyName);
      setIssuerChinese(subsidiaryInfo?.chineseName || '');
      setIssuerRoom(subsidiaryInfo?.room || '');
      setIssuerBuilding(subsidiaryInfo?.building || '');
      setIssuerStreet(subsidiaryInfo?.street || '');
      setIssuerDistrict(subsidiaryInfo?.district || '');
      setIssuerRegion(subsidiaryInfo?.region || '');
      setIssuerEmail(subsidiaryInfo?.email || '');
      setIssuerPhone(subsidiaryInfo?.phone || '');
      setSelectedBank('');
      setSelectedAccountType('');
    }
  }, [
    open,
    initialPageIndex,
    defaultProjectNumber,
    cameFromEditProject,
    existingProjectNumber,
    existingProjectDate,
    subsidiaryInfo,
    bankAccounts,
    fullCompanyName,
  ]);

  async function saveProjectData() {
    if (cameFromEditProject) {
      console.log('[NewProjectDialog] cameFromEditProject => skip creating new row in the sheet');
      return;
    }
    if (!fileId) throw new Error('No fileId provided');
    if (!projectNumber) throw new Error('Project Number is required');
    if (!projectDate) throw new Error('Project Date is required');
    if (!projectTitle) throw new Error('Project Title is required');
    if (!amount) throw new Error('Amount is required');
    const invCo = useManualCompany ? manualCompany : clientCompany;
    if (!invCo) throw new Error('Client Company is required');
    console.log('[NewProjectDialog] POST new project => number=', projectNumber, ' date=', projectDate);
    const payload = {
      fileId,
      projectNumber,
      projectDate,
      agent: '',
      invoiceCompany: invCo,
      projectTitle,
      projectNature,
      amount: parseFloat(amount || '0'),
      paid: false,
      paidOnDate: '',
    };
    const resp = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      const errMsg = errJson.error || 'New project creation failed';
      console.error('[NewProjectDialog] creation error =>', errMsg);
      throw new Error(errMsg);
    }
    console.log('[NewProjectDialog] project created => success');
  }

  async function handleSaveAndExit() {
    try {
      await saveProjectData();
      onProjectAdded();
      onClose();
    } catch (err: any) {
      console.error('[NewProjectDialog] handleSaveAndExit => error:', err);
      alert(`Error: ${err.message}`);
    }
  }

  async function handleSaveAndNext() {
    try {
      await saveProjectData();
      setPageIndex(1);
    } catch (err: any) {
      console.error('[NewProjectDialog] handleSaveAndNext => error:', err);
      alert(`Error: ${err.message}`);
    }
  }

  function handleBack() {
    console.log('[NewProjectDialog] user clicked BACK => pageIndex=', pageIndex);
    if (pageIndex === 1 && cameFromEditProject && onGoBackToEditProject) {
      onGoBackToEditProject();
    } else {
      if (pageIndex > 0) {
        setPageIndex(pageIndex - 1);
      }
    }
  }

  function handleFinish() {
    console.log('[NewProjectDialog] user clicked FINISH => close. no invoice logic');
    onClose();
  }

  // Compute invoice number from projectDate and projectNumber.
  function computeInvoiceNumber(dateStr: string, pNum: string): string {
    if (!dateStr || !pNum) return '???';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '???';
    const y = parts[0];
    const mmdd = parts[1] + parts[2];
    const dashIdx = pNum.lastIndexOf('-');
    if (dashIdx === -1) return `${y}-${mmdd}-???`;
    const nnn = pNum.slice(dashIdx + 1);
    return `${y}-${mmdd}-${nnn}`;
  }
  const invoiceNumber = computeInvoiceNumber(projectDate, projectNumber);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {pageIndex === 0 && (
        <>
          <DialogTitle>New Project - Basic Info</DialogTitle>
          <DialogContent dividers>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Company: {fullCompanyName} (Year: {yearCode})
            </Typography>
            <NewProjectPage1
              projectNumber={projectNumber}
              setProjectNumber={setProjectNumber}
              editingProjectNumber={editingProjectNumber}
              setEditingProjectNumber={setEditingProjectNumber}
              projectDate={projectDate}
              setProjectDate={setProjectDate}
              clientCompany={clientCompany}
              setClientCompany={setClientCompany}
              manualCompany={manualCompany}
              setManualCompany={setManualCompany}
              useManualCompany={useManualCompany}
              setUseManualCompany={setUseManualCompany}
              projectTitle={projectTitle}
              setProjectTitle={setProjectTitle}
              projectNature={projectNature}
              setProjectNature={setProjectNature}
              amount={amount}
              setAmount={setAmount}
              clientsData={clientsData}
              onClose={onClose}
              handleSaveAndExit={handleSaveAndExit}
              handleSaveAndNext={handleSaveAndNext}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="outlined" onClick={handleSaveAndExit}>
              Save & Exit
            </Button>
            <Button variant="contained" onClick={handleSaveAndNext}>
              Save & Next
            </Button>
          </DialogActions>
        </>
      )}
      {pageIndex === 1 && (
        <>
          {/* The invoice header has been moved to DialogTitle */}
          <DialogTitle>Create Invoice - {invoiceNumber}</DialogTitle>
          <DialogContent dividers>
            <NewProjectPage2
              projectDate={projectDate}
              projectNumber={projectNumber}
              issuerEnglish={issuerEnglish}
              issuerChinese={issuerChinese}
              issuerRoom={issuerRoom}
              issuerBuilding={issuerBuilding}
              issuerStreet={issuerStreet}
              issuerDistrict={issuerDistrict}
              issuerRegion={issuerRegion}
              issuerEmail={issuerEmail}
              issuerPhone={issuerPhone}
              relevantBanks={relevantBanks}
              selectedBank={selectedBank}
              setSelectedBank={setSelectedBank}
              selectedAccountType={selectedAccountType}
              setSelectedAccountType={setSelectedAccountType}
              matchedBank={matchedBank}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleBack}>Back</Button>
            <Button variant="outlined" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleFinish}>
              Finish
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
