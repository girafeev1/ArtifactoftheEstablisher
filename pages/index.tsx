// pages/index.tsx

import { GetServerSideProps } from 'next';
import { getSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function HomePage({ firstName }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h1>Welcome to the PMS Web App</h1>
      <p>You are logged in as: {firstName}</p>
      <button onClick={() => signOut()}>Sign Out</button>

      <hr />
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link href="/dashboard/projects">Projects</Link>
        <Link href="/dashboard/clients">Clients</Link>
        <Link href="/dashboard/internal">Internal</Link>
      </nav>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  console.log('Checking session for HomePage...');
  const session = await getSession(ctx);
  console.log('Session in getServerSideProps:', session ? JSON.stringify(session, null, 2) : 'null');
  if (!session) {
    console.log('No session found, redirecting to login.');
    return {
      redirect: {
        destination: '/api/auth/signin/google',
        permanent: false,
      },
    };
  }

  const fullName = session.user?.name || '';
  const firstName = fullName.split(' ')[0] || '';
  console.log('Session user:', JSON.stringify(session.user, null, 2));

  return {
    props: { firstName },
  };
};
