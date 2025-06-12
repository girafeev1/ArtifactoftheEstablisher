// pages/dashboard/businesses/index.tsx

import SidebarLayout from '../../../components/SidebarLayout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, ListItemText, Button, Alert } from '@mui/material';

interface BusinessFile {
  companyIdentifier: string;
  fullCompanyName: string;
  file: { id: string; name: string };
}

export default function BusinessesPage() {
  const router = useRouter();
  const [files, setFiles] = useState<BusinessFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch('/api/businesses');
        const json = await resp.json();
        const grouped: Record<string, BusinessFile[]> = json.projectsByCategory || {};
        const list: BusinessFile[] = [];
        for (const key in grouped) {
          grouped[key].forEach(f => list.push(f));
        }
        list.sort((a, b) => a.fullCompanyName.localeCompare(b.fullCompanyName));
        setFiles(list);
      } catch (err: any) {
        setError(err.message);
      }
    };
    load();
  }, []);

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Businesses</Typography>
        {/* Placeholder New Project button */}
        <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
          New Project
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
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

