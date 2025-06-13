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
  const router = useRouter();
  const { data: session, status } = useSession();
  const [projectsByCategory, setProjectsByCategory] = useState<Record<string, BusinessFile[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      signIn('google');
      return;
    }
    const load = async () => {
      try {
        const resp = await fetch('/api/businesses');
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Failed to load data');
        }
        const data = await resp.json();
        setProjectsByCategory(data.projectsByCategory);
      } catch (err: any) {
        setError(err.message);
      }
    };
    load();
  }, [status, session]);

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

