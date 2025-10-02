import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'
import ProjectDatabaseDetailContent from '../../../../components/projectdialog/ProjectDatabaseDetailContent'
import { fetchProjectsFromDatabase, ProjectRecord } from '../../../../lib/projectsDatabase'
import { decodeSelectionId } from '../../../../lib/projectsDatabaseSelection'

import { Box } from '@mui/material'

interface ProjectWindowPageProps {
  project: ProjectRecord
}

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
          width: '100%',
          minWidth: 0,
          py: { xs: 3, md: 5 },
          px: { xs: 3, md: 4 },
        }}
      >
        <ProjectDatabaseDetailContent
          project={currentProject}
          onEdit={() => setEditOpen(true)}
          onClose={handleCloseWindow}
        />
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
