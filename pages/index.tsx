// pages/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { Box, Typography } from '@mui/material';
import SidebarLayout from '../components/SidebarLayout';

export default function MainPage({ firstName }: { firstName: string }) {
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx);
  if (!session) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }
  const firstName = session.user?.name?.split(' ')[0] || '';
  return { props: { firstName } };
};
