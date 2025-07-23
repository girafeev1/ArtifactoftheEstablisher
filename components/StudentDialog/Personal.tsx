// components/StudentDialog/Personal.tsx

import React, { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '../../lib/firebase'
import { Box, Typography, CircularProgress } from '@mui/material'

interface Props {
  abbr: string
  serviceMode: boolean
}

// Stubbed interface matching your spec
interface PersonalInfo {
  firstName?: string
  lastName?: string
  sex?: string
  birthDate?: any
  age?: number
  occupation?: string
  address1?: string
  address2?: string
  address3?: string
  address4?: string
}

export default function Personal({ abbr, serviceMode }: Props) {
  const [info, setInfo] = useState<PersonalInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { setLoading(false); return }
      getDoc(doc(db, 'Students', abbr))
        .then((snap) => {
          if (mounted && snap.exists()) {
            const d = snap.data() as any
            setInfo({
              firstName:  d.firstName,
              lastName:   d.lastName,
              sex:        d.sex,
              birthDate:  d.birthDate,
              age:        d.age,
              occupation: d.occupation,
              address1:   d.addressLine1,
              address2:   d.addressLine2,
              address3:   d.addressLine3,
              address4:   d.addressLine4,
            })
          }
        })
        .catch(console.error)
        .finally(() => mounted && setLoading(false))
    })

    return () => { mounted = false; unsub() }
  }, [abbr])

  if (loading) {
    return <Box textAlign="center" py={4}><CircularProgress /></Box>
  }
  if (!info) {
    return <Typography>No personal info available.</Typography>
  }

  return (
    <Box>
      <Typography><strong>First Name:</strong> {info.firstName ?? '–'}</Typography>
      <Typography><strong>Last Name:</strong> {info.lastName ?? '–'}</Typography>
      <Typography><strong>Sex:</strong> {info.sex ?? '–'}</Typography>
      <Typography>
        <strong>Birth Date:</strong>{' '}
        {info.birthDate?.toDate
          ? info.birthDate.toDate().toLocaleDateString()
          : '–'}
      </Typography>
      <Typography><strong>Age:</strong> {info.age ?? '–'}</Typography>
      <Typography><strong>Occupation:</strong> {info.occupation ?? '–'}</Typography>
      <Typography><strong>Address 1:</strong> {info.address1 ?? '–'}</Typography>
      <Typography><strong>Address 2:</strong> {info.address2 ?? '–'}</Typography>
      <Typography><strong>Address 3:</strong> {info.address3 ?? '–'}</Typography>
      <Typography><strong>Address 4:</strong> {info.address4 ?? '–'}</Typography>
      {serviceMode && (
        <Typography color="secondary" sx={{ mt: 1 }}>
          Service Mode ON
        </Typography>
      )}
    </Box>
  )
}
