// pages/_app.tsx
import { SessionProvider, useSession } from 'next-auth/react';
import { SnackbarProvider } from 'notistack';
import type { AppProps } from 'next/app';
import { useFirebaseAuth } from '../lib/hooks/useFirebaseAuth';

function FirebaseAuthInit() {
  useFirebaseAuth();
  return null;
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <FirebaseAuthInit />
      <SnackbarProvider maxSnack={3}>
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
