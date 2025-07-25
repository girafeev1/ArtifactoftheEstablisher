// pages/dashboard/businesses/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../../components/SidebarLayout';
import { initializeApis } from '../../../lib/googleApi';
import { listProjectOverviewFiles } from '../../../lib/projectOverview';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id: string; name: string };
}

interface BusinessesPageProps {
  projectsByCategory: Record<string, BusinessFile[]>;
}

export default function BusinessesPage({ projectsByCategory }: BusinessesPageProps) {
  const router = useRouter();

  // Flatten the grouped projects into a single array.
  // (The original code grouped them by subsidiary code; now we sort them alphabetically by fullCompanyName.)
  const files: BusinessFile[] = [];
  for (const key in projectsByCategory) {
    projectsByCategory[key].forEach((file) => files.push(file));
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
            key={file.file.id}
            button
            onClick={() => router.push(`/dashboard/businesses/${file.file.id}`)}
          >
            <ListItemText primary={file.fullCompanyName} secondary={file.file.name} />
          </ListItem>
        ))}
      </List>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } };
  }
  const { initializeApis } = await import('../../../lib/googleApi');
  const { drive } = initializeApis('user', { accessToken: session.accessToken as string });
  // Get the grouped project files using your existing sorting utility
  const projectsByCategory = await listProjectOverviewFiles(drive, []);
  return {
    props: {
      projectsByCategory,
    },
  };
};
