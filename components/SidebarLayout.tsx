// components/SidebarLayout.tsx

import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Box, Typography, Button, Divider, Menu, MenuItem } from '@mui/material';

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';
  const [recordsAnchorEl, setRecordsAnchorEl] = useState<null | HTMLElement>(null);

  const handleRecordsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setRecordsAnchorEl(event.currentTarget);
  };

  const handleRecordsClose = () => {
    setRecordsAnchorEl(null);
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
          <Link href="/dashboard/projects" passHref>
            <Button fullWidth sx={{ justifyContent: 'flex-start', mb: 1 }}>
              Projects
            </Button>
          </Link>
          <Button fullWidth onClick={handleRecordsClick} sx={{ justifyContent: 'flex-start', mb: 1 }}>
            Records
          </Button>
          <Menu anchorEl={recordsAnchorEl} open={Boolean(recordsAnchorEl)} onClose={handleRecordsClose}>
            <MenuItem onClick={handleRecordsClose}>
              <Link href="/dashboard/records?view=clients" passHref>
                <Button sx={{ textTransform: 'none' }}>Clients Account</Button>
              </Link>
            </MenuItem>
            <MenuItem onClick={handleRecordsClose}>
              <Link href="/dashboard/records?view=bank" passHref>
                <Button sx={{ textTransform: 'none' }}>Company Bank Account</Button>
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
