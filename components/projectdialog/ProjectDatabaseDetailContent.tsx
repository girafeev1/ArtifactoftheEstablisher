import { useMemo } from 'react'

import { Box, Chip, Divider, IconButton, Link, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'

import type { ProjectRecord } from '../../lib/projectsDatabase'
import type { ReactNode } from 'react'
import { Cormorant_Infant } from 'next/font/google'

const cormorantSemi = Cormorant_Infant({ subsets: ['latin'], weight: '600' })

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
  fontFamily: 'Calibri, "Segoe UI", sans-serif',
  fontWeight: 400,
  fontSize: '0.9rem',
  letterSpacing: '0.02em',
} as const

const valueSx = {
  fontSize: '1.2rem',
  lineHeight: 1.3,
} as const

interface ProjectDatabaseDetailContentProps {
  project: ProjectRecord
  headerActions?: ReactNode
  onClose?: () => void
  onEdit?: () => void
}

export default function ProjectDatabaseDetailContent({
  project,
  headerActions,
  onClose,
  onEdit,
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
      {
        label: 'Project Pickup Date',
        value: project.projectDateDisplay ?? '-',
      },
      { label: 'Amount', value: formatAmount(project.amount) },
      { label: 'Paid', value: project.paid ? '🤑' : '👎🏻' },
      {
        label: 'Paid On',
        value: project.paid ? project.onDateDisplay ?? '-' : '-',
      },
      { label: 'Pay To', value: textOrNA(project.paidTo) },
      { label: 'Invoice', value: invoiceValue },
    ] satisfies Array<{ label: string; value: ReactNode }>
  }, [project])

  const rawPresenter = textOrNA(project.presenterWorkType)
  const presenterText = rawPresenter === 'N/A' ? rawPresenter : `${rawPresenter} -`

  return (
    <Stack spacing={1.2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
      >
        <Stack spacing={0.5} sx={{ width: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" color="text.secondary">
              {project.projectNumber}
            </Typography>
            {onEdit && (
              <IconButton onClick={onEdit} aria-label="Edit project" size="small">
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Typography variant="subtitle1" sx={{ color: 'text.primary' }}>
            {presenterText}
          </Typography>
          <Typography variant="h4" sx={{ fontFamily: 'Cantata One', lineHeight: 1.2 }}>
            {textOrNA(project.projectTitle)}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {textOrNA(project.projectNature)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {project.subsidiary && (
            <Chip label={textOrNA(project.subsidiary)} variant="outlined" size="small" />
          )}
          {headerActions}
          {onClose && (
            <IconButton onClick={onClose} aria-label="close project details" size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Stack>

      <Divider />

      <Stack spacing={1.2}>
        {detailItems.map(({ label, value }) => (
          <Box key={label}>
            <Typography sx={labelSx}>{label}:</Typography>
            <Typography component="div" sx={valueSx} className={cormorantSemi.className}>
              {value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  )
}
