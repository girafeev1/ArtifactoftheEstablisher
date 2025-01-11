// pages/dashboard/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';

export default function DashboardIndex() {
  return (
    <SidebarLayout>
      <h1>Dashboard Landing</h1>
      <p>Select a tab on the left.</p>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  console.log('Checking session for DashboardIndex...');
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
  console.log('Session found, continuing to dashboard.');
  return { props: {} };
};
