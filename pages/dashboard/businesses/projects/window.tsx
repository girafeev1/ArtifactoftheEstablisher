import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'
import ProjectDatabaseDetailContent from '../../../../components/projectdialog/ProjectDatabaseDetailContent'
import { fetchProjectsFromDatabase, ProjectRecord } from '../../../../lib/projectsDatabase'
import { decodeSelectionId } from '../../../../lib/projectsDatabaseSelection'

import { Box } from '@mui/material'

interface ProjectWindowPageProps {
  project: ProjectRecord
}

const MIN_WIDTH = 400
const MIN_HEIGHT = 200

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export default function ProjectWindowPage({ project }: ProjectWindowPageProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState(project)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [sized, setSized] = useState(false)

  useEffect(() => {
    setCurrentProject(project)
  }, [project])

  const handleCloseWindow = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.close()
    } else {
      void router.push('/dashboard/businesses/projects/select')
    }
  }, [router])

  const handleEditSaved = async () => {
    setEditOpen(false)
    await router.replace(router.asPath)
  }

  useLayoutEffect(() => {
    if (sized || typeof window === 'undefined' || !containerRef.current) {
      return
    }

    const node = containerRef.current
    const previousWidth = node.style.width
    const previousHeight = node.style.height

    node.style.width = 'max-content'
    node.style.height = 'auto'

    const measuredWidth = node.offsetWidth
    const measuredHeight = node.offsetHeight

    node.style.width = previousWidth
    node.style.height = previousHeight

    const viewportWidth = window.innerWidth || measuredWidth
    const viewportHeight = window.innerHeight || measuredHeight
    const width = clamp(measuredWidth, MIN_WIDTH, Math.max(MIN_WIDTH, viewportWidth - 24))
    const height = clamp(measuredHeight, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewportHeight - 24))

    setSized(true)

    window.requestAnimationFrame(() => {
      try {
        const widthOffset =
          typeof window.outerWidth === 'number' && typeof window.innerWidth === 'number'
            ? window.outerWidth - window.innerWidth
            : 0
        const heightOffset =
          typeof window.outerHeight === 'number' && typeof window.innerHeight === 'number'
            ? window.outerHeight - window.innerHeight
            : 0
        const screenAvailWidth = window.screen?.availWidth ?? width
        const screenAvailHeight = window.screen?.availHeight ?? height
        const targetWidth = clamp(
          width + widthOffset,
          MIN_WIDTH + widthOffset,
          screenAvailWidth - 16
        )
        const targetHeight = clamp(
          height + heightOffset,
          MIN_HEIGHT + heightOffset,
          screenAvailHeight - 16
        )

        if (typeof window.resizeTo === 'function') {
          window.resizeTo(Math.round(targetWidth), Math.round(targetHeight))
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('window resize skipped', err)
        }
      }
    })
  }, [sized])

  return (
    <>
      <Head>
        <title>
          #{(currentProject.projectNumber ?? '').replace(/^#/, '')} · Project Overview · Establish Productions Limited
        </title>
      </Head>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          maxWidth: 'calc(100vw - 24px)',
          minWidth: MIN_WIDTH,
          minHeight: MIN_HEIGHT,
          boxSizing: 'border-box',
          mx: 'auto',
          py: { xs: 3, md: 5 },
          px: { xs: 2.5, md: 3.5 },
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
  if (!session?.user) {
    return {
      redirect: { destination: '/auth/signin', permanent: false },
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
