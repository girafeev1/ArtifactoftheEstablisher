// pages/_app.tsx

import { SessionProvider, useSession } from 'next-auth/react';
import type { AppProps } from 'next/app';
import { SnackbarProvider } from 'notistack';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <SnackbarProvider>
        <SessionChecker />
        <Component {...pageProps} />
      </SnackbarProvider>
    </SessionProvider>
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
