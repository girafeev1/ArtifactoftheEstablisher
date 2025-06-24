// pages/index.tsx

import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import SidebarLayout from '../components/SidebarLayout';

export default function MainPage() {
  const [firstName, setFirstName] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/session`)
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
        <Typography variant="h4" gutterBottom>
          Welcome{firstName ? `, ${firstName}` : ''}
        </Typography>
        <Typography variant="body1">Please select an option from the sidebar.</Typography>
      </Box>
    </SidebarLayout>
  );
}
