// pages/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { Box, Typography, CircularProgress } from '@mui/material';
import SidebarLayout from '../components/SidebarLayout';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function MainPage({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Handle OCBC OAuth implicit flow callback
  // Token is returned in URL fragment: #access_token=xxx&token_type=Bearer&expires_in=3600
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) {
      return;
    }

    setIsProcessingOAuth(true);

    // Parse token from fragment
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const tokenType = params.get('token_type');
    const expiresIn = params.get('expires_in');

    if (!accessToken) {
      setOauthError('No access token found in callback');
      setIsProcessingOAuth(false);
      return;
    }

    // Send token to server for storage
    fetch('/api/ocbc/auth/store-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        tokenType: tokenType || 'Bearer',
        expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to store token');
        }
        // Clear the hash and redirect to finance page
        window.history.replaceState(null, '', '/');
        router.push('/dashboard/new-ui/finance?ocbc_connected=true');
      })
      .catch((err) => {
        console.error('[index] OAuth callback error:', err);
        setOauthError(err.message);
        setIsProcessingOAuth(false);
        // Clear the hash
        window.history.replaceState(null, '', '/');
      });
  }, [router]);

  // Show loading state while processing OAuth callback
  if (isProcessingOAuth) {
    return (
      <SidebarLayout>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress />
          <Typography variant="body1">Connecting to OCBC...</Typography>
        </Box>
      </SidebarLayout>
    );
  }

  // Show error if OAuth failed
  if (oauthError) {
    return (
      <SidebarLayout>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" color="error" gutterBottom>
            OCBC Connection Failed
          </Typography>
          <Typography variant="body1">{oauthError}</Typography>
          <Typography variant="body2" sx={{ mt: 2 }}>
            <a href="/dashboard/new-ui/finance">Go to Finance</a>
          </Typography>
        </Box>
      </SidebarLayout>
    );
  }

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
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }
  const firstName = session.user?.name?.split(' ')[0] || '';
  return { props: { firstName } };
};
