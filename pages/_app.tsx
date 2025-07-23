// pages/_app.tsx
import { SessionProvider } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import type { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <SessionProvider session={pageProps.session}>
        <SnackbarProvider maxSnack={3}>
          <Component {...pageProps} />
        </SnackbarProvider>
      </SessionProvider>
    </>
  );
}

export default MyApp;
