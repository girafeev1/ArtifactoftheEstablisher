// pages/api/auth/[...nextauth].ts

import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { loadAppSecrets } from '../../../lib/server/secretManager';

let dynamicAuthOptions: NextAuthOptions | null = null;

/**
 * Helper to refresh Google OAuth tokens if they're expired.
 */
async function refreshAccessToken(token: any, secrets: Record<string, string>) {
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
      console.error(
        'Failed to refresh token:',
        refreshedTokens.error || 'Unknown error'
      );
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

/**
 * Loads secrets from GCP Secret Manager, then builds a NextAuth config object.
 * We store it in a module-level variable so we don't reload secrets every time.
 */
async function getDynamicAuthOptions(): Promise<NextAuthOptions> {
  if (dynamicAuthOptions) return dynamicAuthOptions;

  const { secrets, diagnostics } = await loadAppSecrets();
  if (!diagnostics.success) {
    console.error('Failed to load secrets:', diagnostics.errors);
    throw new Error('Failed to load secrets');
  }

  dynamicAuthOptions = {
    providers: [
      GoogleProvider({
        clientId: secrets.OAUTH_CLIENT_ID,
        clientSecret: secrets.OAUTH_CLIENT_SECRET,
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
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
      async jwt({ token, account, user }) {
        // On initial sign-in
        if (account && user) {
          return {
            ...token,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            accessTokenExpires: account.expires_at
              ? account.expires_at * 1000
              : undefined,
            user,
          };
        }

        // If token not expired yet, reuse it
        if (
          token.accessTokenExpires &&
          Date.now() < token.accessTokenExpires
        ) {
          return token;
        }

        // Else try to refresh
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

  return dynamicAuthOptions;
}

/**
 * Named export so other routes can do: getServerSession(req, res, await getAuthOptions()).
 */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  return getDynamicAuthOptions();
}

/**
 * Default export for the NextAuth API route.
 */
export default async function auth(req, res) {
  if (!process.env.NEXTAUTH_URL && req.headers.host) {
    process.env.NEXTAUTH_URL = `https://${req.headers.host}`;
  }
  try {
    const options = await getDynamicAuthOptions();
    return await NextAuth(req, res, options);
  } catch (error) {
    console.error('[...nextauth] error:', error);
    return res.status(500).json({ error: 'Could not initialize NextAuth' });
  }
}

