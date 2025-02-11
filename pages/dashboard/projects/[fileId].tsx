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

// Instead of the old import from '../../components/NewProjectDialog' or 'EditProject',
// we now import from the new folder paths:
import NewProject from '../../../components/projectdialog/newprojectdialog/NewProject';
import EditProject from '../../../components/projectdialog/editprojectdialog/EditProject';

// Types
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
  invoiceUrl?: string; // to store hyperlink if any
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
  projects: SingleProjectData[];
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
  projects,
  error,
  yearCode,
  fullCompanyName,
  clients,
  bankAccounts,
  subsidiaryInfo,
}: FileViewProps) {
  const router = useRouter();

  // For "New Project"
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [wizardPage, setWizardPage] = useState(0);

  function handleNewProject() {
    setWizardPage(0);
    setNewDialogOpen(true);
  }
  function handleCloseNewDialog() {
    setNewDialogOpen(false);
  }
  function handleNewProjectAdded() {
    router.replace(router.asPath);
  }

  // For "Edit Project"
  const [editOpen, setEditOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SingleProjectData | null>(null);

  function handleProjectClick(proj: SingleProjectData) {
    setSelectedProject(proj);
    setEditOpen(true);
  }
  function handleCloseEditDialog() {
    setEditOpen(false);
    setSelectedProject(null);
  }
  function handleEditUpdated() {
    router.replace(router.asPath);
  }

  // If user chooses "Create Invoice" in read-only => open new project wizard page=1
  // with existing date/number
  function handleCreateInvoiceFromEditDialog() {
    if (!selectedProject) {
      alert('No selected project to form an invoice from!');
      return;
    }
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

      {/* NewProject => multi-page wizard */}
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
        existingProjectNumber={selectedProject?.projectNumber}
        existingProjectDate={selectedProject?.projectDate}
      />

      {/* EditProject => orchestrator */}
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

// SSR
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

    // read file meta => parse year & short code
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

    // find PMS Reference Log
    const pmsRefLogId = await findPMSReferenceLogFile(drive);

    // reference mapping => shortCode => full name
    const refMapping = await fetchReferenceNames(sheets, pmsRefLogId);
    const fullCompanyName = refMapping[shortCode] || shortCode;

    // fetch projects from the Project Overview file
    const projects = await fetchProjectRows(sheets, fileId, 6);

    // addressBook => clients
    const addressBook = await fetchAddressBook(sheets, pmsRefLogId);
    const clients = addressBook.map((c) => ({ companyName: c.companyName }));

    // bank accounts
    let bankAccounts = await fetchBankAccounts(sheets, pmsRefLogId);

    // subsidiary info => for newProject page2
    const allSubsidiaries = await fetchSubsidiaryData(sheets, pmsRefLogId);
    const row = allSubsidiaries.find((r) => r.identifier === shortCode) || null;

    return {
      props: {
        fileId,
        fileLabel: `${fullCompanyName} - ${yearCode}`,
        projects,
        yearCode,
        fullCompanyName,
        clients,
        bankAccounts,
        subsidiaryInfo: row,
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
