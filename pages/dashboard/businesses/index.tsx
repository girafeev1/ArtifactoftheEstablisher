// pages/dashboard/businesses/index.tsx

import { useSession, signIn } from 'next-auth/react';
import SidebarLayout from '../../../components/SidebarLayout';
import { useEffect, useState } from 'react';
import { listProjectOverviewFiles } from '../../../lib/projectOverview';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItem, ListItemText, Button } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id: string; name: string };
}

export default function BusinessesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [files, setFiles] = useState<BusinessFile[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('google');
    } else if (status === 'authenticated') {
      fetch('/api/businesses')
        .then(res => res.json())
        .then((data) => {
          const all: BusinessFile[] = [];
          for (const key in data) {
            data[key].forEach((f: BusinessFile) => all.push(f));
          }
          all.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));
          setFiles(all);
        })
        .catch(() => setFiles([]));
    }
  }, [status]);

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

