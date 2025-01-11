// pages/api/auth/[...nextauth].ts

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { loadSecrets } from '../../../lib/server/secretManager';

export default async function auth(req, res) {
  console.log('Starting NextAuth handler...');
  // Load secrets from .env or GCP Secret Manager
  const { secrets, diagnostics } = await loadSecrets();
  console.log('Secrets loaded:', secrets);
  if (!diagnostics.success) {
    console.error('Failed to load secrets:', diagnostics.errors);
    return res.status(500).json({ error: 'Failed to load secrets' });
  }

  const clientId = secrets.OAUTH_CLIENT_ID;
  const clientSecret = secrets.OAUTH_CLIENT_SECRET;
  console.log('Client ID:', clientId ? 'Present' : 'Not Present');
  console.log('Client Secret:', clientSecret ? 'Present' : 'Not Present');

  return await NextAuth(req, res, {
    providers: [
      GoogleProvider({
        clientId,
        clientSecret,
        authorization: {
          params: {
            scope:
              'openid profile email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      }),
    ],
    secret: secrets.NEXTAUTH_SECRET,
    callbacks: {
      async jwt({ token, account }) {
        console.log('JWT Callback - Before:', JSON.stringify(token));
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.accessTokenExpires = account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000;
          console.log('JWT Callback - New Account:', JSON.stringify(token));
        }

        if (
          token.accessTokenExpires &&
          Date.now() < token.accessTokenExpires
        ) {
          console.log('JWT Callback - Token still valid');
          return token;
        }
        console.log('JWT Callback - Token expired, attempting refresh');
        return await refreshAccessToken(token, { clientId, clientSecret });
      },
      async session({ session, token }) {
        console.log('Session Callback - Before:', JSON.stringify(session));
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        console.log('Session Callback - After:', JSON.stringify(session));
        return session;
      },
    },
  });
}

async function refreshAccessToken(token, { clientId, clientSecret }) {
  console.log('Attempting to refresh access token...');
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) {
      console.error('Failed to refresh token:', refreshedTokens.error || 'Unknown error');
      throw new Error(refreshedTokens.error || 'Failed to refresh token');
    }

    console.log('Token refresh successful:', JSON.stringify(refreshedTokens));
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
