import { Button, Dialog, DialogContent } from '@mui/material'

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

  const footerActions = [
    <Button key="close" onClick={onClose}>
      Close
    </Button>,
    ...(onEdit
      ? [
          <Button key="edit" variant="contained" onClick={onEdit}>
            Edit
          </Button>,
        ]
      : []),
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        <ProjectDatabaseDetailContent
          project={project}
          headerActions={headerActions}
          footerActions={footerActions}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
