// pages/index.tsx

import { GetServerSideProps } from 'next';
import { getSession, signOut } from 'next-auth/react';
import { Box, Typography, Button, Divider } from '@mui/material';

export default function MainPage({ firstName }: { firstName: string }) {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome, {firstName}
      </Typography>
      <Typography sx={{ mb: 2 }}>Select an option below to navigate:</Typography>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          fullWidth
          href="/dashboard/projects"
          sx={{ justifyContent: 'flex-start' }}
        >
          Projects
        </Button>
        <Button
          variant="contained"
          fullWidth
          href="/dashboard/clients"
          sx={{ justifyContent: 'flex-start' }}
        >
          Clients
        </Button>
        <Button
          variant="contained"
          fullWidth
          href="/dashboard/internal"
          sx={{ justifyContent: 'flex-start' }}
        >
          Internal
        </Button>
      </Box>
      <Button
        onClick={() => signOut()}
        color="secondary"
        sx={{ mt: 3, justifyContent: 'flex-start' }}
      >
        Sign Out
      </Button>
    </Box>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx);
  if (!session) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }
  const firstName = session.user?.name?.split(' ')[0] || '';
  return { props: { firstName } };
};
