// pages/dashboard/businesses/[fileId].tsx

import { useRouter } from 'next/router';
import React, { useState, useMemo, useEffect } from 'react';
import SidebarLayout from '../../../components/SidebarLayout';
import { ProjectRow } from '../../../lib/projectOverview';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemText, IconButton, Button, FormControl, InputLabel, Select, MenuItem, ToggleButton, ToggleButtonGroup } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ProjectOverview from '../../../components/projectdialog/ProjectOverview';
import { useSnackbar } from 'notistack';
import { drive_v3 } from 'googleapis';

interface SingleProjectData extends ProjectRow {}

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
  projectsByCategory: Record<string, Array<{
    companyIdentifier: string;
    fullCompanyName: string;
    file: drive_v3.Schema$File;
  }>>;
  referenceMapping: Record<string, string>;
}

export default function SingleFilePage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SingleProjectData | null>(null);
  const [data, setData] = useState<FileViewProps | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const id = (router.query.fileId as string) || 'select';
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/businesses/${id}`)
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => {});
  }, [router.isReady, router.query.fileId]);

  if (!data) {
    return (
      <SidebarLayout>
        <Box sx={{ p: 2 }}>
          <Typography>Loading...</Typography>
        </Box>
      </SidebarLayout>
    );
  }

  const {
    fileId,
    fileLabel,
    projects,
    error,
    yearCode,
    fullCompanyName,
    clients,
    bankAccounts,
    subsidiaryInfo,
    projectsByCategory,
    referenceMapping,
  } = data;

  // Sorting page state
  const [sortMethod, setSortMethod] = useState<'year' | 'company'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  // Compute files list with mapped full company names
  const allFiles = useMemo(() => {
    return Object.entries(projectsByCategory)
      .flatMap(([year, items]) =>
        items.map(item => ({
          fileId: item.file.id!,
          year,
          companyIdentifier: item.companyIdentifier,
          fullCompanyName: referenceMapping[item.companyIdentifier] || item.companyIdentifier,
        }))
      );
  }, [projectsByCategory, referenceMapping]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(allFiles.map(f => f.year))).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [allFiles]);

  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(allFiles.map(f => f.fullCompanyName))).sort();
  }, [allFiles]);

  useEffect(() => {
    if (sortMethod === 'year' && uniqueYears.length > 0 && !selectedYear) {
      setSelectedYear(uniqueYears[0]);
      setSelectedCompany('');
    } else if (sortMethod === 'company' && uniqueCompanies.length > 0 && !selectedCompany) {
      setSelectedCompany(uniqueCompanies[0]);
      setSelectedYear('');
    }
  }, [sortMethod, uniqueYears, uniqueCompanies]);

  // Filter files based on selection.
  // For "By Year": show files with matching year, and display full company names.
  // For "By Company": show files with matching company, and display the year.
  const filteredFiles = useMemo(() => {
    if (sortMethod === 'year') {
      return allFiles.filter(f => f.year === selectedYear);
    } else {
      return allFiles.filter(f => f.fullCompanyName === selectedCompany);
    }
  }, [allFiles, sortMethod, selectedYear, selectedCompany]);

  // When fileId === 'select', show the file selection (sorting) page.
  if (fileId === 'select') {
    return (
      <SidebarLayout>
        <Box sx={{ p: 2 }}>
          <Typography variant="h4" gutterBottom>Projects</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {sortMethod === 'year' && uniqueYears.length > 0 && (
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={selectedYear}
                    label="Year"
                    onChange={(e) => setSelectedYear(e.target.value as string)}
                  >
                    {uniqueYears.map((year) => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {sortMethod === 'company' && uniqueCompanies.length > 0 && (
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={selectedCompany}
                    label="Company"
                    onChange={(e) => setSelectedCompany(e.target.value as string)}
                  >
                    {uniqueCompanies.map((company) => (
                      <MenuItem key={company} value={company}>{company}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <ToggleButtonGroup
                value={sortMethod}
                exclusive
                onChange={(e, newMethod) => {
                  if (newMethod) {
                    setSortMethod(newMethod);
                    if (newMethod === 'year' && uniqueYears.length > 0) {
                      setSelectedYear(uniqueYears[0]);
                      setSelectedCompany('');
                    } else if (newMethod === 'company' && uniqueCompanies.length > 0) {
                      setSelectedCompany(uniqueCompanies[0]);
                      setSelectedYear('');
                    }
                  }
                }}
                size="small"
              >
                <ToggleButton value="year">By Year</ToggleButton>
                <ToggleButton value="company">By Company</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
              New Project
            </Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {filteredFiles.length === 0 ? (
              <Typography>No Project Overview files found.</Typography>
            ) : (
              filteredFiles.map((file) => (
                <Card
                  key={file.fileId}
                  sx={{ cursor: 'pointer', width: 240 }}
                  onClick={() => router.push(`/dashboard/businesses/${file.fileId}`)}
                >
                  <CardContent>
                    {sortMethod === 'year' ? (
                      <Typography variant="h6">{file.fullCompanyName}</Typography>
                    ) : (
                      <Typography variant="h6">{file.year}</Typography>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        </Box>
      </SidebarLayout>
    );
  }

  // Specific project file view
  const handleNewProject = () => {
    setSelectedProject(null);
    setDialogOpen(true);
  };

  const handleProjectClick = (proj: SingleProjectData) => {
    setSelectedProject(proj);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedProject(null);
  };

  const handleProjectAddedOrUpdated = () => {
    enqueueSnackbar('Update Success', { variant: 'success' });
    router.replace(router.asPath);
    handleCloseDialog();
  };

  const handleBack = () => {
    router.push('/dashboard/businesses/select');
  };

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
          <Typography variant="h6" gutterBottom>Project List</Typography>
          {projects.length === 0 ? (
            <Typography>No project rows found.</Typography>
          ) : (
            <List>
              {projects.map((proj) => (
                <ListItem key={proj.projectNumber} sx={{ cursor: 'pointer' }} onClick={() => handleProjectClick(proj)}>
                  <ListItemText
                    primary={`${proj.projectNumber} — ${proj.presenter ? proj.presenter + ' - ' : ''}${proj.projectTitle}`}
                    secondary={`HK$${Number(proj.amount).toLocaleString()} | ${
                      proj.paid === 'TRUE' ? 'Paid' : 'Unpaid'
                    }${
                      proj.paid === 'TRUE' && proj.paidOnDate ? ` | ${proj.paidOnDate}` : ''
                    } | ${proj.invoiceCompany}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      {dialogOpen && (
        <ProjectOverview
          open={dialogOpen}
          onClose={handleCloseDialog}
          onProjectAdded={handleProjectAddedOrUpdated}
          fileId={fileId}
          yearCode={yearCode}
          fullCompanyName={fullCompanyName}
          clientsData={clients}
          bankAccounts={bankAccounts}
          subsidiaryInfo={subsidiaryInfo}
          initialProject={selectedProject || undefined}
          projects={projects}
        />
      )}
    </SidebarLayout>
  );
}

