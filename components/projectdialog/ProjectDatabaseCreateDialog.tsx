import { useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

import ProjectDatabaseWindow from './ProjectDatabaseWindow'
import type { ProjectRecord } from '../../lib/projectsDatabase'
import { sanitizeText, toIsoUtcStringOrNull } from './projectFormUtils'

interface ProjectDatabaseCreateDialogProps {
  open: boolean
  year: string | null
  onClose: () => void
  onCreated: (created?: ProjectRecord) => void
  onDetach?: () => void
}

interface ProjectDatabaseCreateFormProps {
  year: string | null
  onClose: () => void
  onCreated: (created?: ProjectRecord) => void
  onDetach?: () => void
  variant: 'dialog' | 'page'
  resetToken?: unknown
  onBusyChange?: (busy: boolean) => void
}

interface FormState {
  projectNumber: string
  projectTitle: string
  projectNature: string
  clientCompany: string
  amount: string
  paid: boolean
  paidTo: string
  invoice: string
  presenterWorkType: string
  subsidiary: string
  projectDate: string
  onDate: string
}

const EMPTY_FORM: FormState = {
  projectNumber: '',
  projectTitle: '',
  projectNature: '',
  clientCompany: '',
  amount: '',
  paid: false,
  paidTo: '',
  invoice: '',
  presenterWorkType: '',
  subsidiary: '',
  projectDate: '',
  onDate: '',
}

export function ProjectDatabaseCreateForm({
  year,
  onClose,
  onCreated,
  onDetach,
  variant,
  resetToken,
  onBusyChange,
}: ProjectDatabaseCreateFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(EMPTY_FORM)
    setError(null)
    setSaving(false)
  }, [resetToken])

  useEffect(() => {
    onBusyChange?.(saving)
  }, [saving, onBusyChange])

  const disabled = useMemo(() => saving || !year, [saving, year])

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }))
    }

  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setForm((prev) => ({ ...prev, paid: checked }))
  }

  const handleSubmit = async () => {
    if (!year) {
      setError('Select a year before creating a project')
      return
    }

    if (!form.projectNumber.trim()) {
      setError('Project number is required')
      return
    }

    setSaving(true)
    setError(null)

    const amountValue = form.amount.trim()
    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
      setError('Amount must be a number')
      setSaving(false)
      return
    }

    const payload: Record<string, unknown> = {
      projectNumber: sanitizeText(form.projectNumber),
      projectTitle: sanitizeText(form.projectTitle),
      projectNature: sanitizeText(form.projectNature),
      clientCompany: sanitizeText(form.clientCompany),
      presenterWorkType: sanitizeText(form.presenterWorkType),
      subsidiary: sanitizeText(form.subsidiary),
      invoice: sanitizeText(form.invoice),
      paidTo: sanitizeText(form.paidTo),
      paid: form.paid,
    }

    if (form.amount.trim().length === 0) {
      payload.amount = null
    } else if (parsedAmount !== null) {
      payload.amount = parsedAmount
    }

    payload.projectDate = toIsoUtcStringOrNull(form.projectDate)
    payload.onDate = toIsoUtcStringOrNull(form.onDate)

    try {
      const response = await fetch(
        `/api/projects-database/${encodeURIComponent(year)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project: payload }),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create project')
      }

      const created = (await response.json().catch(() => null)) as
        | { project?: ProjectRecord }
        | null

      onCreated(created?.project)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const headerSubtitle = year ? `Establish Productions Limited — ${year}` : 'Select a year to continue'

  const handleClose = () => {
    if (!disabled) {
      onClose()
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="h5" sx={{ fontFamily: 'Cantata One' }}>
            New Project
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">
            {headerSubtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {variant === 'dialog' && onDetach && (
            <IconButton onClick={onDetach} aria-label="Open in new window" size="small">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            onClick={variant === 'dialog' ? handleClose : onClose}
            aria-label="Close new project form"
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {year && (
        <Chip label={year} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }} />
      )}
      <Divider />
      {error && <Alert severity="error">{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Project Number"
            value={form.projectNumber}
            onChange={handleChange('projectNumber')}
            fullWidth
            required
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Client Company"
            value={form.clientCompany}
            onChange={handleChange('clientCompany')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Project Title"
            value={form.projectTitle}
            onChange={handleChange('projectTitle')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label="Project Nature"
            value={form.projectNature}
            onChange={handleChange('projectNature')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Presenter Work Type"
            value={form.presenterWorkType}
            onChange={handleChange('presenterWorkType')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Subsidiary"
            value={form.subsidiary}
            onChange={handleChange('subsidiary')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Project Pickup Date"
            type="date"
            value={form.projectDate}
            onChange={handleChange('projectDate')}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Paid On"
            type="date"
            value={form.onDate}
            onChange={handleChange('onDate')}
            fullWidth
            InputLabelProps={{ shrink: true }}
            disabled={!form.paid}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Amount"
            value={form.amount}
            onChange={handleChange('amount')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Invoice"
            value={form.invoice}
            onChange={handleChange('invoice')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Pay To"
            value={form.paidTo}
            onChange={handleChange('paidTo')}
            fullWidth
            disabled={!form.paid}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
            label="Paid"
          />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabled}
        >
          {saving ? 'Creating…' : 'Create Project'}
        </Button>
      </Box>
    </Stack>
  )
}

export default function ProjectDatabaseCreateDialog({
  open,
  year,
  onClose,
  onCreated,
  onDetach,
}: ProjectDatabaseCreateDialogProps) {
  const [busy, setBusy] = useState(false)

  if (!open) {
    return null
  }

  return (
    <ProjectDatabaseWindow
      open={open}
      onClose={busy ? () => {} : onClose}
      contentSx={{ p: { xs: 2.5, sm: 3 } }}
    >
      <ProjectDatabaseCreateForm
        year={year}
        onClose={onClose}
        onCreated={onCreated}
        onDetach={onDetach}
        variant="dialog"
        resetToken={open}
        onBusyChange={setBusy}
      />
    </ProjectDatabaseWindow>
  )
}
