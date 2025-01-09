import { NextApiRequest, NextApiResponse } from 'next';
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { loadSecrets } from '../../../lib/server/secretManager';

export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  console.log('Starting authentication process:', req.method);

  try {
    console.log('Attempting to load secrets for authentication.');
    const { secrets, diagnostics } = await loadSecrets();

    if (!diagnostics.success) {
      console.error('Failed to load secrets:', diagnostics.errors);
      res.status(500).json({ error: 'Failed to load secrets' });
      return;
    } else {
      console.log('Secrets successfully loaded for authentication.');
    }

    if (!secrets.NEXTAUTH_URL) {
      throw new Error('NEXTAUTH_URL is missing in secrets.');
    }
    process.env.NEXTAUTH_URL = secrets.NEXTAUTH_URL;

    console.log('Configuring NextAuth with secrets.');
    return await NextAuth(req, res, {
      providers: [
        GoogleProvider({
          clientId: secrets.OAUTH_CLIENT_ID,
          clientSecret: secrets.OAUTH_CLIENT_SECRET,
          authorization: {
            params: {
              scope: 'openid profile email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        }),
      ],
      secret: secrets.NEXTAUTH_SECRET,
      callbacks: {
        async jwt({ token, account }) {
          console.log('JWT Callback - Before:', token);
          if (account) {
            token.accessToken = account.access_token;
            token.refreshToken = account.refresh_token;
            token.accessTokenExpires = account.expires_at
              ? account.expires_at * 1000 // Convert to milliseconds if it's in seconds
              : Date.now() + 3600 * 1000; // Default to 1 hour from now if not provided
            console.log('JWT Callback - After account update:', token);
          }

          if (token.accessTokenExpires && typeof token.accessTokenExpires === 'number' && Date.now() < token.accessTokenExpires) {
            console.log('JWT Callback - Token still valid, returning:', token);
            return token;
          }

          console.log('JWT Callback - Token expired, attempting refresh.');
          const updatedToken = await refreshAccessToken(token, secrets);
          console.log('JWT Callback - After refresh:', updatedToken);
          return updatedToken;
        },
        async session({ session, token }) {
          console.log('Session Callback - Before:', session);
          if (token && typeof token.accessToken === 'string') {
            session.accessToken = token.accessToken;
          }
          if (token && typeof token.refreshToken === 'string') {
            session.refreshToken = token.refreshToken;
          }
          if (token && typeof token.accessTokenExpires === 'number') {
            session.accessTokenExpires = token.accessTokenExpires;
          }
          console.log('Session Callback - After:', session);
          return session;
        },
      },
    });
  } catch (error: any) {
    console.error('Error in NextAuth:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function refreshAccessToken(token: any, secrets: Record<string, string>) {
  console.log('Starting access token refresh.');
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: secrets.OAUTH_CLIENT_ID,
        client_secret: secrets.OAUTH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
      method: 'POST',
    });

    const refreshedTokens = await response.json();
    if (!response.ok) {
      console.error('Failed to refresh token:', refreshedTokens);
      throw refreshedTokens;
    }

    console.log('Token refresh successful.');
    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error: any) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
