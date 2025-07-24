// pages/index.tsx

import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';

interface Status { firebaseReady: boolean; serviceAccountReady: boolean }

export default function MainPage() {
  const [firstName, setFirstName] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.ok ? r.json() : null)
      .then(setStatus)
      .catch(() => setStatus({ firebaseReady: false, serviceAccountReady: false }));

    fetch('/api/auth/session')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.user?.name) {
          setFirstName(data.user.name.split(' ')[0]);
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false));
  }, []);

  return (
    <SidebarLayout>
      <Box sx={{ p: 3 }}>
        {!status || authenticated === null ? (
          <Typography>Loading…</Typography>
        ) : status.firebaseReady && status.serviceAccountReady && authenticated ? (
          <>
            <Typography variant="h4" gutterBottom>
              Welcome{firstName ? `, ${firstName}` : ''}
            </Typography>
            <Typography variant="body1">
              Please select an option from the sidebar.
            </Typography>
          </>
        ) : (
          <Typography variant="h6" color="error">
            { !status.firebaseReady || !status.serviceAccountReady
              ? 'Configuration error: backend not available.'
              : 'You must be signed in to use this service.' }
          </Typography>
        )}
      </Box>
    </SidebarLayout>
  );
}
