// components/projectdialog/newprojectdialog/NewProject.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import NewProjectPage1 from './NewProjectPage1';
import NewProjectPage2 from './NewProjectPage2';

export interface ProjectRow {
  projectNumber: string;
  // Other fields not used here
}
interface ClientEntry {
  companyName: string;
}
export interface InvoiceBankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  // Now, identifier comes from column I
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

interface NewProjectProps {
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
  existingProjects?: ProjectRow[];
}

function computeNextProjectNumber(year: string, projects: ProjectRow[]): string {
  let max = 0;
  projects.forEach(p => {
    const m = p.projectNumber.trim().match(/^#?(\d{4})-(\d{3})$/);
    if (m && m[1] === year) {
      const num = parseInt(m[2], 10);
      if (num > max) max = num;
    }
  });
  const next = String(max + 1).padStart(3, '0');
  return `#${year}-${next}`;
}

function computeInvoiceNumber(dateStr: string, pNum: string): string {
  console.log('[NewProject] computeInvoiceNumber inputs:', dateStr, pNum);
  if (!dateStr || !pNum) {
    console.warn('[NewProject] Either project date or project number is missing => ???');
    return '???';
  }
  // Ensure date is in YYYY-MM-DD format
  let formattedDate = dateStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const tmp = new Date(dateStr);
    if (isNaN(tmp.valueOf())) return '???';
    const y = tmp.getFullYear();
    const mm = String(tmp.getMonth() + 1).padStart(2, '0');
    const dd = String(tmp.getDate()).padStart(2, '0');
    formattedDate = `${y}-${mm}-${dd}`;
  }
  const parts = formattedDate.split('-');
  const mmdd = parts[1] + parts[2];
  const cleaned = pNum.startsWith('#') ? pNum.slice(1) : pNum;
  const yearFromPNum = cleaned.slice(0, 4);
  const dashIdx = cleaned.lastIndexOf('-');
  const nnn = dashIdx !== -1 ? cleaned.slice(dashIdx + 1) : '???';
  const final = `${yearFromPNum}-${mmdd}-${nnn}`;
  console.log('[NewProject] computeInvoiceNumber =>', final);
  return final;
}

const useInvoiceNumber = (projectDate: string, projectNumber: string, cameFromEditProject: boolean) => {
  return useMemo(() => {
    if (cameFromEditProject && projectDate && projectNumber) {
      return computeInvoiceNumber(projectDate, projectNumber);
    }
    if (!projectDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const fallback = `${y}-${m}-${d}`;
      console.log('[NewProject] fallback projectDate =>', fallback);
      return computeInvoiceNumber(fallback, projectNumber);
    }
    return computeInvoiceNumber(projectDate, projectNumber);
  }, [projectDate, projectNumber, cameFromEditProject]);
};

export default function NewProject(props: NewProjectProps) {
  const {
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
    existingProjects = [],
  } = props;

  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [projectNumber, setProjectNumber] = useState(defaultProjectNumber);
  const [editingProjectNumber, setEditingProjectNumber] = useState(false);
  const [projectDate, setProjectDate] = useState('');

  // Bank dropdown state for NewProjectPage2
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');

  const invoiceNumber = useInvoiceNumber(projectDate, projectNumber, cameFromEditProject);

  useEffect(() => {
    console.log('[NewProject] open=', open, 'cameFromEditProject=', cameFromEditProject);
    console.log('[NewProject] existingProjectNumber=', existingProjectNumber, 'existingProjectDate=', existingProjectDate);
    if (open) {
      setPageIndex(initialPageIndex);
      if (cameFromEditProject && existingProjectNumber && existingProjectDate) {
        setProjectNumber(existingProjectNumber);
        setProjectDate(existingProjectDate);
        setEditingProjectNumber(false);
      } else {
        if (existingProjects.length > 0) {
          const nextNum = computeNextProjectNumber(yearCode, existingProjects);
          console.log('[NewProject] Next project number computed:', nextNum);
          setProjectNumber(nextNum);
        } else if (!defaultProjectNumber) {
          setProjectNumber(`#${yearCode}-001`);
        } else {
          setProjectNumber(defaultProjectNumber);
        }
        setEditingProjectNumber(false);
        setProjectDate('');
      }
    }
  }, [open, initialPageIndex, cameFromEditProject, existingProjectNumber, existingProjectDate, existingProjects, defaultProjectNumber, yearCode]);

  async function saveProjectData() {
    if (cameFromEditProject) {
      console.log('[NewProject] cameFromEditProject => skipping new row creation');
      return;
    }
    if (!fileId) throw new Error('No fileId provided');
    if (!projectNumber) throw new Error('Project Number is required');
    if (!projectDate) throw new Error('Project Date is required');
    // Here you would normally POST the new project data to your API.
  }

  async function handleSaveAndExit() {
    try {
      await saveProjectData();
      onProjectAdded();
      onClose();
    } catch (err: any) {
      console.error('[NewProject] handleSaveAndExit error:', err);
      alert(err.message);
    }
  }

  async function handleSaveAndNext() {
    try {
      await saveProjectData();
      setPageIndex(1);
    } catch (err: any) {
      console.error('[NewProject] handleSaveAndNext error:', err);
      alert(err.message);
    }
  }

  function handleBack() {
    if (pageIndex === 1 && cameFromEditProject && onGoBackToEditProject) {
      onGoBackToEditProject();
    } else if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
  }

  function handleFinish() {
    onClose();
  }

  console.log('[NewProject] invoiceNumber:', invoiceNumber);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {pageIndex === 0 ? (
        <>
          <DialogTitle>New Project - Basic Info</DialogTitle>
          <DialogContent dividers>
            <NewProjectPage1
              projectNumber={projectNumber}
              setProjectNumber={setProjectNumber}
              editingProjectNumber={editingProjectNumber}
              setEditingProjectNumber={setEditingProjectNumber}
              projectDate={projectDate}
              setProjectDate={setProjectDate}
              clientCompany={''}
              setClientCompany={() => {}}
              manualCompany={''}
              setManualCompany={() => {}}
              useManualCompany={false}
              setUseManualCompany={() => {}}
              projectTitle={''}
              setProjectTitle={() => {}}
              projectNature={''}
              setProjectNature={() => {}}
              amount={''}
              setAmount={() => {}}
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
      ) : (
        <>
          <DialogTitle>Create Invoice - {invoiceNumber}</DialogTitle>
          <DialogContent dividers>
            <NewProjectPage2
              projectDate={projectDate}
              projectNumber={projectNumber}
              issuerEnglish={subsidiaryInfo?.englishName || fullCompanyName}
              issuerChinese={subsidiaryInfo?.chineseName || ''}
              issuerRoom={subsidiaryInfo?.room || ''}
              issuerBuilding={subsidiaryInfo?.building || ''}
              issuerStreet={subsidiaryInfo?.street || ''}
              issuerDistrict={subsidiaryInfo?.district || ''}
              issuerRegion={subsidiaryInfo?.region || ''}
              issuerEmail={subsidiaryInfo?.email || ''}
              issuerPhone={subsidiaryInfo?.phone || ''}
              relevantBanks={bankAccounts}
              selectedBank={selectedBank}
              setSelectedBank={setSelectedBank}
              selectedAccountType={selectedAccountType}
              setSelectedAccountType={setSelectedAccountType}
              matchedBank={bankAccounts.find(
                (ba) =>
                  ba.bankName === selectedBank && ba.accountType === selectedAccountType
              )}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleBack}>Back</Button>
            <Button variant="outlined" onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleFinish}>Finish</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
