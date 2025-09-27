import { useMemo } from 'react'

import { Box, Chip, Divider, Link, Stack, Typography } from '@mui/material'

import type { ProjectRecord } from '../../lib/projectsDatabase'
import type { ReactNode } from 'react'

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
  fontSize: '1.05rem',
} as const

interface ProjectDatabaseDetailContentProps {
  project: ProjectRecord
  headerActions?: ReactNode
  footerActions?: ReactNode
}

export default function ProjectDatabaseDetailContent({
  project,
  headerActions,
  footerActions,
}: ProjectDatabaseDetailContentProps) {
  const detailItems = useMemo(() => {
    const invoiceValue: ReactNode = project.invoice
      ? project.invoice.startsWith('http')
        ? (
            <Link
              href={project.invoice}
              target="_blank"
              rel="noopener"
              sx={{ fontFamily: 'inherit', fontWeight: 'inherit' }}
            >
              {project.invoice}
            </Link>
          )
        : textOrNA(project.invoice)
      : 'N/A'

    return [
      { label: 'Client Company', value: textOrNA(project.clientCompany) },
      { label: 'Subsidiary', value: textOrNA(project.subsidiary) },
      { label: 'Presenter Work Type', value: textOrNA(project.presenterWorkType) },
      {
        label: 'Project Pickup Date',
        value: project.projectDateDisplay ?? '-',
      },
      { label: 'Amount', value: formatAmount(project.amount) },
      { label: 'Paid', value: project.paid ? 'Yes' : 'No' },
      {
        label: 'Paid On',
        value: project.paid ? project.onDateDisplay ?? '-' : '-',
      },
      { label: 'Pay To', value: textOrNA(project.paidTo) },
      { label: 'Invoice', value: invoiceValue },
    ] satisfies Array<{ label: string; value: ReactNode }>
  }, [project])

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Stack spacing={0.5} sx={{ width: '100%' }}>
          <Typography variant="subtitle1" color="text.secondary">
            {project.projectNumber}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
            {textOrNA(project.presenterWorkType)}
          </Typography>
          <Typography variant="h4" sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}>
            {textOrNA(project.projectTitle)}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            — {textOrNA(project.projectNature)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={project.year} color="primary" variant="outlined" />
          {project.subsidiary && (
            <Chip label={project.subsidiary} variant="outlined" />
          )}
          {headerActions}
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={1.6}>
        {detailItems.map(({ label, value }) => (
          <Box key={label}>
            <Typography sx={labelSx}>{label}:</Typography>
            <Typography component="div" sx={valueSx}>
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>

      {footerActions && (
        <>
          <Divider />
          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            {footerActions}
          </Stack>
        </>
      )}
    </Stack>
  )
}

