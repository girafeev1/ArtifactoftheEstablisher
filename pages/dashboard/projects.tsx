// pages/dashboard/projects.tsx

import { GetServerSideProps } from 'next';
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
  CardContent
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
  /**
   * State
   */
  const [sortMethod, setSortMethod] = useState<'year' | 'company'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [dialogOpen, setDialogOpen] = useState(false);

  /**
   * Convert the object { year: [ {proj}, ...], ... }
   * into a flat array for filtering & sorting in the UI
   */
  const allProjectsArray = useMemo(() => {
    const arr: (ProjectFileRecord & { year: string })[] = [];
    for (const [year, items] of Object.entries(projectsByCategory)) {
      items.forEach((proj) => {
        arr.push({ ...proj, year });
      });
    }
    return arr;
  }, [projectsByCategory]);

  /**
   * Map the companyIdentifier to a better display name if possible
   */
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

  /**
   * Unique years & companies for dropdowns
   */
  const uniqueYears = useMemo(() => {
    const s = new Set<string>();
    Object.keys(projectsByCategory).forEach((yr) => s.add(yr));
    return [...s].sort();
  }, [projectsByCategory]);

  const uniqueCompanies = useMemo(() => {
    const s = new Set<string>();
    mappedProjects.forEach((p) => s.add(p.displayCompanyName));
    return [...s].sort();
  }, [mappedProjects]);

  /**
   * Default to "year" sorting => pick the "latest" year
   * once uniqueYears is available
   */
  useEffect(() => {
    if (uniqueYears.length > 0) {
      // Convert them to numbers, find max, then set that as selectedYear
      const maxYear = Math.max(...uniqueYears.map(Number));
      setSelectedYear(String(maxYear));
    }
  }, [uniqueYears]);

  /**
   * Filter the mappedProjects based on user selection
   * but only apply the relevant filter:
   * - If sortMethod='year', use selectedYear
   * - If sortMethod='company', use selectedCompany
   */
  const filteredProjects = useMemo(() => {
    if (sortMethod === 'year') {
      // Filter by year
      if (selectedYear === 'All') {
        return mappedProjects;
      }
      return mappedProjects.filter((p) => p.year === selectedYear);
    } else {
      // Filter by company
      if (selectedCompany === 'All') {
        return mappedProjects;
      }
      return mappedProjects.filter(
        (p) => p.displayCompanyName === selectedCompany
      );
    }
  }, [mappedProjects, sortMethod, selectedYear, selectedCompany]);

  /**
   * Sort the filtered results
   * - If sortMethod='year', sort ascending by year
   * - If sortMethod='company', sort ascending by displayCompanyName
   */
  const sortedProjects = useMemo(() => {
    const clone = [...filteredProjects];
    if (sortMethod === 'year') {
      clone.sort((a, b) => a.year.localeCompare(b.year));
      // The "latest" year will appear last if sorting ascending.
      // If you prefer descending, swap a,b => b.year.localeCompare(a.year).
    } else {
      clone.sort((a, b) =>
        a.displayCompanyName.localeCompare(b.displayCompanyName)
      );
    }
    return clone;
  }, [filteredProjects, sortMethod]);

  /**
   * Handlers
   */
  const handleSortToggle = (
    _: React.MouseEvent<HTMLElement>,
    newVal: 'year' | 'company' | null
  ) => {
    if (newVal) {
      setSortMethod(newVal);
    }
  };

  const handleYearChange = (e: any) => {
    setSelectedYear(e.target.value);
  };

  const handleCompanyChange = (e: any) => {
    setSelectedCompany(e.target.value);
  };

  const handleProjectAdded = () => {
    // For minimal changes, we won't re-fetch.
    // Optionally, you could reload or do a client re-fetch:
    setDialogOpen(false);
  };

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>
        Projects
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      {/* Sort Toggle */}
      <ToggleButtonGroup
        exclusive
        value={sortMethod}
        onChange={handleSortToggle}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="year" aria-label="Sort by Year">
          By Year
        </ToggleButton>
        <ToggleButton value="company" aria-label="Sort by Company">
          By Company
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Only one dropdown at a time, based on sortMethod */}
      {sortMethod === 'year' && (
        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={handleYearChange}
            >
              <MenuItem value="All">All</MenuItem>
              {uniqueYears.map((yr) => (
                <MenuItem key={yr} value={yr}>
                  {yr}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      {sortMethod === 'company' && (
        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Company</InputLabel>
            <Select
              value={selectedCompany}
              label="Company"
              onChange={handleCompanyChange}
            >
              <MenuItem value="All">All</MenuItem>
              {uniqueCompanies.map((co) => (
                <MenuItem key={co} value={co}>
                  {co}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* New Project Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setDialogOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {/* Display results as cards */}
      {sortedProjects.length === 0 ? (
        <Typography>No Project Overview files found.</Typography>
      ) : (
        sortedProjects.map((proj, idx) => (
          <Card key={idx} sx={{ mb: 2 }}>
            <CardContent>
              {sortMethod === 'year' ? (
                <Typography variant="h6">
                  Company: {proj.displayCompanyName}
                </Typography>
              ) : (
                <Typography variant="h6">Year: {proj.year}</Typography>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onProjectAdded={handleProjectAdded}
        referenceNames={referenceMapping}
      />
    </SidebarLayout>
  );
}

/** ---------------------------
 *  getServerSideProps
 * ---------------------------*/
export const getServerSideProps: GetServerSideProps<ProjectProps> = async (
  ctx
) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
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
