// components/SidebarLayout.tsx

import Link from 'next/link';
import { PropsWithChildren } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Box, Typography, Button, Divider } from '@mui/material';

export default function SidebarLayout({ children }: PropsWithChildren) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Box
        component="nav"
        sx={{
          width: '220px',
          backgroundColor: '#f8f9fa',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 2,
          borderRight: '1px solid #dee2e6',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ mb: 3, textAlign: 'center' }}>
            {firstName}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Link href="/" passHref>
            <Button fullWidth sx={{ justifyContent: 'flex-start', mb: 1 }}>
              Main Page
            </Button>
          </Link>
          <Link href="/dashboard/projects" passHref>
            <Button fullWidth sx={{ justifyContent: 'flex-start', mb: 1 }}>
              Projects
            </Button>
          </Link>
          <Link href="/dashboard/clients" passHref>
            <Button fullWidth sx={{ justifyContent: 'flex-start', mb: 1 }}>
              Clients
            </Button>
          </Link>
          <Link href="/dashboard/internal" passHref>
            <Button fullWidth sx={{ justifyContent: 'flex-start' }}>
              Internal
            </Button>
          </Link>
        </Box>
        <Button
          color="secondary"
          onClick={() => signOut()}
          sx={{ mt: 3, justifyContent: 'flex-start' }}
        >
          Sign Out
        </Button>
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}
