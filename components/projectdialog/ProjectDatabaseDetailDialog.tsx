// components/projectdialog/ProjectDatabaseDetailDialog.tsx

import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'

import type { ProjectRecord } from '../../lib/projectsDatabase'

interface ProjectDatabaseDetailDialogProps {
  open: boolean
  onClose: () => void
  project: ProjectRecord | null
}

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

export default function ProjectDatabaseDetailDialog({
  open,
  onClose,
  project,
}: ProjectDatabaseDetailDialogProps) {
  if (!project) {
    return null
  }

  const paid = project.paid === true
  const paidOnText = paid ? project.onDateDisplay || '-' : undefined

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1">
          {textOrNA(project.projectNumber)}
        </Typography>
        <Typography variant="subtitle1">
          {textOrNA(project.clientCompany)}
        </Typography>
        <Typography variant="h4">{textOrNA(project.projectTitle)}</Typography>
        <Typography variant="body2"> - {textOrNA(project.projectNature)}</Typography>
        <Divider />
        <Typography variant="body2">
          <strong>Project Pickup Date:</strong>{' '}
          {project.projectDateDisplay ?? 'Not set'}
        </Typography>
        <Typography variant="body2">
          <strong>Amount:</strong> {formatAmount(project.amount)}
        </Typography>
        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <strong>Paid:</strong>
          <Checkbox
            checked={paid}
            icon={<CloseIcon />}
            checkedIcon={<CheckIcon />}
            disableRipple
            sx={{ p: 0 }}
            disabled
          />
        </Typography>
        {paidOnText && (
          <Typography variant="body2">
            <strong>Paid On:</strong> {paidOnText}
          </Typography>
        )}
        {project.paidTo && (
          <Typography variant="body2">
            <strong>Pay to:</strong> {textOrNA(project.paidTo)}
          </Typography>
        )}
        {project.presenterWorkType && (
          <Typography variant="body2">
            <strong>Presenter Work Type:</strong> {textOrNA(project.presenterWorkType)}
          </Typography>
        )}
        {project.subsidiary && (
          <Typography variant="body2">
            <strong>Subsidiary:</strong> {textOrNA(project.subsidiary)}
          </Typography>
        )}
        <Divider />
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2">
            <strong>Invoice:</strong> {textOrNA(project.invoice)}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

