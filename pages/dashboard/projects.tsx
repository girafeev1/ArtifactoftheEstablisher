// pages/dashboard/projects.tsx

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeApis } from '../../lib/googleApi';
import {
  listProjectOverviewFiles,
  fetchReferenceNames,
  findPMSReferenceLogFile,
} from '../../lib/pmsReference';
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
import NewProjectDialog from '../../components/NewProjectDialog';

interface ProjectFileRecord {
  companyIdentifier: string;
  fullCompanyName: string;
  file: {
    id?: string;
    name?: string;
  };
}
interface ProjectsByYear {
  [year: string]: ProjectFileRecord[];
}
interface ProjectProps {
  projectsByCategory: ProjectsByYear;
  referenceMapping: Record<string, string>;
  error?: string;
}

export default function ProjectsPage({
  projectsByCategory,
  referenceMapping,
  error,
}: ProjectProps) {
  const router = useRouter();

  const [sortMethod, setSortMethod] = useState<'year' | 'company'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Flatten the objects for display */
  const allProjectsArray = useMemo(() => {
    const arr: (ProjectFileRecord & { year: string })[] = [];
    for (const [year, items] of Object.entries(projectsByCategory)) {
      items.forEach((proj) => {
        arr.push({ ...proj, year });
      });
    }
    return arr;
  }, [projectsByCategory]);

  /** Map short code to full name */
  const mappedProjects = useMemo(() => {
    return allProjectsArray.map((proj) => {
      const betterName =
        referenceMapping[proj.companyIdentifier] || proj.fullCompanyName;
      return {
        ...proj,
        displayCompanyName: betterName,
      };
    });
  }, [allProjectsArray, referenceMapping]);

  /** Unique years & companies */
  const uniqueYears = useMemo(() => {
    const s = new Set<string>();
    Object.keys(projectsByCategory).forEach((yr) => s.add(yr));
    return [...s].sort(); // ascending
  }, [projectsByCategory]);

  const uniqueCompanies = useMemo(() => {
    const s = new Set<string>();
    mappedProjects.forEach((p) => s.add(p.displayCompanyName));
    return [...s].sort(); // alphabetical
  }, [mappedProjects]);

  /** On sortMethod => pick default */
  useEffect(() => {
    if (sortMethod === 'year' && uniqueYears.length) {
      const maxYear = Math.max(...uniqueYears.map(Number));
      setSelectedYear(String(maxYear));
      setSelectedCompany('');
    } else if (sortMethod === 'company' && uniqueCompanies.length) {
      setSelectedCompany(uniqueCompanies[0]);
      setSelectedYear('');
    }
  }, [sortMethod, uniqueYears, uniqueCompanies]);

  /** Filter & sort */
  const filteredProjects = useMemo(() => {
    if (sortMethod === 'year') {
      if (!selectedYear) return mappedProjects;
      return mappedProjects.filter((p) => p.year === selectedYear);
    } else {
      if (!selectedCompany) return mappedProjects;
      return mappedProjects.filter(
        (p) => p.displayCompanyName === selectedCompany
      );
    }
  }, [mappedProjects, sortMethod, selectedYear, selectedCompany]);

  const sortedProjects = useMemo(() => {
    const clone = [...filteredProjects];
    if (sortMethod === 'year') {
      clone.sort((a, b) => b.year.localeCompare(a.year)); // descending
    } else {
      clone.sort((a, b) =>
        a.displayCompanyName.localeCompare(b.displayCompanyName)
      );
    }
    return clone;
  }, [filteredProjects, sortMethod]);

  /** Clicking a card => navigate */
  const handleCardClick = (fileId: string | undefined) => {
    if (!fileId) return;
    router.push(`/dashboard/projects/${fileId}`);
  };

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>
        Projects
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      {/* Top row: sort toggles, new project */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {sortMethod === 'year' && (
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {uniqueYears.map((yr) => (
                  <MenuItem key={yr} value={yr}>
                    {yr}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {sortMethod === 'company' && (
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Company</InputLabel>
              <Select
                value={selectedCompany}
                label="Company"
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                {uniqueCompanies.map((co) => (
                  <MenuItem key={co} value={co}>
                    {co}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <ToggleButtonGroup
            exclusive
            value={sortMethod}
            onChange={(_, val) => val && setSortMethod(val)}
            size="small"
          >
            <ToggleButton value="year">By Year</ToggleButton>
            <ToggleButton value="company">By Company</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Button variant="contained" onClick={() => setDialogOpen(true)}>
          New Project
        </Button>
      </Box>

      {/* Cards */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {sortedProjects.length === 0 ? (
          <Typography>No Project Overview files found.</Typography>
        ) : (
          sortedProjects.map((proj, idx) => {
            const fileId = proj.file.id || '';
            const mainLabel =
              sortMethod === 'year' ? proj.displayCompanyName : proj.year;

            return (
              <Card
                key={idx}
                sx={{
                  cursor: 'pointer',
                  width: 'fit-content',
                  minWidth: 280,
                }}
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

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onProjectAdded={() => setDialogOpen(false)}
        referenceNames={referenceMapping}
      />
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin/google', permanent: false },
    };
  }

  try {
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });
    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const referenceMapping = await fetchReferenceNames(sheets, pmsRefLogFileId);
    const projectsByCategory = await listProjectOverviewFiles(drive, []);

    return {
      props: {
        projectsByCategory,
        referenceMapping,
      },
    };
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
