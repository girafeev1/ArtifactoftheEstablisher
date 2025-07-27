// components/StudentDialog/PersonalTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'
import InlineEdit from '../../common/InlineEdit'

const LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  sex: 'Sex',
  birthDate: 'Birth Date',
}

export default function PersonalTab({
  personal,
  serviceMode,
}: {
  personal: any
  serviceMode: boolean
}) {
  return (
    <Box>
      {Object.entries(personal)
        .filter(([k]) => k !== 'abbr')
        .map(([k, v]) => {
          const path =
            k === 'firstName' || k === 'lastName'
              ? `Students/${personal.abbr}/legalName`
              : `Students/${personal.abbr}/${k}`
          return (
            <Box key={k} mb={2}>
              <Typography variant="subtitle1">{LABELS[k]}</Typography>
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
    </Box>
  )
}
