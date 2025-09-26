import type { ReactNode } from 'react'

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

import { ProjectRecord } from '../../lib/projectsDatabase'

const titleSx = { fontFamily: 'Cantata One' }
const labelSx = { fontFamily: 'Newsreader', fontWeight: 200 }
const valueSx = { fontFamily: 'Newsreader', fontWeight: 500 }

interface ProjectsDatabaseDialogProps {
  open: boolean
  onClose: () => void
  project: ProjectRecord
}

const normalizeText = (value: string | null | undefined) =>
  value && value.trim().length > 0 ? value.trim() : 'N/A'

const formatAmount = (value: number | null) => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return `HK$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const formatPaid = (value: boolean | null) => {
  if (value === null) {
    return 'N/A'
  }
  return value ? 'Paid' : 'Unpaid'
}

const formatPaidOn = (paid: boolean | null, date: string | null) => {
  if (!paid) {
    return '-'
  }
  return date && date.trim().length > 0 ? date : '-'
}

const formatInvoice = (invoice: string | null, invoiceUrl: string | null): ReactNode => {
  if (invoiceUrl) {
    const label = invoice && invoice.trim().length > 0 ? invoice : invoiceUrl
    return (
      <Typography
        sx={valueSx}
        component="a"
        href={invoiceUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </Typography>
    )
  }

  return normalizeText(invoice)
}

interface FieldProps {
  label: string
  value: ReactNode
}

const Field = ({ label, value }: FieldProps) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={labelSx}>{label}:</Typography>
    {typeof value === 'string' ? <Typography sx={valueSx}>{value}</Typography> : value}
  </Box>
)

export default function ProjectsDatabaseDialog({
  open,
  onClose,
  project,
}: ProjectsDatabaseDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={titleSx}>{project.projectTitle || 'Project Details'}</DialogTitle>
      <DialogContent dividers>
        <Field label="Project Number" value={normalizeText(project.projectNumber)} />
        <Field label="Client Company" value={normalizeText(project.clientCompany)} />
        <Field label="Subsidiary" value={normalizeText(project.subsidiary)} />
        <Field label="Project Nature" value={normalizeText(project.projectNature)} />
        <Field label="Presenter / Work Type" value={normalizeText(project.presenterWorkType)} />
        <Field label="Project Date" value={project.projectDateDisplay ?? '-'} />
        <Field label="Amount" value={formatAmount(project.amount)} />
        <Field label="Paid Status" value={formatPaid(project.paid)} />
        <Field label="Paid On" value={formatPaidOn(project.paid, project.onDateDisplay)} />
        <Field label="Paid To" value={normalizeText(project.paidTo)} />
        <Field label="Invoice Number" value={normalizeText(project.invoice)} />
        <Field
          label="Invoice"
          value={formatInvoice(project.invoice, project.invoiceUrl)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

