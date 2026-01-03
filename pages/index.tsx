// pages/index.tsx
// Redirects to /dashboard for the new UI
// Preserves OCBC OAuth callback handling for the implicit flow

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { Typography, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const { Text, Title } = Typography;

export default function MainPage() {
  const router = useRouter();
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  // Handle OCBC OAuth implicit flow callback
  // Token is returned in URL fragment: #access_token=xxx&token_type=Bearer&expires_in=3600
  useEffect(() => {
    const hash = window.location.hash;

    // If no OAuth hash, redirect to dashboard
    if (!hash || !hash.includes('access_token=')) {
      router.replace('/dashboard');
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
        router.push('/bank?ocbc_connected=true');
      })
      .catch((err) => {
        console.error('[index] OAuth callback error:', err);
        setOauthError(err.message);
        setIsProcessingOAuth(false);
        // Clear the hash
        window.history.replaceState(null, '', '/');
      });
  }, [router]);

  // Show loading state while processing OAuth callback or redirecting
  if (isProcessingOAuth) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: '100vh', justifyContent: 'center' }}>
        <Spin size="large" />
        <Text>Connecting to OCBC...</Text>
      </div>
    );
  }

  // Show error if OAuth failed
  if (oauthError) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={4} type="danger" style={{ marginBottom: 8 }}>
          OCBC Connection Failed
        </Title>
        <Text>{oauthError}</Text>
        <div style={{ marginTop: 16 }}>
          <a href="/bank">Go to Bank Access</a>
        </div>
      </div>
    );
  }

  // Show loading while redirecting to dashboard
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: '100vh', justifyContent: 'center' }}>
      <Spin size="large" />
      <Text>Loading...</Text>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx);
  if (!session) {
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }
  return { props: {} };
};
