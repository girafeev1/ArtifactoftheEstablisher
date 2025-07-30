// components/StudentDialog/PersonalTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'
import InlineEdit from '../../common/InlineEdit'

const LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  sex: 'Gender',
  birthDate: 'Birth Date',
}

export default function PersonalTab({
  abbr,
  personal,
  jointDate,
  totalSessions,
  serviceMode,
}: {
  abbr: string
  personal: any
  jointDate?: string
  totalSessions?: number
  serviceMode: boolean
}) {
  return (
    <Box>
      {Object.entries(personal)
        .filter(([k]) => k !== 'abbr')
        .map(([k, v]) => {
          const path = `Students/${abbr}/${k}`
          return (
            <Box key={k} mb={2}>
              <Typography variant="subtitle2">{LABELS[k]}</Typography>
              <InlineEdit
                value={v}
                fieldPath={path}
                fieldKey={k}
                editable // always editable
                serviceMode={serviceMode}
                type={k === 'sex' ? 'select' : k === 'birthDate' ? 'date' : 'text'}
                options={k === 'sex' ? ['Male', 'Female', 'Other'] : undefined}
              />
            </Box>
          )
        })}
      <Box mb={2}>
        <Typography variant="subtitle2">Joint Date</Typography>
        <Typography variant="h6">{jointDate ?? '–'}</Typography>
      </Box>
      <Box mb={2}>
        <Typography variant="subtitle2">Total Sessions</Typography>
        <Typography variant="h6">{totalSessions ?? '–'}</Typography>
      </Box>
    </Box>
  )
}
