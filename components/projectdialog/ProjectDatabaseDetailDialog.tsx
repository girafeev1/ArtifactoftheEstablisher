import type { ReactNode } from 'react'

import type { ProjectRecord } from '../../lib/projectsDatabase'
import ProjectDatabaseDetailContent from './ProjectDatabaseDetailContent'
import ProjectDatabaseWindow from './ProjectDatabaseWindow'

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
  if (!project || !open) {
    return null
  }

  return (
    <ProjectDatabaseWindow open={open} onClose={onClose}>
      <ProjectDatabaseDetailContent
        project={project}
        headerActions={headerActions}
        onClose={onClose}
        onEdit={onEdit}
      />
    </ProjectDatabaseWindow>
  )
}
