import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'
import {
  fetchProjectsFromDatabase,
  ProjectRecord,
} from '../../../../lib/projectsDatabase'
import { decodeSelectionId } from '../../../../lib/projectsDatabaseSelection'

import { Box, Button, Chip, Divider, Link, Paper, Stack, Typography } from '@mui/material'

interface ProjectWindowPageProps {
  project: ProjectRecord
}

const textOrNA = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value : 'N/A'

const formatAmount = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'HK$0'
  }
  return `HK$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const labelSx = {
  fontFamily: 'Newsreader',
  fontWeight: 200,
  fontSize: '1rem',
  letterSpacing: '0.03em',
} as const

const valueSx = {
  fontFamily: 'Newsreader',
  fontWeight: 500,
  fontSize: '1.1rem',
} as const

export default function ProjectWindowPage({ project }: ProjectWindowPageProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState(project)

  useEffect(() => {
    setCurrentProject(project)
  }, [project])

  const handleCloseWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.close()
    } else {
      void router.push('/dashboard/businesses/projects-database/select')
    }
  }, [router])

  const detailItems = useMemo(() => {
    const invoiceValue: ReactNode = currentProject.invoice
      ? currentProject.invoice.startsWith('http')
        ? (
            <Link
              href={currentProject.invoice}
              target="_blank"
              rel="noopener"
              sx={{ fontFamily: 'inherit', fontWeight: 'inherit' }}
            >
              {currentProject.invoice}
            </Link>
          )
        : textOrNA(currentProject.invoice)
      : 'N/A'

    return [
      { label: 'Client Company', value: textOrNA(currentProject.clientCompany) },
      { label: 'Subsidiary', value: textOrNA(currentProject.subsidiary) },
      { label: 'Presenter Work Type', value: textOrNA(currentProject.presenterWorkType) },
      {
        label: 'Project Pickup Date',
        value: currentProject.projectDateDisplay ?? '-',
      },
      { label: 'Amount', value: formatAmount(currentProject.amount) },
      { label: 'Paid', value: currentProject.paid ? 'Yes' : 'No' },
      {
        label: 'Paid On',
        value: currentProject.paid ? currentProject.onDateDisplay ?? '-' : '-',
      },
      { label: 'Pay To', value: textOrNA(currentProject.paidTo) },
      { label: 'Invoice', value: invoiceValue },
    ] satisfies Array<{ label: string; value: ReactNode }>
  }, [currentProject])

  const handleEditSaved = async () => {
    setEditOpen(false)
    await router.replace(router.asPath)
  }

  return (
    <>
      <Head>
        <title>
          {currentProject.projectNumber} · Project Overview · Establish Productions Limited
        </title>
      </Head>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#f6f8f9',
          py: { xs: 4, md: 8 },
          px: { xs: 2, md: 0 },
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={4}
          sx={{
            width: 'min(720px, 100%)',
            px: { xs: 3, md: 5 },
            py: { xs: 3, md: 4 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Stack spacing={0.5} sx={{ width: '100%' }}>
              <Typography variant="subtitle1" color="text.secondary">
                {currentProject.projectNumber}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {textOrNA(currentProject.presenterWorkType)}
              </Typography>
              <Typography variant="h4" sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}>
                {textOrNA(currentProject.projectTitle)}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                — {textOrNA(currentProject.projectNature)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={currentProject.year} color="primary" variant="outlined" />
              {currentProject.subsidiary && (
                <Chip label={currentProject.subsidiary} variant="outlined" />
              )}
            </Stack>
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack spacing={2.5}>
            {detailItems.map(({ label, value }) => (
              <Box key={label}>
                <Typography sx={labelSx}>{label}:</Typography>
                <Typography component="div" sx={valueSx}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            <Button variant="outlined" onClick={handleCloseWindow}>
              Close
            </Button>
            <Button variant="contained" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </Stack>
        </Paper>
      </Box>
      <ProjectDatabaseEditDialog
        open={editOpen}
        project={currentProject}
        onClose={() => setEditOpen(false)}
        onSaved={handleEditSaved}
      />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<ProjectWindowPageProps> = async (ctx) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin', permanent: false },
    }
  }

  const groupToken = ctx.query.group
  const projectId = ctx.query.project

  if (typeof groupToken !== 'string' || typeof projectId !== 'string') {
    return { notFound: true }
  }

  const selection = decodeSelectionId(groupToken)
  if (!selection) {
    return { notFound: true }
  }

  const { projects } = await fetchProjectsFromDatabase()
  const project = projects.find(
    (item) => item.year === selection.year && item.id === projectId
  )

  if (!project) {
    return { notFound: true }
  }

  return {
    props: {
      project,
    },
  }
}
