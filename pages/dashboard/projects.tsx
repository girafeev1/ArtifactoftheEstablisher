// pages/dashboard/projects.tsx

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { findPMSReferenceLogFile, fetchReferenceNames } from '../../lib/pmsReference';
import { listProjectOverviewFiles } from '../../lib/projectOverview';
import { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Card,
  CardContent,
} from '@mui/material';

interface ProjectFileRecord {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id?: string; name?: string };
}
interface ProjectsByYear {
  [year: string]: ProjectFileRecord[];
}
interface ProjectProps {
  projectsByCategory: ProjectsByYear;
  referenceMapping: Record<string, string>;
  error?: string;
}

export default function ProjectsPage({ projectsByCategory, referenceMapping, error }: ProjectProps) {
  const router = useRouter();
  const [sortMethod, setSortMethod] = useState<'year' | 'company'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');

  const [dialogOpen, setDialogOpen] = useState(false);

  const allProjectsArray = useMemo(() => {
    const arr: (ProjectFileRecord & { year: string })[] = [];
    for (const [year, items] of Object.entries(projectsByCategory)) {
      items.forEach((proj) => arr.push({ ...proj, year }));
    }
    return arr;
  }, [projectsByCategory]);

  const mappedProjects = useMemo(() => {
    return allProjectsArray.map((proj) => {
      const betterName = referenceMapping[proj.companyIdentifier] || proj.fullCompanyName;
      return { ...proj, displayCompanyName: betterName };
    });
  }, [allProjectsArray, referenceMapping]);

  const uniqueYears = useMemo(() => {
    const allYears = Object.keys(projectsByCategory);
    return allYears.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [projectsByCategory]);

  const uniqueCompanies = useMemo(() => {
    const s = new Set<string>();
    mappedProjects.forEach((p) => s.add(p.displayCompanyName));
    return [...s].sort();
  }, [mappedProjects]);

  useEffect(() => {
    if (sortMethod === 'year' && uniqueYears.length) {
      setSelectedYear(uniqueYears[uniqueYears.length - 1]);
      setSelectedCompany('');
    } else if (sortMethod === 'company' && uniqueCompanies.length) {
      setSelectedCompany(uniqueCompanies[0]);
      setSelectedYear('');
    }
  }, [sortMethod, uniqueYears, uniqueCompanies]);

  const filteredProjects = useMemo(() => {
    if (sortMethod === 'year') {
      if (!selectedYear) return mappedProjects;
      return mappedProjects.filter((p) => p.year === selectedYear);
    } else {
      if (!selectedCompany) return mappedProjects;
      return mappedProjects.filter((p) => p.displayCompanyName === selectedCompany);
    }
  }, [mappedProjects, sortMethod, selectedYear, selectedCompany]);

  const sortedProjects = useMemo(() => {
    const clone = [...filteredProjects];
    if (sortMethod === 'year') {
      // sort descending by year
      clone.sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }));
    } else {
      clone.sort((a, b) => a.displayCompanyName.localeCompare(b.displayCompanyName));
    }
    return clone;
  }, [filteredProjects, sortMethod]);

  function handleCardClick(fileId: string | undefined) {
    if (!fileId) return;
    router.push(`/dashboard/projects/${fileId}`);
  }

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>Projects</Typography>
      {error && <Typography color="error">{error}</Typography>}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {sortMethod === 'year' && uniqueYears.length > 0 && (
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {uniqueYears.map((yr) => (
                  <MenuItem key={yr} value={yr}>{yr}</MenuItem>
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
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                {uniqueCompanies.map((co) => (
                  <MenuItem key={co} value={co}>{co}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <ToggleButtonGroup
            exclusive
            value={sortMethod}
            onChange={(_, val) => { if (val) setSortMethod(val); }}
            size="small"
          >
            <ToggleButton value="year">By Year</ToggleButton>
            <ToggleButton value="company">By Company</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {/* example placeholder => not sure if you are using a "global new project" here */}
        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New Project (Global Placeholder)
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {sortedProjects.length === 0 ? (
          <Typography>No Project Overview files found.</Typography>
        ) : (
          sortedProjects.map((proj, idx) => {
            const fileId = proj.file.id || '';
            const mainLabel = sortMethod === 'year' ? proj.displayCompanyName : proj.year;
            return (
              <Card
                key={idx}
                sx={{ cursor: 'pointer', width: 240 }}
                onClick={() => handleCardClick(fileId)}
              >
                <CardContent>
                  <Typography variant="h6">{mainLabel}</Typography>
                </CardContent>
              </Card>
            );
          })
        )}
      </Box>

      {dialogOpen && (
        <Typography sx={{ mt: 2 }}>
          Global New Project is not implemented yet. (Placeholder)
        </Typography>
      )}
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }

  const { initializeApis } = require('../../lib/googleApi');
  try {
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });

    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const referenceMapping = await fetchReferenceNames(sheets, pmsRefLogFileId);
    const projectsByCategory = await listProjectOverviewFiles(drive, []);

    return { props: { projectsByCategory, referenceMapping } };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return {
      props: {
        projectsByCategory: {},
        referenceMapping: {},
        error: err.message || 'Error fetching Project Overview files',
      },
    };
  }
};
