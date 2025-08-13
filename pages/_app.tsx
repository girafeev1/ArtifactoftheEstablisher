// pages/_app.tsx
import { SessionProvider, useSession } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import type { AppProps } from 'next/app';
import { setupClientLogging } from '../lib/clientLogger';
import { Newsreader, Cantata_One, Nunito } from 'next/font/google';
import '../styles/studentDialog.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

if (typeof window !== 'undefined') {
  setupClientLogging();
}

const newsreader = Newsreader({ subsets: ['latin'], weight: ['200', '500'] });
// Cantata One exposes only a regular 400 weight, so we must specify it
// explicitly to satisfy the Next.js font loader typings.
const cantata = Cantata_One({ subsets: ['latin'], weight: '400' });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-nunito' });
const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${newsreader.className} ${cantata.className} ${nunito.variable}`}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider session={pageProps.session}>
          <SnackbarProvider maxSnack={3}>
            <Component {...pageProps} />
          </SnackbarProvider>
        </SessionProvider>
      </QueryClientProvider>
    </div>
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
