// pages/dashboard/businesses/index.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../../components/SidebarLayout';
import { useRouter } from 'next/router';
import { Box, Typography, List, ListItemButton, ListItemText, Button } from '@mui/material';

interface BusinessLink {
  title: string;
  description: string;
  href: string;
}

interface BusinessesPageProps {
  businessLinks: BusinessLink[];
}

export default function BusinessesPage({ businessLinks }: BusinessesPageProps) {
  const router = useRouter();

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Businesses</Typography>
        {/* Placeholder New Project button */}
        <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
          New Project
        </Button>
      </Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Select a project overview file:
      </Typography>
      <List>
        {businessLinks.map((link) => (
          <ListItemButton key={link.href} onClick={() => router.push(link.href)}>
            <ListItemText primary={link.title} secondary={link.description} />
          </ListItemButton>
        ))}
      </List>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<BusinessesPageProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.user) {
    return { redirect: { destination: '/auth/signin', permanent: false } };
  }
  return {
    props: {
      businessLinks: [
        {
          title: 'Establish Productions Limited',
          description: 'Projects',
          href: '/dashboard/businesses/projects/select',
        },
      ],
    },
  };
};
