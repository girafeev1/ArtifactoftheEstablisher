import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

import SidebarLayout from '../../../../components/SidebarLayout'
import ProjectsDatabaseDialog from '../../../../components/projectdialog/ProjectsDatabaseDialog'
import { fetchProjectsFromDatabase, ProjectRecord } from '../../../../lib/projectsDatabase'

import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

type SortMethod = 'year' | 'company'

interface ProjectGroupSummary {
  year: string
  subsidiary: string
  groupId: string
  displayName: string
  projectCount: number
}

type GroupMap = Record<string, ProjectGroupSummary[]>

interface DetailSelection {
  year: string
  subsidiary: string
  displayName: string
}

interface ProjectsDatabasePageProps {
  mode: 'select' | 'detail'
  years: string[]
  companies: string[]
  groupsByYear: GroupMap
  groupsByCompany: GroupMap
  projects: ProjectRecord[]
  selection?: DetailSelection
  error?: string
}

const headingSx = { fontFamily: 'Cantata One' }
const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }

const encodeGroupId = (year: string, subsidiary: string) =>
  `${encodeURIComponent(year)}---${encodeURIComponent(subsidiary)}`

const decodeGroupId = (value: string): { year: string; subsidiary: string } | null => {
  const [yearPart, subsidiaryPart] = value.split('---')
  if (!yearPart || !subsidiaryPart) {
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

const formatAmount = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return `HK$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const paidStatus = (value: boolean | null) => {
  if (value === null) {
    return 'N/A'
  }
  return value ? 'Paid' : 'Unpaid'
}

export default function ProjectsDatabasePage({
  mode,
  years,
  companies,
  groupsByYear,
  groupsByCompany,
  projects,
  selection,
  error,
}: ProjectsDatabasePageProps) {
  const router = useRouter()

  const [sortMethod, setSortMethod] = useState<SortMethod>('year')
  const [selectedYear, setSelectedYear] = useState<string>(years[0] ?? '')
  const [selectedCompany, setSelectedCompany] = useState<string>(companies[0] ?? '')
  const [dialogProject, setDialogProject] = useState<ProjectRecord | null>(null)

  useEffect(() => {
    if (mode === 'detail' && selection) {
      setSortMethod('year')
      setSelectedYear(selection.year)
      setSelectedCompany(selection.subsidiary)
    }
  }, [mode, selection])

  useEffect(() => {
    if (sortMethod === 'year') {
      if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0])
      }
    } else if (sortMethod === 'company') {
      if (!selectedCompany && companies.length > 0) {
        setSelectedCompany(companies[0])
      }
    }
  }, [sortMethod, years, companies, selectedYear, selectedCompany])

  const handleYearChange = (event: SelectChangeEvent<string>) => {
    setSelectedYear(event.target.value)
  }

  const handleCompanyChange = (event: SelectChangeEvent<string>) => {
    setSelectedCompany(event.target.value)
  }

  const groupsToDisplay = useMemo(() => {
    if (sortMethod === 'year') {
      return selectedYear ? groupsByYear[selectedYear] ?? [] : []
    }
    return selectedCompany ? groupsByCompany[selectedCompany] ?? [] : []
  }, [sortMethod, selectedYear, selectedCompany, groupsByYear, groupsByCompany])

  const handleNavigate = (group: ProjectGroupSummary) => {
    router.push(`/dashboard/businesses/projects-database/${group.groupId}`)
  }

  if (mode === 'select') {
    return (
      <SidebarLayout>
        <Box sx={{ p: 2 }}>
          <Typography variant="h4" sx={headingSx} gutterBottom>
            Projects (Database)
          </Typography>
          <Typography variant="h6" sx={headingSx} gutterBottom>
            Establish Productions Limited
          </Typography>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <ToggleButtonGroup
              value={sortMethod}
              exclusive
              onChange={(_, value: SortMethod | null) => {
                if (value) {
                  setSortMethod(value)
                }
              }}
              size="small"
            >
              <ToggleButton value="year">By Year</ToggleButton>
              <ToggleButton value="company">By Company</ToggleButton>
            </ToggleButtonGroup>
            {sortMethod === 'year' && years.length > 0 && (
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Year</InputLabel>
                <Select value={selectedYear} label="Year" onChange={handleYearChange}>
                  {years.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {sortMethod === 'company' && companies.length > 0 && (
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>Company</InputLabel>
                <Select value={selectedCompany} label="Company" onChange={handleCompanyChange}>
                  {companies.map((company) => (
                    <MenuItem key={company} value={company}>
                      {company}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
          {groupsToDisplay.length === 0 ? (
            <Typography>No project collections available.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {groupsToDisplay.map((group) => (
                <Card
                  key={group.groupId}
                  sx={{ cursor: 'pointer', width: 260 }}
                  onClick={() => handleNavigate(group)}
                >
                  <CardContent>
                    <Typography variant="h6" sx={headingSx} gutterBottom>
                      {sortMethod === 'year' ? group.displayName : group.year}
                    </Typography>
                    <Typography sx={valueSx}>
                      {sortMethod === 'year'
                        ? `${group.projectCount} project${group.projectCount === 1 ? '' : 's'}`
                        : group.displayName}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </SidebarLayout>
    )
  }

  const handleBack = () => {
    router.push('/dashboard/businesses/projects-database/select')
  }

  const listLabel = selection
    ? `${selection.displayName} — ${selection.year}`
    : 'Projects'

  return (
    <SidebarLayout>
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            mb: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <IconButton onClick={handleBack}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={headingSx}>
              {listLabel}
            </Typography>
            <Typography sx={valueSx}>Project Overview</Typography>
          </Box>
          <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
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
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                {projects.map((project) => {
                  const secondaryParts = [formatAmount(project.amount), paidStatus(project.paid)]
                  if (project.paid && project.onDateDisplay) {
                    secondaryParts.push(project.onDateDisplay)
                  }

                  return (
                    <Box
                      key={`${project.year}-${project.projectNumber}`}
                      component="li"
                      sx={{
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(0,0,0,0.12)',
                        py: 1.5,
                      }}
                      onClick={() => setDialogProject(project)}
                    >
                      <Typography sx={valueSx}>
                        {`${project.projectNumber} — ${project.projectTitle ?? 'Untitled Project'}`}
                      </Typography>
                      <Typography sx={{ ...valueSx, fontSize: 14 }}>
                        {secondaryParts.join(' | ')}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
      {dialogProject && (
        <ProjectsDatabaseDialog
          open={Boolean(dialogProject)}
          onClose={() => setDialogProject(null)}
          project={dialogProject}
        />
      )}
    </SidebarLayout>
  )
}

const normalizeSubsidiary = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value.trim() : 'Establish Productions Limited'

const sortCompanies = (values: Iterable<string>) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))

export const getServerSideProps: GetServerSideProps<ProjectsDatabasePageProps> = async (
  ctx
) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } }
  }

  try {
    const { projects, years } = await fetchProjectsFromDatabase()

    const groupLookup = new Map<string, ProjectGroupSummary>()
    const groupsByYear: GroupMap = {}
    const groupsByCompany: GroupMap = {}

    projects.forEach((project) => {
      const year = project.year
      const subsidiary = normalizeSubsidiary(project.subsidiary)
      const key = `${year}|||${subsidiary}`
      let summary = groupLookup.get(key)
      if (!summary) {
        summary = {
          year,
          subsidiary,
          displayName: subsidiary,
          projectCount: 0,
          groupId: encodeGroupId(year, subsidiary),
        }
        groupLookup.set(key, summary)
        if (!groupsByYear[year]) {
          groupsByYear[year] = []
        }
        groupsByYear[year].push(summary)
        if (!groupsByCompany[subsidiary]) {
          groupsByCompany[subsidiary] = []
        }
        groupsByCompany[subsidiary].push(summary)
      }
      summary.projectCount += 1
    })

    Object.values(groupsByYear).forEach((list) =>
      list.sort((a, b) => a.displayName.localeCompare(b.displayName))
    )
    Object.values(groupsByCompany).forEach((list) =>
      list.sort((a, b) => b.year.localeCompare(a.year, undefined, { numeric: true }))
    )

    const companies = sortCompanies(Object.keys(groupsByCompany))

    const groupParam = ctx.params?.groupId as string | undefined

    if (!groupParam || groupParam === 'select') {
      return {
        props: {
          mode: 'select',
          years,
          companies,
          groupsByYear,
          groupsByCompany,
          projects: [],
        },
      }
    }

    const decoded = decodeGroupId(groupParam)
    if (!decoded) {
      return {
        props: {
          mode: 'select',
          years,
          companies,
          groupsByYear,
          groupsByCompany,
          projects: [],
          error: 'Invalid project selection, please choose again.',
        },
      }
    }

    const normalizedSubsidiaryValue = normalizeSubsidiary(decoded.subsidiary)
    const groupKey = `${decoded.year}|||${normalizedSubsidiaryValue}`
    const summary = groupLookup.get(groupKey)
    if (!summary) {
      return {
        props: {
          mode: 'select',
          years,
          companies,
          groupsByYear,
          groupsByCompany,
          projects: [],
          error: 'Project collection not found, please choose again.',
        },
      }
    }

    const matchingProjects = projects.filter(
      (project) =>
        project.year === decoded.year &&
        normalizeSubsidiary(project.subsidiary) === normalizedSubsidiaryValue
    )

    return {
      props: {
        mode: 'detail',
        years,
        companies,
        groupsByYear,
        groupsByCompany,
        projects: matchingProjects,
        selection: {
          year: decoded.year,
          subsidiary: normalizedSubsidiaryValue,
          displayName: summary.displayName,
        },
      },
    }
  } catch (err) {
    console.error('[projects-database] Failed to load projects', err)
    return {
      props: {
        mode: 'select',
        years: [],
        companies: [],
        groupsByYear: {},
        groupsByCompany: {},
        projects: [],
        error: err instanceof Error ? err.message : 'Error retrieving project records',
      },
    }
  }
}

