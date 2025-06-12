// pages/index.tsx

import { useSession, signIn } from 'next-auth/react';
import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import SidebarLayout from '../components/SidebarLayout';

export default function MainPage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('google');
    }
  }, [status]);

  if (status === 'loading' || !session) {
    return <div>Loading...</div>;
  }

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
