// pages/api/auth/[...nextauth].ts

import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { loadSecrets } from '../../../lib/server/secretManager';

export default async function auth(req, res) {
  // Load secrets from your secret manager
  const { secrets, diagnostics } = await loadSecrets();

  if (!diagnostics.success) {
    console.error('Failed to load secrets:', diagnostics.errors);
    return res.status(500).json({ error: 'Failed to load secrets' });
  }

  // Define authOptions after loading secrets
  const authOptions: NextAuthOptions = {
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
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
      async jwt({ token, account, user }) {
        if (account && user) {
          return {
            ...token,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            accessTokenExpires: account.expires_at ? account.expires_at * 1000 : undefined,
            user,
          };
        }

        // Return previous token if not expired
        if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
          return token;
        }

        // Token has expired, try to refresh it
        return refreshAccessToken(token, secrets);
      },
      async session({ session, token }) {
        if (token) {
          session.accessToken = token.accessToken;
          session.user = token.user;
        }
        return session;
      },
    },
    secret: secrets.NEXTAUTH_SECRET,
    debug: process.env.NODE_ENV === 'development',
  };

  return await NextAuth(req, res, authOptions);
}

async function refreshAccessToken(token, secrets) {
  console.log('Attempting to refresh access token...');
  try {
    const url = 'https://oauth2.googleapis.com/token';
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      body: new URLSearchParams({
        client_id: secrets.OAUTH_CLIENT_ID,
        client_secret: secrets.OAUTH_CLIENT_SECRET,
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
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
