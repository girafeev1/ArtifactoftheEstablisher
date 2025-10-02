import { Dialog, DialogContent } from '@mui/material'

import type { ReactNode } from 'react'

import type { ProjectRecord } from '../../lib/projectsDatabase'
import ProjectDatabaseDetailContent from './ProjectDatabaseDetailContent'

interface ProjectDatabaseDetailDialogProps {
  open: boolean
  onClose: () => void
  project: ProjectRecord | null
  onEdit?: () => void
  headerActions?: ReactNode
}

export default function ProjectDatabaseDetailDialog({
  open,
  onClose,
  project,
  onEdit,
  headerActions,
}: ProjectDatabaseDetailDialogProps) {
  if (!project) {
    return null
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <ProjectDatabaseDetailContent
          project={project}
          headerActions={headerActions}
          onClose={onClose}
          onEdit={onEdit}
        />
      </DialogContent>
    </Dialog>
  )
}
