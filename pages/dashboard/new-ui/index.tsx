import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Link from 'next/link'
import { Box, Button, Stack, Typography } from '@mui/material'

export default function NewUIScreen() {
  return (
    <>
      <Head>
        <title>New UI · Refine Sandbox</title>
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          p: 4,
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" component="h1">
          Refine Sandbox
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: 600 }}>
          This space hosts early Refine-based prototypes. Explore new experiences here while the legacy UI remains
          unchanged. We can iterate module by module before rolling anything into production.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Link href="/dashboard/new-ui/client-accounts" passHref>
            <Button variant="contained">Preview Client Accounts</Button>
          </Link>
          <Link href="/" passHref>
            <Button variant="outlined">Back to Legacy UI</Button>
          </Link>
        </Stack>
      </Box>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.user) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    }
  }

  return { props: {} }
}
