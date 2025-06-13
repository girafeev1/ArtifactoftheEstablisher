// pages/index.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { Box, Typography } from '@mui/material';
import SidebarLayout from '../components/SidebarLayout';

export default function MainPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      signIn('google');
    }
  }, [status, session]);

  if (!session) return null;

  const firstName = session.user?.name?.split(' ')[0] || '';

  return (
    <SidebarLayout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {firstName}
        </Typography>
        <Typography variant="body1">Please select an option from the sidebar.</Typography>
      </Box>
    </SidebarLayout>
  );
}
