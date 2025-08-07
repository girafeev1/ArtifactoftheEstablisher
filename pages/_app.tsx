// pages/_app.tsx
import { SessionProvider, useSession } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import type { AppProps } from 'next/app';
import { setupClientLogging } from '../lib/clientLogger';
import { Newsreader, Cantata_One, Nunito } from 'next/font/google';

if (typeof window !== 'undefined') {
  setupClientLogging();
}

const newsreader = Newsreader({ subsets: ['latin'], weight: ['200', '500'] });
// Cantata One exposes only a regular 400 weight, so we must specify it
// explicitly to satisfy the Next.js font loader typings.
const cantata = Cantata_One({ subsets: ['latin'], weight: '400' });
const nunito = Nunito({ subsets: ['latin'], weight: '400', variable: '--font-nunito' });

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className={`${newsreader.className} ${cantata.className} ${nunito.variable}`}>
      <SessionProvider session={pageProps.session}>
        <SnackbarProvider maxSnack={3}>
          <Component {...pageProps} />
        </SnackbarProvider>
      </SessionProvider>
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
