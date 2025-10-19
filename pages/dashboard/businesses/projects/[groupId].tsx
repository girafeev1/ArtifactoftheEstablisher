import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import SidebarLayout from '../../../../components/SidebarLayout'
import {
  fetchProjectsFromDatabase,
  ProjectRecord,
} from '../../../../lib/projectsDatabase'
import {
  decodeSelectionId,
  encodeSelectionId,
  ProjectsSortMethod,
  SelectionDescriptor,
} from '../../../../lib/projectsDatabaseSelection'

import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import ProjectDatabaseDetailDialog from '../../../../components/projectdialog/ProjectDatabaseDetailDialog'
import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'
import ProjectDatabaseCreateDialog from '../../../../components/projectdialog/ProjectDatabaseCreateDialog'

const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
const headingSx = { fontFamily: 'Cantata One' }

type SortMethod = ProjectsSortMethod

type Mode = 'select' | 'detail'

interface ProjectsDatabasePageProps {
  mode: Mode
  years: string[]
  error?: string
  detailSelection?: SelectionDescriptor
  projects?: ProjectRecord[]
}

const stringOrNA = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value : 'N/A'

const amountText = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'HK$0'
  }

  return `HK$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const paidStatusText = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  return value ? 'Paid' : 'Unpaid'
}

const paidDateText = (
  paid: boolean | null | undefined,
  date: string | null | undefined
) => {
  if (!paid) {
    return null
  }

  return date && date.trim().length > 0 ? date : '-'
}

export default function ProjectsDatabasePage({
  mode,
  years,
  error,
  detailSelection,
  projects = [],
}: ProjectsDatabasePageProps) {
  const router = useRouter()

  const [sortMethod, setSortMethod] = useState<SortMethod>(
    detailSelection?.type ?? 'year'
  )
  const [selectedYear, setSelectedYear] = useState<string>(
    detailSelection?.year ?? years[0] ?? ''
  )
  const handleYearChange = (event: SelectChangeEvent<string>) => {
    setSelectedYear(event.target.value)
  }

  useEffect(() => {
    if (!selectedYear && years.length > 0) {
      setSelectedYear(years[0])
    }
  }, [years, selectedYear])

  useEffect(() => {
    if (detailSelection) {
      setSortMethod(detailSelection.type)
      setSelectedYear(detailSelection.year)
    }
  }, [detailSelection])

  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const handleNavigate = (type: SortMethod, year: string) => {
    if (!year) {
      return
    }

    router.push(
      `/dashboard/businesses/projects/${encodeSelectionId(type, year)}`
    )
  }

  const handleProjectClick = (project: ProjectRecord) => {
    setSelectedProject(project)
    setDetailOpen(true)
  }

  const standaloneUrl = useMemo(() => {
    if (!selectedProject) return null
    return `/dashboard/businesses/projects/window?group=${encodeURIComponent(
      encodeSelectionId('year', selectedProject.year)
    )}&project=${encodeURIComponent(selectedProject.id)}`
  }, [selectedProject])

  const createStandaloneUrl = useMemo(() => {
    if (!detailSelection) return null
    return `/dashboard/businesses/projects/new-window?group=${encodeURIComponent(
      encodeSelectionId(detailSelection.type, detailSelection.year)
    )}`
  }, [detailSelection])

  const handleDetach = () => {
    if (!standaloneUrl) return
    setDetailOpen(false)
    setSelectedProject(null)
    if (typeof window !== 'undefined') {
      const features = 'noopener,noreferrer,width=1200,height=800,resizable=yes,scrollbars=yes'
      window.open(standaloneUrl, '_blank', features)
    } else {
      void router.push(standaloneUrl)
    }
  }

  const handleEditSaved = async () => {
    setEditOpen(false)
    await router.replace(router.asPath)
  }

  const handleCreateSaved = async (_?: ProjectRecord | null) => {
    setCreateOpen(false)
    await router.replace(router.asPath)
  }

  const handleCloseDetail = () => {
    setDetailOpen(false)
    setSelectedProject(null)
  }

  const handleCreateDetach = () => {
    if (!createStandaloneUrl) return
    setCreateOpen(false)
    if (typeof window !== 'undefined') {
      const features = 'noopener,noreferrer,width=1200,height=800,resizable=yes,scrollbars=yes'
      window.open(createStandaloneUrl, '_blank', features)
    } else {
      void router.push(createStandaloneUrl)
    }
  }

  if (mode === 'select') {
    return (
      <SidebarLayout>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={headingSx} gutterBottom>
            Projects (Database)
          </Typography>
          <Typography variant="h6" sx={{ ...headingSx, mt: 2 }}>
            Establish Productions Limited
          </Typography>
        </Box>
        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
            mb: 3,
          }}
        >
          <ToggleButtonGroup
            value={sortMethod}
            exclusive
            onChange={(event, value: SortMethod | null) => {
              if (value) {
                setSortMethod(value)
              }
            }}
            size="small"
          >
            <ToggleButton value="year">By Year</ToggleButton>
            <ToggleButton value="subsidiary">By Subsidiary</ToggleButton>
          </ToggleButtonGroup>
          {sortMethod === 'year' && years.length > 0 && (
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={handleYearChange}
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {sortMethod === 'year' ? (
          years.length === 0 ? (
            <Typography>No project collections available.</Typography>
          ) : selectedYear ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <Card
                  sx={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleNavigate('year', selectedYear)}
                >
                  <CardContent>
                    <Typography variant="h6" sx={headingSx} gutterBottom>
                      Establish Productions Limited
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography>Please choose a year to continue.</Typography>
          )
        ) : years.length === 0 ? (
          <Typography>No project collections available.</Typography>
        ) : (
          <Grid container spacing={2}>
            {years.map((year) => (
              <Grid item xs={12} sm={6} md={4} key={year}>
                <Card
                  sx={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleNavigate('subsidiary', year)}
                >
                  <CardContent>
                    <Typography variant="h6" sx={headingSx} gutterBottom>
                      {year}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </SidebarLayout>
    )
  }

  const handleBack = () => {
    router.push('/dashboard/businesses/projects/select')
  }

  const headerLabel = detailSelection
    ? detailSelection.type === 'year'
      ? `Establish Productions Limited — ${detailSelection.year}`
      : `${detailSelection.year} Projects`
    : 'Projects'

  return (
    <SidebarLayout>
      <Box
        sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <IconButton onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={headingSx}>
            {headerLabel}
          </Typography>
          <Typography sx={valueSx}>Project Overview</Typography>
        </Box>
        <Button
          variant="contained"
          onClick={() => setCreateOpen(true)}
        >
          New Project
        </Button>
      </Box>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={headingSx} gutterBottom>
            Project List
          </Typography>
          {projects.length === 0 ? (
            <Typography>No project records available.</Typography>
          ) : (
            <List>
              {projects.map((project) => {
                const primary = `#${(project.projectNumber ?? '').replace(/^#/, '')} — ${stringOrNA(
                  project.projectTitle
                )}`
                const segments = [amountText(project.amount)]
                // Derive status from invoices when available, fallback to project fields
                let statusLabel: string | null = null
                if (Array.isArray((project as any).invoices) && (project as any).invoices.length > 0) {
                  const invoices = (project as any).invoices as Array<{ paid: boolean | null }>
                  const total = invoices.length
                  const cleared = invoices.filter((inv) => inv.paid === true).length
                  if (cleared === 0) {
                    statusLabel = 'Due'
                  } else if (cleared < total) {
                    statusLabel = 'Partially Cleared'
                  } else {
                    statusLabel = 'All Clear'
                  }
                } else {
                  statusLabel = paidStatusText(project.paid)
                }
                if (statusLabel) {
                  segments.push(statusLabel)
                }

                return (
                  <ListItem
                    key={`${project.year}-${(project.projectNumber ?? '').replace(/^#/, '')}`}
                    alignItems="flex-start"
                    sx={{ cursor: 'pointer' }}
                    onClick={() => handleProjectClick(project)}
                  >
                    <ListItemText
                      primary={primary}
                      secondary={segments.join(' | ')}
                    />
                  </ListItem>
                )
              })}
            </List>
          )}
        </CardContent>
      </Card>
      <ProjectDatabaseDetailDialog
        open={detailOpen && Boolean(selectedProject)}
        onClose={handleCloseDetail}
        project={selectedProject}
        headerActions={
          standaloneUrl ? (
            <IconButton onClick={handleDetach} size="small" aria-label="Open in new window">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          ) : null
        }
        onEdit={() => setEditOpen(true)}
      />
      <ProjectDatabaseEditDialog
        open={editOpen}
        project={selectedProject}
        onClose={() => setEditOpen(false)}
        onSaved={handleEditSaved}
      />
      <ProjectDatabaseCreateDialog
        open={createOpen}
        year={detailSelection?.year ?? null}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreateSaved}
        onDetach={createStandaloneUrl ? handleCreateDetach : undefined}
        existingProjectNumbers={
          (projects ?? [])
            .map((project) => project.projectNumber?.trim())
            .filter((value): value is string => Boolean(value))
        }
      />
    </SidebarLayout>
  )
}

export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
  ctx
) => {
  const session = await getSession(ctx)
  if (!session?.user) {
    return { redirect: { destination: '/auth/signin', permanent: false } }
  }

  const groupParam = ctx.params?.groupId as string | undefined

  try {
    const { projects, years } = await fetchProjectsFromDatabase()

    if (!groupParam || groupParam === 'select') {
      return {
        props: {
          mode: 'select',
          years,
        },
      }
    }

    const selection = decodeSelectionId(groupParam)
    if (!selection) {
      return {
        props: {
          mode: 'select',
          years,
          error: 'Invalid project selection, please choose again.',
        },
      }
    }

    if (!years.includes(selection.year)) {
      return {
        props: {
          mode: 'select',
          years,
          error: 'Project collection not found, please choose again.',
        },
      }
    }

    const matchingProjects = projects.filter(
      (project) => project.year === selection.year
    )

    return {
      props: {
        mode: 'detail',
        years,
        detailSelection: selection,
        projects: matchingProjects,
      },
    }
  } catch (err) {
    console.error('[projects] Failed to load projects:', err)
    return {
      props: {
        mode: 'select',
        years: [],
        error:
          err instanceof Error ? err.message : 'Error retrieving project records',
      },
    }
  }
}
