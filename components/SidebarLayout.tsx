// components/SidebarLayout.tsx

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Box, Typography, Button, Divider, Menu, MenuItem } from '@mui/material';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';
  const [businessAnchorEl, setBusinessAnchorEl] = useState<null | HTMLElement>(null);
  const [databaseAnchorEl, setDatabaseAnchorEl] = useState<null | HTMLElement>(null);

  const handleBusinessClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setBusinessAnchorEl(event.currentTarget);
  };

  const handleBusinessClose = () => {
    setBusinessAnchorEl(null);
  };

  const handleDatabaseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setDatabaseAnchorEl(event.currentTarget);
  };

  const handleDatabaseClose = () => {
    setDatabaseAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
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
          <Button fullWidth onClick={handleBusinessClick} sx={{ justifyContent: 'flex-start', mb: 1 }}>
            Businesses
          </Button>
          <Menu anchorEl={businessAnchorEl} open={Boolean(businessAnchorEl)} onClose={handleBusinessClose}>
            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
              <Link href="/dashboard/businesses/projects/select" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
                  Projects
                </Button>
              </Link>
            </MenuItem>
            <MenuItem onClick={handleBusinessClose} sx={{ p: 0 }}>
              <Link href="/dashboard/businesses/coaching-sessions" passHref style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}>
                <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
                  Coaching Sessions
                </Button>
              </Link>
            </MenuItem>
          </Menu>
        <Button fullWidth onClick={handleDatabaseClick} sx={{ justifyContent: 'flex-start', mb: 1 }}>
          Database
        </Button>
        <Menu anchorEl={databaseAnchorEl} open={Boolean(databaseAnchorEl)} onClose={handleDatabaseClose}>
          <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
            <Link
              href="/dashboard/businesses/client-accounts-database"
              passHref
              style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
            >
              <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
                Client Accounts
              </Button>
            </Link>
          </MenuItem>
          <MenuItem onClick={handleDatabaseClose} sx={{ p: 0 }}>
            <Link
              href="/dashboard/businesses/company-bank-accounts-database"
              passHref
              style={{ textDecoration: 'none', color: 'inherit', width: '100%' }}
            >
              <Button fullWidth sx={{ textTransform: 'none', justifyContent: 'flex-start', py: 1 }}>
                Company Bank Accounts
              </Button>
            </Link>
          </MenuItem>
        </Menu>
        </Box>
        <Button color="secondary" onClick={() => signOut()} sx={{ mt: 3, justifyContent: 'flex-start' }}>
          Sign Out
        </Button>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}
