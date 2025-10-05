// pages/_app.tsx
import Head from 'next/head';
import { SessionProvider, useSession } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import type { AppProps } from 'next/app';
import { setupClientLogging } from '../lib/clientLogger';
import { Newsreader, Cantata_One, Nunito } from 'next/font/google';
import 'antd/dist/reset.css';
import '../styles/studentDialog.css';
import '../styles/project-dialog.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../lib/theme';
import { PromptIdProvider } from '../lib/promptId';

if (typeof window !== 'undefined') {
  setupClientLogging();
}

const newsreader = Newsreader({ subsets: ['latin'], weight: ['200', '500'] });
// Cantata One exposes only a regular 400 weight, so we must specify it
// explicitly to satisfy the Next.js font loader typings.
const cantata = Cantata_One({ subsets: ['latin'], weight: '400' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-nunito' });
const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps<{ promptId?: string; session?: any }>) {
  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <div className={`${newsreader.className} ${cantata.className} ${nunito.variable}`}>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider session={pageProps.session}>
              <PromptIdProvider value={pageProps.promptId ?? ''}>
                <SnackbarProvider maxSnack={3}>
                  <Component {...pageProps} />
                </SnackbarProvider>
              </PromptIdProvider>
            </SessionProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </div>
    </>
  );
}

function SessionChecker() {
  const { data: session, status } = useSession();
  console.log('Client-side Session:', session ? JSON.stringify(session, null, 2) : 'null', 'Status:', status);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  return null;
}

export default MyApp;
