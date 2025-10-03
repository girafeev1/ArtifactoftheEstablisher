import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd, type RndDragCallback, type RndResizeCallback } from 'react-rnd'
import { Backdrop, Box, Fade, useMediaQuery, useTheme } from '@mui/material'

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

const MIN_WIDTH = 400
const MIN_HEIGHT = 200

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export default function ProjectDatabaseDetailDialog({
  open,
  onClose,
  project,
  onEdit,
  headerActions,
}: ProjectDatabaseDetailDialogProps) {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [mounted, setMounted] = useState(false)
  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
    width: 560,
    height: 480,
  }))
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: 80,
    y: 80,
  }))
  const [needsMeasurement, setNeedsMeasurement] = useState(true)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      setNeedsMeasurement(true)
      return () => {
        document.body.style.overflow = previous
      }
    }
    return undefined
  }, [open])

  useLayoutEffect(() => {
    if (!open || !needsMeasurement || !contentRef.current || isSmallScreen) {
      return
    }

    const node = contentRef.current
    const viewportWidth = window.innerWidth || 1024
    const viewportHeight = window.innerHeight || 768
    const horizontalPadding = 64
    const verticalPadding = 96

    const measuredWidth = node.scrollWidth + horizontalPadding
    const measuredHeight = node.scrollHeight + verticalPadding

    const width = clamp(
      measuredWidth,
      MIN_WIDTH,
      Math.max(MIN_WIDTH, viewportWidth - 48)
    )
    const height = clamp(
      measuredHeight,
      MIN_HEIGHT,
      Math.max(MIN_HEIGHT, viewportHeight - 48)
    )

    const x = Math.max(24, Math.round((viewportWidth - width) / 2))
    const y = Math.max(32, Math.round((viewportHeight - height) / 2))

    setSize({ width, height })
    setPosition({ x, y })
    setNeedsMeasurement(false)
  }, [open, needsMeasurement, isSmallScreen])

  const handleResizeStop: RndResizeCallback = (
    _event,
    _direction,
    elementRef,
    _delta,
    nextPosition
  ) => {
    const width = elementRef.offsetWidth
    const height = elementRef.offsetHeight
    setSize({ width, height })
    setPosition(nextPosition)
  }

  const handleDragStop: RndDragCallback = (_event, data) => {
    setPosition({ x: data.x, y: data.y })
  }

  const portalTarget = useMemo(() => (mounted ? document.body : null), [mounted])

  if (!project || !open || !portalTarget) {
    return null
  }

  if (isSmallScreen) {
    return createPortal(
      <Fade in={open} appear unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'background.paper',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box ref={contentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            <ProjectDatabaseDetailContent
              project={project}
              headerActions={headerActions}
              onClose={onClose}
              onEdit={onEdit}
            />
          </Box>
        </Box>
      </Fade>,
      portalTarget
    )
  }

  return createPortal(
    <Fade in={open} appear unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
        }}
      >
        <Backdrop
          open
          onClick={onClose}
          sx={{ position: 'absolute', inset: 0 }}
        />
        <Rnd
          size={size}
          position={position}
          bounds='window'
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
          onDragStop={handleDragStop}
          onResizeStop={handleResizeStop}
          enableResizing
        >
          <Box
            sx={{
              bgcolor: 'background.paper',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 6,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            <Box
              ref={contentRef}
              sx={{
                flexGrow: 1,
                overflow: 'auto',
                p: { xs: 2, sm: 3 },
              }}
            >
              <ProjectDatabaseDetailContent
                project={project}
                headerActions={headerActions}
                onClose={onClose}
                onEdit={onEdit}
              />
            </Box>
          </Box>
        </Rnd>
      </Box>
    </Fade>,
    portalTarget
  )
}
