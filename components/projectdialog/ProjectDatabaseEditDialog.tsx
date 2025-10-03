import { useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import type { ProjectRecord } from '../../lib/projectsDatabase'
import { sanitizeText, toDateInputValue, toIsoUtcStringOrNull } from './projectFormUtils'

interface ProjectDatabaseEditDialogProps {
  open: boolean
  project: ProjectRecord | null
  onClose: () => void
  onSaved: () => void
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

export default function ProjectDatabaseEditDialog({
  open,
  project,
  onClose,
  onSaved,
}: ProjectDatabaseEditDialogProps) {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project) {
      setForm(null)
      return
    }

    setForm({
      projectNumber: project.projectNumber ?? '',
      projectTitle: project.projectTitle ?? '',
      projectNature: project.projectNature ?? '',
      clientCompany: project.clientCompany ?? '',
      amount:
        project.amount !== null && project.amount !== undefined
          ? String(project.amount)
          : '',
      paid: Boolean(project.paid),
      paidTo: project.paidTo ?? '',
      invoice: project.invoice ?? '',
      presenterWorkType: project.presenterWorkType ?? '',
      subsidiary: project.subsidiary ?? '',
      projectDate: toDateInputValue(project.projectDateIso),
      onDate: toDateInputValue(project.onDateIso),
    })
    setError(null)
  }, [project])

  const disabled = useMemo(() => saving || !form || !project, [saving, form, project])

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!form) return
      setForm({ ...form, [field]: event.target.value })
    }

  const handleTogglePaid = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    if (!form) return
    setForm({ ...form, paid: checked })
  }

  const handleSubmit = async () => {
    if (!project || !form) return

    setSaving(true)
    setError(null)

    const amountValue = form.amount.trim()
    const parsedAmount = amountValue.length > 0 ? Number(amountValue) : null
    if (amountValue.length > 0 && Number.isNaN(parsedAmount)) {
      setError('Amount must be a number')
      setSaving(false)
      return
    }

    const updates: Record<string, unknown> = {
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
      updates.amount = null
    } else if (parsedAmount !== null) {
      updates.amount = parsedAmount
    }

    updates.projectDate = toIsoUtcStringOrNull(form.projectDate)
    updates.onDate = toIsoUtcStringOrNull(form.onDate)

    try {
      const response = await fetch(
        `/api/projects-database/${encodeURIComponent(project.year)}/${encodeURIComponent(project.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to update project')
      }

      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update project'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (!project || !form) {
    return null
  }

  return (
    <Dialog open={open} onClose={disabled ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {project.projectNumber} — {project.projectTitle ?? 'Untitled'}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Project Number"
              value={form.projectNumber}
              onChange={handleChange('projectNumber')}
              fullWidth
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
              label="Project Date"
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
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Amount (HKD)"
              value={form.amount}
              onChange={handleChange('amount')}
              fullWidth
              inputMode="decimal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Paid To"
              value={form.paidTo}
              onChange={handleChange('paidTo')}
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
              label="Presenter Work Type"
              value={form.presenterWorkType}
              onChange={handleChange('presenterWorkType')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Subsidiary"
              value={form.subsidiary}
              onChange={handleChange('subsidiary')}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={<Switch checked={form.paid} onChange={handleTogglePaid} />}
                label="Paid"
              />
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={disabled}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={disabled}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
