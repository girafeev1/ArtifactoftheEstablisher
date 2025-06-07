// pages/dashboard/businesses/index.tsx

import { GetServerSideProps } from 'next';
import SidebarLayout from '../../../components/SidebarLayout';
import { fetchReferenceMapping, listCompanyYears } from '../../../lib/firestoreProjects';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  year: string;
}

interface BusinessesPageProps {
  projectsByCategory: Record<string, BusinessFile[]>;
}

export default function BusinessesPage({ projectsByCategory }: BusinessesPageProps) {
  const router = useRouter();

  // Flatten the grouped projects into a single array.
  // (The original code grouped them by subsidiary code; now we sort them alphabetically by fullCompanyName.)
  const files: BusinessFile[] = [];
  for (const year in projectsByCategory) {
    projectsByCategory[year].forEach((file) => files.push(file));
  }
  files.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Businesses</Typography>
        {/* Placeholder New Project button */}
        <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
          New Project
        </Button>
      </Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Select a project overview file:
      </Typography>
      <List>
        {files.map((file) => (
          <ListItem
            key={`${file.companyIdentifier}-${file.year}`}
            button
            onClick={() => router.push(`/dashboard/businesses/${file.companyIdentifier}-${file.year}`)}
          >
            <ListItemText primary={file.fullCompanyName} secondary={file.year} />
          </ListItem>
        ))}
      </List>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async () => {
  const referenceMapping = await fetchReferenceMapping();
  const projectsByCategory: Record<string, BusinessFile[]> = {};
  for (const [code, name] of Object.entries(referenceMapping)) {
    const years = await listCompanyYears(code);
    years.forEach(year => {
      if (!projectsByCategory[year]) projectsByCategory[year] = [];
      projectsByCategory[year].push({
        companyIdentifier: code,
        fullCompanyName: name,
        year,
      });
    });
  }
  return {
    props: {
      projectsByCategory,
    },
  };
};
