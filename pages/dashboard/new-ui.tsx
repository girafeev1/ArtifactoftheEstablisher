import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { Box, Button, Typography } from '@mui/material'
import Link from 'next/link'

export default function NewUIPage() {
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
          gap: 3,
          p: 4,
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" component="h1">
          Refine Sandbox
        </Typography>
        <Typography variant="body1" sx={{ maxWidth: 560 }}>
          This space is reserved for the upcoming Refine-based experience. We can develop and preview new
          components here without affecting the legacy UI. Use the navigation below to return to the current
          dashboard.
        </Typography>
        <Link href="/" passHref>
          <Button variant="contained">Back to Legacy UI</Button>
        </Link>
      </Box>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    }
  }

  return { props: {} }
}
