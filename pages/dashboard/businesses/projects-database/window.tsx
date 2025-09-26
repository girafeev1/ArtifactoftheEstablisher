import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import SidebarLayout from '../../../../components/SidebarLayout'
import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'
import {
  fetchProjectsFromDatabase,
  ProjectRecord,
} from '../../../../lib/projectsDatabase'
import { decodeSelectionId } from '../../../../lib/projectsDatabaseSelection'

import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material'

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

export default function ProjectWindowPage({ project }: ProjectWindowPageProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState(project)

  useEffect(() => {
    setCurrentProject(project)
  }, [project])

  const handleEditSaved = async () => {
    setEditOpen(false)
    await router.replace(router.asPath)
  }

  return (
    <SidebarLayout>
      <Box sx={{ p: 4, maxWidth: 960, mx: 'auto' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Project Overview
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {currentProject.projectNumber} — {textOrNA(currentProject.projectTitle)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip label={currentProject.year} variant="outlined" />
            <Button variant="contained" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 3 }} />

        <Stack spacing={2}>
          <Typography>
            <strong>Client Company:</strong> {textOrNA(currentProject.clientCompany)}
          </Typography>
          <Typography>
            <strong>Project Nature:</strong> {textOrNA(currentProject.projectNature)}
          </Typography>
          <Typography>
            <strong>Presenter Work Type:</strong> {textOrNA(currentProject.presenterWorkType)}
          </Typography>
          <Typography>
            <strong>Subsidiary:</strong> {textOrNA(currentProject.subsidiary)}
          </Typography>
          <Typography>
            <strong>Project Pickup Date:</strong> {currentProject.projectDateDisplay ?? 'Not set'}
          </Typography>
          <Typography>
            <strong>Amount:</strong> {formatAmount(currentProject.amount)}
          </Typography>
          <Typography>
            <strong>Paid:</strong> {currentProject.paid ? 'Yes' : 'No'}
          </Typography>
          {currentProject.paid && (
            <Typography>
              <strong>Paid On:</strong> {currentProject.onDateDisplay ?? '-'}
            </Typography>
          )}
          {currentProject.paidTo && (
            <Typography>
              <strong>Paid To:</strong> {textOrNA(currentProject.paidTo)}
            </Typography>
          )}
          {currentProject.invoice && (
            <Typography>
              <strong>Invoice:</strong> {textOrNA(currentProject.invoice)}
            </Typography>
          )}
        </Stack>
      </Box>
      <ProjectDatabaseEditDialog
        open={editOpen}
        project={currentProject}
        onClose={() => setEditOpen(false)}
        onSaved={handleEditSaved}
      />
    </SidebarLayout>
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
