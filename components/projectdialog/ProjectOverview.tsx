// components/projectdialog/ProjectOverview.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import NewProjectDialog from './NewProjectDialog';
import ViewProjectDialog from './ViewProjectDialog';
import EditProjectDialog from './EditProjectDialog';
import CreateInvoice from '../invoicedialog/CreateInvoice';

export interface ProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl?: string;
}

export interface ClientEntry {
  companyName: string;
  title: string;
  nameAddressed: string;
  emailAddress: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  addressLine5: string;
}

export interface InvoiceBankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  identifier?: string;
}

export interface SubsidiaryData {
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

type Mode = 'new' | 'view' | 'edit';

interface ProjectOverviewProps {
  open: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  fileId: string;
  yearCode: string;
  fullCompanyName: string;
  clientsData: ClientEntry[];
  bankAccounts: InvoiceBankAccount[];
  subsidiaryInfo: SubsidiaryData | null;
  projects: ProjectData[];
  initialProject?: ProjectData;
}

function computeNextProjectNumber(year: string, projects: ProjectData[]): string {
  let max = 0;
  projects.forEach((p) => {
    const m = p.projectNumber.trim().match(/^#?(\d{4})-(\d{3})$/);
    if (m && m[1] === year) {
      const num = parseInt(m[2], 10);
      if (num > max) max = num;
    }
  });
  const next = String(max + 1).padStart(3, '0');
  return `#${year}-${next}`;
}

export default function ProjectOverview({
  open,
  onClose,
  onProjectAdded,
  fileId,
  yearCode,
  fullCompanyName,
  clientsData,
  bankAccounts,
  subsidiaryInfo,
  projects,
  initialProject,
}: ProjectOverviewProps) {
  const [mode, setMode] = useState<Mode>(initialProject ? 'view' : 'new');
  const [projectData, setProjectData] = useState<ProjectData>(
    initialProject || {
      projectNumber: '',
      projectDate: '',
      agent: '',
      invoiceCompany: '',
      projectTitle: '',
      projectNature: '',
      amount: '',
      paid: 'FALSE',
      paidOnDate: '',
      bankAccountIdentifier: '',
      invoice: '',
    }
  );
  const [editingProjectNumber, setEditingProjectNumber] = useState<boolean>(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');
  const [useManualCompany, setUseManualCompany] = useState(false); // Added for NewProjectDialog
  const [manualCompany, setManualCompany] = useState(''); // Added for NewProjectDialog

  useEffect(() => {
    if (initialProject) {
      setMode('view');
      let updatedProject = { ...initialProject };
      if (initialProject.projectDate) {
        const parsedPickup = new Date(initialProject.projectDate);
        if (!isNaN(parsedPickup.getTime())) {
          const localDate = new Date(parsedPickup.getTime() - parsedPickup.getTimezoneOffset() * 60000);
          updatedProject.projectDate = localDate.toISOString().split('T')[0];
        }
      }
      if (initialProject.paidOnDate) {
        const parsedPaidOn = new Date(initialProject.paidOnDate);
        if (!isNaN(parsedPaidOn.getTime())) {
          const localDate = new Date(parsedPaidOn.getTime() - parsedPaidOn.getTimezoneOffset() * 60000);
          updatedProject.paidOnDate = localDate.toISOString().split('T')[0];
        }
      }
      setProjectData(updatedProject);
      setEditingProjectNumber(false);
      if (initialProject.bankAccountIdentifier && bankAccounts.length > 0) {
        const id = initialProject.bankAccountIdentifier.trim().toUpperCase();
        const match = bankAccounts.find(
          (ba) => (ba.identifier || '').trim().toUpperCase() === id
        );
        if (match) {
          setSelectedBank(match.bankName);
          setSelectedAccountType(match.accountType);
        }
      }
    } else {
      setMode('new');
      const newProjectNumber =
        projects.length > 0 ? computeNextProjectNumber(yearCode, projects) : `#${yearCode}-001`;
      setProjectData({
        projectNumber: newProjectNumber,
        projectDate: '',
        agent: '',
        invoiceCompany: '',
        projectTitle: '',
        projectNature: '',
        amount: '',
        paid: 'FALSE',
        paidOnDate: '',
        bankAccountIdentifier: '',
        invoice: '',
      });
      setEditingProjectNumber(false);
      setSelectedBank('');
      setSelectedAccountType('');
      setUseManualCompany(false);
      setManualCompany('');
    }
  }, [initialProject, projects, yearCode, bankAccounts]);

  const handleSaveAndExit = () => {
    onProjectAdded();
    onClose();
  };

  const handleSaveAndNext = () => {
    onProjectAdded();
    setMode('new');
    const newProjectNumber =
      projects.length > 0 ? computeNextProjectNumber(yearCode, projects) : `#${yearCode}-001`;
    setProjectData({
      projectNumber: newProjectNumber,
      projectDate: '',
      agent: '',
      invoiceCompany: '',
      projectTitle: '',
      projectNature: '',
      amount: '',
      paid: 'FALSE',
      paidOnDate: '',
      bankAccountIdentifier: '',
      invoice: '',
    });
    setEditingProjectNumber(false);
    setUseManualCompany(false);
    setManualCompany('');
  };

  const handleFinish = () => {
    onProjectAdded();
    onClose();
  };

  const handleViewPdf = () => {
    setAnchorEl(null);
    if (projectData.invoiceUrl) {
      window.open(projectData.invoiceUrl, '_blank');
    } else {
      alert('No invoice URL attached.');
    }
  };

  const handleOpenSheet = async () => {
    setAnchorEl(null);
    if (!projectData.invoice) {
      alert('No invoice number found!');
      return;
    }
    try {
      const title = encodeURIComponent(projectData.invoice);
      const res = await fetch(`/api/invoices/gid?fileId=${fileId}&title=${title}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Unable to fetch invoice GID');
      }
      const data = await res.json();
      const gid = data.sheetId;
      if (!gid) {
        alert(`No sheet named "${projectData.invoice}" found.`);
        return;
      }
      const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=${gid}`;
      window.open(googleSheetUrl, '_blank');
    } catch (err: any) {
      console.error('[EditProjectDialog] handleOpenSheet =>', err);
      alert(err.message);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        {mode === 'new' && (
          <>
            <DialogContent dividers>
              <NewProjectDialog
                projectNumber={projectData.projectNumber}
                setProjectNumber={(val) => setProjectData({ ...projectData, projectNumber: val })}
                editingProjectNumber={editingProjectNumber}
                setEditingProjectNumber={setEditingProjectNumber}
                projectDate={projectData.projectDate}
                setProjectDate={(val) => setProjectData({ ...projectData, projectDate: val })}
                clientCompany={projectData.invoiceCompany}
                setClientCompany={(val) => setProjectData({ ...projectData, invoiceCompany: val })}
                manualCompany={manualCompany}
                setManualCompany={setManualCompany}
                useManualCompany={useManualCompany}
                setUseManualCompany={setUseManualCompany}
                projectTitle={projectData.projectTitle}
                setProjectTitle={(val) => setProjectData({ ...projectData, projectTitle: val })}
                projectNature={projectData.projectNature}
                setProjectNature={(val) => setProjectData({ ...projectData, projectNature: val })}
                amount={projectData.amount}
                setAmount={(val) => setProjectData({ ...projectData, amount: val })}
                clientsData={clientsData} // Pass full clientsData
                handleSaveAndExit={handleSaveAndExit}
                handleSaveAndNext={handleSaveAndNext}
                fileId={fileId} // Pass fileId for API calls
              />
            </DialogContent>
          </>
        )}
        {mode === 'view' && projectData && (
          <ViewProjectDialog
            open={open}
            onClose={onClose}
            onEdit={() => setMode('edit')}
            onCreateInvoice={() => setInvoiceDialogOpen(true)}
            project={projectData}
            formattedAmount={projectData.amount}
            matchedBank={bankAccounts.find((ba) => ba.identifier === projectData.bankAccountIdentifier) || null}
            anchorEl={anchorEl}
            setAnchorEl={setAnchorEl}
            handleViewPdf={handleViewPdf}
          />
        )}
        {mode === 'edit' && projectData && (
          <EditProjectDialog
            open={open}
            onClose={onClose}
            project={projectData}
            setProject={setProjectData}
            bankAccounts={bankAccounts}
            companyNameOfFile={fullCompanyName}
            isPaid={projectData.paid === 'TRUE'}
            selectedBank={selectedBank}
            setSelectedBank={setSelectedBank}
            selectedAccountType={selectedAccountType}
            setSelectedAccountType={setSelectedAccountType}
            anchorEl={anchorEl}
            setAnchorEl={setAnchorEl}
            handleViewPdf={handleViewPdf}
            handleOpenSheet={handleOpenSheet}
            handleCreateInvoice={() => setInvoiceDialogOpen(true)}
            handleSave={handleFinish}
            handleDelete={() => {}}
            fileId={fileId}
          />
        )}
      </Dialog>
      {invoiceDialogOpen && (
        <CreateInvoice
          open={invoiceDialogOpen}
          onClose={() => setInvoiceDialogOpen(false)}
          onInvoiceUpdated={() => {
            setInvoiceDialogOpen(false);
            onProjectAdded();
          }}
          fileId={fileId}
          invoiceSheetId={projectData.invoice}
          projectDate={projectData.projectDate}
          projectNumber={projectData.projectNumber}
          subsidiaryInfo={subsidiaryInfo}
          issuerCompany={fullCompanyName}
          clientCompany={projectData.invoiceCompany}
          bankAccounts={bankAccounts}
        />
      )}
    </>
  );
}
