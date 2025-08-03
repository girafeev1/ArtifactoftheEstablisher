import React from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import { Box, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface FloatingWindowProps {
  title?: string
  children: React.ReactNode
  onClose: () => void
  actions?: React.ReactNode | null
}

// FloatingWindow renders detachable content using react-rnd. On small screens
// (<600px) it falls back to a full-screen overlay without drag/resize.
export default function FloatingWindow({ title, children, onClose, actions }: FloatingWindowProps) {
  const body =
    typeof document !== 'undefined' ? document.body : undefined

  const content = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 600) {
      return (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'background.paper',
            zIndex: 1500,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1 }}>
            {title && <Typography variant="h6">{title}</Typography>}
            <Box>
              {actions}
              <IconButton onClick={onClose} aria-label="close window">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>{children}</Box>
        </Box>
      )
    }

    const HANDLE_CLASS = 'floating-window-handle'
    return (
      <Rnd
        default={{ x: 120, y: 80, width: 900, height: 600 }}
        minWidth={300}
        minHeight={200}
        bounds="window"
        style={{ zIndex: 1500 }}
        dragHandleClassName={HANDLE_CLASS}
      >
        <Box
          sx={{
            bgcolor: 'background.paper',
            height: '100%',
            width: '100%',
            boxShadow: 3,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            className={HANDLE_CLASS}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
              cursor: 'move',
            }}
          >
            {title && <Typography variant="h6">{title}</Typography>}
            <Box>
              {actions}
              <IconButton onClick={onClose} aria-label="close window">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>{children}</Box>
        </Box>
      </Rnd>
    )
  }

  const node = content()
  return body ? createPortal(node, body) : node
}
