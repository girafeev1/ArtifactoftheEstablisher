import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import SidebarLayout from '../../../../components/SidebarLayout'
import {
  fetchProjectsFromDatabase,
  ProjectRecord,
} from '../../../../lib/projectsDatabase'

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
import ProjectDatabaseDetailDialog from '../../../../components/projectdialog/ProjectDatabaseDetailDialog'
import ProjectDatabaseEditDialog from '../../../../components/projectdialog/ProjectDatabaseEditDialog'

const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
const headingSx = { fontFamily: 'Cantata One' }

type SortMethod = 'year' | 'subsidiary'

type Mode = 'select' | 'detail'

interface DetailSelection {
  type: SortMethod
  year: string
}

interface ProjectsDatabasePageProps {
  mode: Mode
  years: string[]
  error?: string
  detailSelection?: DetailSelection
  projects?: ProjectRecord[]
}

const encodeSelectionId = (type: SortMethod, year: string) => {
  const yearPart = encodeURIComponent(year)
  return `${type}--${yearPart}`
}

const decodeSelectionId = (value: string): DetailSelection | null => {
  const [typePart, yearPart] = value.split('--')
  if (!typePart || !yearPart) {
    return null
  }

  if (typePart !== 'year' && typePart !== 'subsidiary') {
    return null
  }

  try {
    return { type: typePart, year: decodeURIComponent(yearPart) }
  } catch (err) {
    console.warn('[projects-database] Failed to decode selection id', err)
    return null
  }
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(
    null
  )
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [projectForEdit, setProjectForEdit] = useState<ProjectRecord | null>(null)

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

  const handleNavigate = (type: SortMethod, year: string) => {
    if (!year) {
      return
    }

    router.push(
      `/dashboard/businesses/projects-database/${encodeSelectionId(type, year)}`
    )
  }

  const handleProjectClick = (project: ProjectRecord) => {
    setSelectedProject(project)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setSelectedProject(null)
  }

  const handleStartEdit = () => {
    if (!selectedProject) {
      return
    }
    setProjectForEdit(selectedProject)
    setDialogOpen(false)
    setEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setProjectForEdit(null)
    if (selectedProject) {
      setDialogOpen(true)
    }
  }

  const handleEditSaved = async () => {
    setEditDialogOpen(false)
    setProjectForEdit(null)
    setSelectedProject(null)
    await router.replace(router.asPath)
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
                    <Typography sx={valueSx}>{selectedYear} Projects</Typography>
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
                    <Typography sx={valueSx}>Project Collection</Typography>
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
    router.push('/dashboard/businesses/projects-database/select')
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
          onClick={() => router.push('/dashboard/businesses/new')}
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
                const primary = `${stringOrNA(project.projectNumber)} — ${stringOrNA(
                  project.projectTitle
                )}`
                const segments = [
                  amountText(project.amount),
                  paidStatusText(project.paid),
                ]
                const paidDate = paidDateText(project.paid, project.onDateDisplay)
                if (paidDate) {
                  segments.push(paidDate)
                }

                return (
                  <ListItem
                    key={`${project.year}-${project.projectNumber}`}
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
        open={dialogOpen}
        onClose={handleCloseDialog}
        project={selectedProject}
        onEdit={handleStartEdit}
      />
      <ProjectDatabaseEditDialog
        open={editDialogOpen}
        project={projectForEdit}
        onClose={handleCloseEditDialog}
        onSaved={handleEditSaved}
      />
    </SidebarLayout>
  )
}

export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
  ctx
) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } }
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
    console.error('[projects-database] Failed to load projects:', err)
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
