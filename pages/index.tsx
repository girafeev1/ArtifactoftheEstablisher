// pages/index.tsx

import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';
import { firebaseReady } from '../lib/firebase';

export default function MainPage() {
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    if (!firebaseReady) return;
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/session`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.user?.name) {
          setFirstName(data.user.name.split(' ')[0]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <Box sx={{ p: 3 }}>
        {firebaseReady ? (
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
            Configuration error: Firebase not available.
          </Typography>
        )}
      </Box>
    </SidebarLayout>
  );
}
