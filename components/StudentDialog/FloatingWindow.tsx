import React from 'react'
import { Rnd } from 'react-rnd'
import { Box, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface FloatingWindowProps {
  title?: string
  children: React.ReactNode
  onClose: () => void
}

// FloatingWindow renders detachable content using react-rnd. On small screens
// (<600px) it falls back to a full-screen overlay without drag/resize.
export default function FloatingWindow({ title, children, onClose }: FloatingWindowProps) {
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
          p: 1,
          maxHeight: '100%',
          maxWidth: '100%',
          overflow: 'auto',
        }}
      >
        <IconButton onClick={onClose} sx={{ float: 'right' }} aria-label="close window">
          <CloseIcon />
        </IconButton>
        {title && (
          <Typography variant="h6" sx={{ mb: 1 }}>
            {title}
          </Typography>
        )}
        {children}
      </Box>
    )
  }

  return (
    <Rnd
      default={{ x: 80, y: 80, width: 900, height: 600 }}
      minWidth={300}
      minHeight={200}
      bounds="window"
      style={{ zIndex: 1500 }}
    >
      <Box
        sx={{
          p: 1,
          bgcolor: 'background.paper',
          height: '100%',
          width: '100%',
          boxShadow: 3,
          maxHeight: '100%',
          maxWidth: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <IconButton onClick={onClose} sx={{ float: 'right' }} aria-label="close window">
          <CloseIcon />
        </IconButton>
        {title && (
          <Typography variant="h6" sx={{ mb: 1 }}>
            {title}
          </Typography>
        )}
        {children}
      </Box>
    </Rnd>
  )
}
