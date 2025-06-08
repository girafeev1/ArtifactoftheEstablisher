// pages/dashboard/businesses/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../../components/SidebarLayout';
import { initializeApis } from '../../../lib/googleApi';
import { listProjectOverviewFiles } from '../../../lib/projectOverview';
import {
  fetchSubsidiaries,
  mapSubsidiaryNames,
  resolveSubsidiaryName,
} from '../../../lib/firestoreSubsidiaries';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id: string; name: string };
}

interface BusinessesPageProps {
  projectsByCategory: Record<string, BusinessFile[]>;
  referenceMapping: Record<string, string>;
}

export default function BusinessesPage({ projectsByCategory, referenceMapping }: BusinessesPageProps) {
  const router = useRouter();

  // Flatten the grouped projects into a single array and sort them by the mapped English name.
  const files: BusinessFile[] = [];
  for (const key in projectsByCategory) {
    projectsByCategory[key].forEach((file) => files.push(file));
  }
  files.sort((a, b) =>
    resolveSubsidiaryName(a.companyIdentifier, referenceMapping).localeCompare(
      resolveSubsidiaryName(b.companyIdentifier, referenceMapping)
    )
  );

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
            <ListItemText
              primary={resolveSubsidiaryName(file.companyIdentifier, referenceMapping)}
              secondary={file.file.name}
            />
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
  const subsidiaries = await fetchSubsidiaries();
  const referenceMapping = mapSubsidiaryNames(subsidiaries);
  for (const year in projectsByCategory) {
    projectsByCategory[year] = projectsByCategory[year].map(file => ({
      ...file,
      fullCompanyName: resolveSubsidiaryName(file.companyIdentifier, referenceMapping),
    }));
  }
  return {
    props: {
      projectsByCategory,
      referenceMapping,
    },
  };
};
