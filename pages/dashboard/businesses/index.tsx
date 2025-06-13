// pages/dashboard/businesses/index.tsx

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import SidebarLayout from '../../../components/SidebarLayout';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id: string; name: string };
}

export default function BusinessesPage() {
  const { status } = useSession();
  const [projectsByCategory, setProjectsByCategory] = useState<Record<string, BusinessFile[]>>({});
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('google');
    } else if (status === 'authenticated') {
      fetch('/api/businesses')
        .then(res => res.json())
        .then(data => setProjectsByCategory(data.projectsByCategory || {}))
        .catch(() => {});
    }
  }, [status]);

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

