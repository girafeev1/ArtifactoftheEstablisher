// pages/dashboard/businesses/projects-database.tsx

import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'

import SidebarLayout from '../../../components/SidebarLayout'
import { fetchProjectsFromDatabase, ProjectRecord } from '../../../lib/projectsDatabase'

import {
  Box,
  Card,
  CardContent,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'

type SortMethod = 'year' | 'subsidiary'

interface ProjectsDatabasePageProps {
  projects: ProjectRecord[]
  years: string[]
  error?: string
}

const labelSx = { fontFamily: 'Newsreader', fontWeight: 200 }
const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }
const titleSx = { fontFamily: 'Cantata One' }

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

const projectCardKey = (project: ProjectRecord) =>
  `${project.year}-${project.id}`

export default function ProjectsDatabasePage({
  projects,
  years,
  error,
}: ProjectsDatabasePageProps) {
  const [sortMethod, setSortMethod] = useState<SortMethod>('year')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>('')

  const availableYears = useMemo(() => {
    if (years.length > 0) return years
    const derived = Array.from(new Set(projects.map((p) => p.year)))
    return derived.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [projects, years])

  const subsidiaries = useMemo(() => {
    const unique = new Set(
      projects
        .map((p) => p.subsidiary)
        .filter((value): value is string => Boolean(value && value.trim()))
    )
    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [projects])

  useEffect(() => {
    if (sortMethod === 'year') {
      if (!selectedYear && availableYears.length > 0) {
        setSelectedYear(availableYears[0])
      }
    } else if (sortMethod === 'subsidiary') {
      if (!selectedSubsidiary && subsidiaries.length > 0) {
        setSelectedSubsidiary(subsidiaries[0])
      }
    }
  }, [sortMethod, availableYears, subsidiaries, selectedYear, selectedSubsidiary])

  const filteredProjects = useMemo(() => {
    if (sortMethod === 'year') {
      return projects.filter((project) =>
        selectedYear ? project.year === selectedYear : true
      )
    }
    return projects.filter((project) =>
      selectedSubsidiary ? project.subsidiary === selectedSubsidiary : true
    )
  }, [projects, sortMethod, selectedYear, selectedSubsidiary])

  const sortedProjects = useMemo(
    () =>
      filteredProjects.slice().sort((a, b) => {
        if (sortMethod === 'year') {
          if (a.year !== b.year) {
            return b.year.localeCompare(a.year, undefined, { numeric: true })
          }
        } else {
          if ((a.subsidiary || '') !== (b.subsidiary || '')) {
            return stringOrNA(a.subsidiary).localeCompare(
              stringOrNA(b.subsidiary)
            )
          }
        }
        return a.projectNumber.localeCompare(b.projectNumber, undefined, {
          numeric: true,
        })
      }),
    [filteredProjects, sortMethod]
  )

  const renderField = (label: string, value: string) => (
    <Box sx={{ mb: 1 }}>
      <Typography sx={labelSx}>{label}:</Typography>
      <Typography sx={valueSx}>{value}</Typography>
    </Box>
  )

  return (
    <SidebarLayout>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={titleSx} gutterBottom>
          Projects (Database)
        </Typography>
        <Typography sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
          Review project records synchronized from Firestore.
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
        {sortMethod === 'year' && availableYears.length > 0 && (
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>Year</InputLabel>
            <Select
              value={selectedYear}
              label="Year"
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {availableYears.map((year) => (
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
      {sortedProjects.length === 0 ? (
        <Typography>No projects available for the selected filters.</Typography>
      ) : (
        <Grid container spacing={2}>
          {sortedProjects.map((project) => (
            <Grid item xs={12} md={6} lg={4} key={projectCardKey(project)}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    sx={{ fontFamily: 'Cantata One', mb: 1 }}
                  >
                    {stringOrNA(project.projectNumber)}
                  </Typography>
                  <Typography sx={{ ...valueSx, mb: 2 }}>
                    {stringOrNA(project.projectTitle)}
                  </Typography>
                  {renderField('Client Company', stringOrNA(project.clientCompany))}
                  {renderField('Subsidiary', stringOrNA(project.subsidiary))}
                  {renderField('Project Nature', stringOrNA(project.projectNature))}
                  {renderField('Presenter Work Type', stringOrNA(project.presenterWorkType))}
                  {renderField('Invoice Number', stringOrNA(project.invoice))}
                  {renderField('Paid To', stringOrNA(project.paidTo))}
                  {renderField('Project Date', dateOrDash(project.projectDateDisplay))}
                  {renderField('Payment On', dateOrDash(project.onDateDisplay))}
                  {renderField('Amount', numberOrDash(project.amount))}
                  {renderField('Status', paidStatus(project.paid))}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
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

  try {
    const { projects, years } = await fetchProjectsFromDatabase()
    return {
      props: {
        projects,
        years,
      },
    }
  } catch (err) {
    console.error('[projects-database] Failed to load projects:', err)
    return {
      props: {
        projects: [],
        years: [],
        error: err instanceof Error ? err.message : 'Error retrieving projects',
      },
    }
  }
}

