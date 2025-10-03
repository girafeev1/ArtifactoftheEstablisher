import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useCallback } from 'react'

import { Box, Typography } from '@mui/material'

import { decodeSelectionId } from '../../../../lib/projectsDatabaseSelection'
import { ProjectDatabaseCreateForm } from '../../../../components/projectdialog/ProjectDatabaseCreateDialog'
import type { ProjectRecord } from '../../../../lib/projectsDatabase'

interface ProjectCreateWindowProps {
  year: string | null
}

export default function ProjectCreateWindow({ year }: ProjectCreateWindowProps) {
  const handleClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.close()
    }
  }, [])

  const handleCreated = useCallback((_project?: ProjectRecord) => {
    if (typeof window !== 'undefined') {
      window.close()
    }
  }, [])

  return (
    <>
      <Head>
        <title>New Project · Projects Database · Establish Productions Limited</title>
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.paper',
          color: 'text.primary',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          py: { xs: 4, md: 6 },
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 720,
            px: { xs: 2.5, md: 4 },
          }}
        >
          {year ? (
            <ProjectDatabaseCreateForm
              year={year}
              onClose={handleClose}
              onCreated={handleCreated}
              variant="page"
              resetToken={year}
            />
          ) : (
            <Typography color="error">
              Unable to determine project collection. Close this window and try launching the New Project flow again.
            </Typography>
          )}
        </Box>
      </Box>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<ProjectCreateWindowProps> = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin', permanent: false },
    }
  }

  const groupToken = ctx.query.group
  if (typeof groupToken !== 'string') {
    return { props: { year: null } }
  }

  const selection = decodeSelectionId(groupToken)
  if (!selection) {
    return { props: { year: null } }
  }

  return {
    props: {
      year: selection.year,
    },
  }
}
