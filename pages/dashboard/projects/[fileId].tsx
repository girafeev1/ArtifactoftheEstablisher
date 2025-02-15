// pages/dashboard/projects/[fileId].tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

import SidebarLayout from '../../../components/SidebarLayout';
import {
  findPMSReferenceLogFile,
  fetchReferenceNames,
  fetchAddressBook,
  fetchBankAccounts,
  fetchSubsidiaryData
} from '../../../lib/pmsReference';

import { initializeApis } from '../../../lib/googleApi';
import { fetchProjectRows } from '../../../lib/projectOverview';

import { Box, Typography, Card, CardContent, List, ListItem, ListItemText, IconButton, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Import dialogs – these are our fully functional components.
import NewProject from '../../../components/projectdialog/newprojectdialog/NewProject';
import EditProject from '../../../components/projectdialog/editprojectdialog/EditProject';

interface SingleProjectData {
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
interface BankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  comments?: string;
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
interface FileViewProps {
  fileId: string;
  fileLabel: string;
  projects?: SingleProjectData[];
  error?: string;
  yearCode: string;
  fullCompanyName: string;
  clients: { companyName: string }[];
  bankAccounts: BankAccount[];
  subsidiaryInfo?: SubsidiaryData | null;
}

export default function SingleFilePage({
  fileId,
  fileLabel,
  projects = [],
  error,
  yearCode,
  fullCompanyName,
  clients,
  bankAccounts,
  subsidiaryInfo,
}: FileViewProps) {
  const router = useRouter();

  // State for the NewProject wizard and EditProject dialog.
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [wizardPage, setWizardPage] = useState(0);

  // Preserve existing project data when creating an invoice.
  const [existingNumber, setExistingNumber] = useState<string | undefined>(undefined);
  const [existingDate, setExistingDate] = useState<string | undefined>(undefined);

  function handleNewProject() {
    setExistingNumber(undefined);
    setExistingDate(undefined);
    setWizardPage(0);
    setNewDialogOpen(true);
  }
  function handleCloseNewDialog() {
    setNewDialogOpen(false);
  }
  function handleNewProjectAdded() {
    router.replace(router.asPath);
  }

  // For editing a project.
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SingleProjectData | null>(null);

  function handleProjectClick(proj: SingleProjectData) {
    setSelectedProject(proj);
    setEditOpen(true);
  }
  function handleCloseEditDialog() {
    setEditOpen(false);
  }
  function handleEditUpdated() {
    router.replace(router.asPath);
  }

  // When "Create Invoice" is clicked in the EditProject dialog, preserve the project number and pickup date.
  function handleCreateInvoiceFromEditDialog() {
    if (!selectedProject) {
      alert('No selected project to form an invoice from!');
      return;
    }
    console.log('[Parent] Create Invoice from edit for project:', selectedProject);
    setExistingNumber(selectedProject.projectNumber);
    setExistingDate(selectedProject.projectDate);
    setEditOpen(false);
    setWizardPage(1);
    setNewDialogOpen(true);
  }

  function handleGoBackToEditProject() {
    setNewDialogOpen(false);
    setWizardPage(0);
    if (selectedProject) {
      setEditOpen(true);
    }
  }

  function handleBack() {
    router.push('/dashboard/projects');
  }

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5">{fileLabel}</Typography>
          <Typography variant="subtitle1">Project Overview</Typography>
        </Box>
        <Button variant="contained" onClick={handleNewProject}>
          New Project
        </Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Project List
          </Typography>
          {projects.length === 0 ? (
            <Typography>No project rows found.</Typography>
          ) : (
            <List>
              {projects.map((proj) => (
                <ListItem
                  key={proj.projectNumber}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProjectClick(proj)}
                >
                  <ListItemText
                    primary={`${proj.projectNumber} — ${proj.projectTitle}`}
                    secondary={`$${proj.amount} | ${proj.paid === 'TRUE' ? 'Paid' : 'Unpaid'}${
                      proj.paid === 'TRUE' && proj.paidOnDate ? ` | ${proj.paidOnDate}` : ''
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* NewProject wizard (multi‑page) */}
      <NewProject
        open={newDialogOpen}
        onClose={handleCloseNewDialog}
        onProjectAdded={handleNewProjectAdded}
        fileId={fileId}
        yearCode={yearCode}
        fullCompanyName={fullCompanyName}
        clientsData={clients}
        bankAccounts={bankAccounts}
        subsidiaryInfo={subsidiaryInfo}
        initialPageIndex={wizardPage}
        cameFromEditProject={wizardPage === 1}
        onGoBackToEditProject={handleGoBackToEditProject}
        existingProjectNumber={existingNumber}
        existingProjectDate={existingDate}
        existingProjects={projects}
      />

      {/* EditProject orchestrator */}
      <EditProject
        open={editOpen}
        onClose={handleCloseEditDialog}
        fileId={fileId}
        initialProject={selectedProject}
        onUpdated={handleEditUpdated}
        bankAccounts={bankAccounts}
        companyNameOfFile={fullCompanyName}
        onCreateInvoice={handleCreateInvoiceFromEditDialog}
      />
    </SidebarLayout>
  );
}

// SSR: Fetch live data from Google Sheets.
export const getServerSideProps: GetServerSideProps<FileViewProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }

  const fileId = ctx.params?.fileId as string;
  if (!fileId) {
    return { notFound: true };
  }

  try {
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    // Get file metadata and parse year and subsidiary code.
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'id, name',
      supportsAllDrives: true,
    });
    const rawName = fileMeta.data.name || '';
    let yearCode = '';
    let shortCode = '';
    const re = /^(\d{4})\s+(\S+)\s+Project Overview/i;
    const match = rawName.match(re);
    if (match) {
      yearCode = match[1];
      shortCode = match[2];
    }

    // Fetch PMS Reference Log data.
    const pmsRefLogId = await findPMSReferenceLogFile(drive);
    const refMapping = await fetchReferenceNames(sheets, pmsRefLogId);
    const fullCompanyName = refMapping[shortCode] || shortCode;
    const projects = await fetchProjectRows(sheets, fileId, 6);
    const addressBook = await fetchAddressBook(sheets, pmsRefLogId);
    const clients = addressBook.map((c) => ({ companyName: c.companyName }));
    const bankAccounts = await fetchBankAccounts(sheets, pmsRefLogId);
    const allSubsidiaries = await fetchSubsidiaryData(sheets, pmsRefLogId);
    const subsidiaryInfo = allSubsidiaries.find((r) => r.identifier === shortCode) || null;

    return {
      props: {
        fileId,
        fileLabel: `${fullCompanyName} - ${yearCode}`,
        projects,
        yearCode,
        fullCompanyName,
        clients,
        bankAccounts,
        subsidiaryInfo,
      },
    };
  } catch (err: any) {
    console.error('[getServerSideProps fileId] error:', err);
    return {
      props: {
        fileId,
        fileLabel: '',
        projects: [],
        yearCode: '',
        fullCompanyName: '',
        clients: [],
        bankAccounts: [],
        subsidiaryInfo: null,
        error: err.message || 'Error retrieving file data',
      },
    };
  }
};
