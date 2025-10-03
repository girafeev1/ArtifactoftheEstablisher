import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd, type RndDragCallback, type RndResizeCallback } from 'react-rnd'
import { Backdrop, Box, Fade, useMediaQuery, useTheme } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

interface ProjectDatabaseWindowProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  minWidth?: number
  minHeight?: number
  contentSx?: SxProps<Theme>
  smallScreenContentSx?: SxProps<Theme>
}

const MIN_WIDTH_DEFAULT = 400
const MIN_HEIGHT_DEFAULT = 200

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export default function ProjectDatabaseWindow({
  open,
  onClose,
  children,
  minWidth = MIN_WIDTH_DEFAULT,
  minHeight = MIN_HEIGHT_DEFAULT,
  contentSx,
  smallScreenContentSx,
}: ProjectDatabaseWindowProps) {
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [mounted, setMounted] = useState(false)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [needsMeasurement, setNeedsMeasurement] = useState(false)
  const [size, setSize] = useState<{ width: number; height: number }>(() => ({
    width: 560,
    height: 480,
  }))
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: 80,
    y: 80,
  }))

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
      minWidth,
      Math.max(minWidth, viewportWidth - 48)
    )
    const height = clamp(
      measuredHeight,
      minHeight,
      Math.max(minHeight, viewportHeight - 48)
    )

    const x = Math.max(24, Math.round((viewportWidth - width) / 2))
    const y = Math.max(32, Math.round((viewportHeight - height) / 2))

    setSize({ width, height })
    setPosition({ x, y })
    setNeedsMeasurement(false)
  }, [open, needsMeasurement, isSmallScreen, minWidth, minHeight])

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

  if (!open || !portalTarget) {
    return null
  }

  if (isSmallScreen) {
    const baseSmallScreenSx = {
      flexGrow: 1,
      overflow: 'auto',
      p: 2,
      bgcolor: 'background.paper',
    }

    const mergedSmallScreenSx = Array.isArray(smallScreenContentSx)
      ? [baseSmallScreenSx, ...smallScreenContentSx]
      : smallScreenContentSx
      ? [baseSmallScreenSx, smallScreenContentSx]
      : [baseSmallScreenSx]

    return createPortal(
      <Fade in={open} appear unmountOnExit>
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(15, 23, 42, 0.78)',
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(2px)',
          }}
          onClick={onClose}
        >
          <Box
            ref={contentRef}
            sx={mergedSmallScreenSx as SxProps<Theme>}
            onClick={(event) => event.stopPropagation()}
          >
            {children}
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
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <Rnd
          size={size}
          position={position}
          bounds='window'
          minWidth={minWidth}
          minHeight={minHeight}
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
            onClick={(event) => event.stopPropagation()}
          >
            <Box
              ref={contentRef}
              sx={(() => {
                const baseContentSx = {
                  flexGrow: 1,
                  overflow: 'auto',
                  p: { xs: 2, sm: 3 },
                }

                const mergedContentSx = Array.isArray(contentSx)
                  ? [baseContentSx, ...contentSx]
                  : contentSx
                  ? [baseContentSx, contentSx]
                  : [baseContentSx]

                return mergedContentSx as SxProps<Theme>
              })()}
            >
              {children}
            </Box>
          </Box>
        </Rnd>
      </Box>
    </Fade>,
    portalTarget
  )
}
