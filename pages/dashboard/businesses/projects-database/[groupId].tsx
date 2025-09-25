import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import SidebarLayout from '../../../../components/SidebarLayout'
import { fetchProjectsFromDatabase, ProjectRecord } from '../../../../lib/projectsDatabase'

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
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

const labelSx = { fontFamily: 'Newsreader', fontWeight: 200 }
const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
const headingSx = { fontFamily: 'Cantata One' }

type SortMethod = 'year' | 'subsidiary'

type Mode = 'select' | 'detail'

interface ProjectGroupSummary {
  id: string
  year: string
  subsidiaryLabel: string
  projectCount: number
}

type NormalizedProjectRecord = ProjectRecord & { normalizedSubsidiary: string }

interface ProjectsDatabasePageProps {
  mode: Mode
  years: string[]
  subsidiaries: string[]
  groups: ProjectGroupSummary[]
  error?: string
  detailGroup?: {
    id: string
    year: string
    subsidiaryLabel: string
  }
  projects?: ProjectRecord[]
}

const normalizeSubsidiary = (value: string | null | undefined) => {
  if (!value) {
    return 'N/A'
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : 'N/A'
}

const encodeGroupId = (year: string, subsidiaryLabel: string) => {
  const yearPart = encodeURIComponent(year)
  const subsidiaryPart = encodeURIComponent(subsidiaryLabel)
  return `${yearPart}--${subsidiaryPart}`
}

const decodeGroupId = (value: string) => {
  const [yearPart, subsidiaryPart] = value.split('--')
  if (!yearPart || subsidiaryPart === undefined) {
    return null
  }
  try {
    return {
      year: decodeURIComponent(yearPart),
      subsidiary: decodeURIComponent(subsidiaryPart),
    }
  } catch (err) {
    console.warn('[projects-database] Failed to decode group id', err)
    return null
  }
}

const stringOrNA = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value : 'N/A'

const numberOrDash = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '-'
    : `HK$${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`

const dateOrDash = (value: string | null | undefined) => (value ? value : '-')

const paidStatus = (value: boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  return value ? 'Paid' : 'Unpaid'
}

const projectKey = (project: ProjectRecord) => `${project.year}-${project.projectNumber}`

const groupSort = (a: ProjectGroupSummary, b: ProjectGroupSummary) => {
  if (a.year !== b.year) {
    return b.year.localeCompare(a.year, undefined, { numeric: true })
  }
  return a.subsidiaryLabel.localeCompare(b.subsidiaryLabel)
}

export default function ProjectsDatabasePage({
  mode,
  years,
  subsidiaries,
  groups,
  error,
  detailGroup,
  projects = [],
}: ProjectsDatabasePageProps) {
  const router = useRouter()

  const [sortMethod, setSortMethod] = useState<SortMethod>('year')
  const [selectedYear, setSelectedYear] = useState<string>(years[0] || '')
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>(subsidiaries[0] || '')

  useEffect(() => {
    if (sortMethod === 'year') {
      if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0])
      }
    } else if (sortMethod === 'subsidiary') {
      if (!selectedSubsidiary && subsidiaries.length > 0) {
        setSelectedSubsidiary(subsidiaries[0])
      }
    }
  }, [sortMethod, years, subsidiaries, selectedYear, selectedSubsidiary])

  useEffect(() => {
    if (mode === 'detail' && detailGroup) {
      setSelectedYear(detailGroup.year)
      setSelectedSubsidiary(detailGroup.subsidiaryLabel)
      setSortMethod('year')
    }
  }, [mode, detailGroup])

  const filteredGroups = useMemo(() => {
    if (mode !== 'select') {
      return []
    }

    if (sortMethod === 'year') {
      return groups
        .filter((group) => (selectedYear ? group.year === selectedYear : true))
        .sort(groupSort)
    }

    return groups
      .filter((group) =>
        selectedSubsidiary
          ? group.subsidiaryLabel === selectedSubsidiary
          : true
      )
      .sort(groupSort)
  }, [mode, groups, sortMethod, selectedYear, selectedSubsidiary])

  if (mode === 'select') {
    return (
      <SidebarLayout>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={headingSx} gutterBottom>
            Projects (Database)
          </Typography>
          <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
            Choose a company-year collection to review synchronized Firestore projects.
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
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {sortMethod === 'subsidiary' && subsidiaries.length > 0 && (
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel>Subsidiary</InputLabel>
              <Select
                value={selectedSubsidiary}
                label="Subsidiary"
                onChange={(event) => setSelectedSubsidiary(event.target.value)}
              >
                {subsidiaries.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {filteredGroups.length === 0 ? (
          <Typography>No project collections available.</Typography>
        ) : (
          <Grid container spacing={2}>
            {filteredGroups.map((group) => (
              <Grid item xs={12} sm={6} md={4} key={group.id}>
                <Card
                  sx={{ cursor: 'pointer', height: '100%' }}
                  onClick={() =>
                    router.push(`/dashboard/businesses/projects-database/${group.id}`)
                  }
                >
                  <CardContent>
                    <Typography variant="h6" sx={headingSx} gutterBottom>
                      {sortMethod === 'year'
                        ? group.subsidiaryLabel
                        : group.year}
                    </Typography>
                    <Typography sx={valueSx}>
                      {group.projectCount} project{group.projectCount === 1 ? '' : 's'}
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
    router.push('/dashboard/businesses/projects-database/select')
  }

  const headerLabel = detailGroup
    ? `${detailGroup.subsidiaryLabel} — ${detailGroup.year}`
    : 'Projects'

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton onClick={handleBack}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={headingSx}>
            {headerLabel}
          </Typography>
          <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
            Project Overview
          </Typography>
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
              {projects.map((project) => (
                <ListItem key={projectKey(project)} alignItems="flex-start">
                  <ListItemText
                    primary={`${stringOrNA(project.projectNumber)} — ${stringOrNA(project.projectTitle)}`}
                    primaryTypographyProps={{ sx: valueSx }}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', mt: 1, gap: 1 }}>
                        <Box>
                          <Typography sx={labelSx}>Client Company:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.clientCompany)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Subsidiary:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.subsidiary)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Project Nature:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.projectNature)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Presenter Work Type:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.presenterWorkType)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Invoice:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.invoice)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Paid To:</Typography>
                          <Typography sx={valueSx}>{stringOrNA(project.paidTo)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Project Date:</Typography>
                          <Typography sx={valueSx}>{dateOrDash(project.projectDateDisplay)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Payment On:</Typography>
                          <Typography sx={valueSx}>{dateOrDash(project.onDateDisplay)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Amount:</Typography>
                          <Typography sx={valueSx}>{numberOrDash(project.amount)}</Typography>
                        </Box>
                        <Box>
                          <Typography sx={labelSx}>Status:</Typography>
                          <Typography sx={valueSx}>{paidStatus(project.paid)}</Typography>
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
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

    const normalizedProjects: NormalizedProjectRecord[] = projects.map((project) => ({
      ...project,
      normalizedSubsidiary: normalizeSubsidiary(project.subsidiary),
    }))

    const subsidiariesSet = new Set<string>()
    const groupsMap = new Map<string, ProjectGroupSummary>()

    normalizedProjects.forEach((project) => {
      const normalized = project.normalizedSubsidiary
      subsidiariesSet.add(normalized)
      const id = encodeGroupId(project.year, normalized)
      const existing = groupsMap.get(id)
      if (existing) {
        existing.projectCount += 1
      } else {
        groupsMap.set(id, {
          id,
          year: project.year,
          subsidiaryLabel: normalized,
          projectCount: 1,
        })
      }
    })

    const groups = Array.from(groupsMap.values()).sort(groupSort)
    const subsidiaries = Array.from(subsidiariesSet).sort((a, b) => a.localeCompare(b))

    if (!groupParam || groupParam === 'select') {
      return {
        props: {
          mode: 'select',
          years,
          subsidiaries,
          groups,
        },
      }
    }

    const decoded = decodeGroupId(groupParam)
    if (!decoded) {
      return {
        props: {
          mode: 'select',
          years,
          subsidiaries,
          groups,
          error: 'Invalid project selection, please choose again.',
        },
      }
    }

    const matchingGroup = groupsMap.get(encodeGroupId(decoded.year, decoded.subsidiary))
    if (!matchingGroup) {
      return {
        props: {
          mode: 'select',
          years,
          subsidiaries,
          groups,
          error: 'Project collection not found, please choose again.',
        },
      }
    }

    const matchingProjects = normalizedProjects.filter(
      (project) =>
        project.year === decoded.year &&
        project.normalizedSubsidiary === decoded.subsidiary
    )

    return {
      props: {
        mode: 'detail',
        years,
        subsidiaries,
        groups,
        detailGroup: {
          id: matchingGroup.id,
          year: matchingGroup.year,
          subsidiaryLabel: matchingGroup.subsidiaryLabel,
        },
        projects: matchingProjects,
      },
    }
  } catch (err) {
    console.error('[projects-database] Failed to load projects:', err)
    return {
      props: {
        mode: 'select',
        years: [],
        subsidiaries: [],
        groups: [],
        error:
          err instanceof Error ? err.message : 'Error retrieving project records',
      },
    }
  }
}
