// components/StudentDialog/Overview.tsx

import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Box, Typography, CircularProgress } from '@mui/material'

interface Props {
  abbr: string
  serviceMode: boolean
}

export default function Overview({ abbr, serviceMode }: Props) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    console.log('[Overview] fetching', abbr)
    getDoc(doc(db, 'Students', abbr))
      .then(snap => {
        if (mounted && snap.exists()) {
          console.log('[Overview] data', snap.data())
          setData(snap.data())
        }
      })
      .catch(err => console.error('[Overview] error', err))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [abbr])

  if (loading) {
    return <Box textAlign="center" py={4}><CircularProgress /></Box>
  }
  if (!data) {
    return <Typography>No overview available.</Typography>
  }

  return (
    <Box>
      <Typography variant="h6">{data.account}</Typography>
      <Typography>
        Last Update:{' '}
        {data.lastUpdate?.toDate().toLocaleString() ?? 'Unknown'}
      </Typography>
      {serviceMode && (
        <Typography color="secondary">Service Mode ON</Typography>
      )}
    </Box>
  )
}
