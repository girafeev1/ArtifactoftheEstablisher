// components/SidebarLayout.tsx

import Link from 'next/link';
import { PropsWithChildren } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

// Define a custom theme for the app
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Example color, adjust as needed
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: ['Arial', 'sans-serif'].join(','),
  },
});

export default function SidebarLayout({ children }: PropsWithChildren) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] || 'User';

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <AppBar position="fixed" sx={{ width: '220px', mr: 2 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Welcome, {firstName}
            </Typography>
          </Toolbar>
          <nav>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2 }}>
              <Link href="/dashboard/projects" passHref>
                <Button color="inherit">Projects</Button>
              </Link>
              <Link href="/dashboard/clients" passHref>
                <Button color="inherit">Clients</Button>
              </Link>
              <Link href="/dashboard/internal" passHref>
                <Button color="inherit">Internal</Button>
              </Link>
              <Button color="secondary" onClick={() => signOut()}>
                Sign Out
              </Button>
            </Box>
          </nav>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3, ml: '220px' }}>
          {children}
        </Box>
      </Box>
    </ThemeProvider>
  );
}
