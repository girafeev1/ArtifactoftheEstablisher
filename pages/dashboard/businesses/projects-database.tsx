// pages/dashboard/businesses/projects-database.tsx

import { useEffect, useMemo, useState } from 'react'
import SidebarLayout from '../../../components/SidebarLayout'
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
} from '@mui/material'
import {
  fetchProjectYears,
  fetchProjectsForYear,
  FirestoreProjectRecord,
} from '../../../lib/projectsDatabase'
import { useRouter } from 'next/router'

interface YearLoadResult {
  year: string
  projects: FirestoreProjectRecord[]
  error?: string
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatText(value: string | undefined | null): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A'
  }
  return value
}

function formatBoolean(value: boolean | null): string {
  if (value === null) {
    return 'N/A'
  }
  return value ? 'Yes' : 'No'
}

function formatDate(value: Date | null): string {
  if (!value) return '-'
  if (Number.isNaN(value.getTime())) return '-'
  return value.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

export default function ProjectsDatabasePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [years, setYears] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [projectsByYear, setProjectsByYear] = useState<Record<string, FirestoreProjectRecord[]>>({})
  const [yearErrors, setYearErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setGeneralError(null)
      try {
        const availableYears = await fetchProjectYears()
        if (cancelled) return

        setYears(availableYears)
        setSelectedYear((current) =>
          current && availableYears.includes(current) ? current : availableYears[0] || '',
        )

        if (availableYears.length === 0) {
          setProjectsByYear({})
          setYearErrors({})
          return
        }

        const results = await Promise.all(
          availableYears.map(async (year) => {
            try {
              const projects = await fetchProjectsForYear(year)
              return { year, projects } satisfies YearLoadResult
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Unable to load project data.'
              return { year, projects: [], error: message } satisfies YearLoadResult
            }
          }),
        )

        if (cancelled) return

        const nextProjects: Record<string, FirestoreProjectRecord[]> = {}
        const nextErrors: Record<string, string> = {}

        results.forEach(({ year, projects, error }) => {
          nextProjects[year] = projects
          if (error) {
            nextErrors[year] = error
          }
        })

        setProjectsByYear(nextProjects)
        setYearErrors(nextErrors)
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Failed to load project data.'
          setGeneralError(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedProjects = useMemo(() => {
    if (!selectedYear) return []
    return projectsByYear[selectedYear] || []
  }, [projectsByYear, selectedYear])

  const selectedYearError = selectedYear ? yearErrors[selectedYear] : undefined

  const handleYearChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value
    setSelectedYear(value)
  }

  return (
    <SidebarLayout>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontFamily: 'Cantata One' }}>
            Projects (Database)
          </Typography>
          <Button variant="contained" onClick={() => router.push('/dashboard/businesses/new')}>
            New Project
          </Button>
        </Box>

        {generalError && (
          <Alert severity="error" sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
            {generalError}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel id="projects-database-year-label" sx={{ fontFamily: 'Newsreader', fontWeight: 200 }}>
              Year
            </InputLabel>
            <Select
              labelId="projects-database-year-label"
              value={selectedYear}
              label="Year"
              onChange={handleYearChange}
              sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year} sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Project #</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Title</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Client</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Nature</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Presenter Work Type</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Subsidiary</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Amount</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Invoice #</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Invoice Company</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Paid</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Paid To</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>Project Date</TableCell>
                  <TableCell sx={{ fontFamily: 'Cantata One' }}>On Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedProjects.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={13}
                      align="center"
                      sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}
                    >
                      {selectedYearError ? `Error: ${selectedYearError}` : 'No projects found for this year.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedProjects.map((project) => (
                    <TableRow key={`${project.year}-${project.id}`} hover>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.projectNumber)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.projectTitle)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.clientCompany)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.projectNature)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.presenterWorkType)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.subsidiary)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatCurrency(project.amount)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.invoice)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.invoiceCompany ?? null)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatBoolean(project.paid)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatText(project.paidTo)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatDate(project.projectDate)}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                        {formatDate(project.onDate)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </SidebarLayout>
  )
}

