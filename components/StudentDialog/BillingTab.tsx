// components/StudentDialog/BillingTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'
import InlineEdit from '../../common/InlineEdit'

const LABELS: Record<string, string> = {
  billingCompany: 'Billing Company',
  defaultBillingType: 'Default Billing Type',
  baseRate: 'Base Rate',
  retainerStatus: 'Retainer Status',
  lastPaymentDate: 'Last Payment Date',
  balanceDue: 'Balance Due',
  voucherBalance: 'Voucher Balance',
}

export default function BillingTab({
  billing,
  serviceMode,
}: {
  billing: any
  serviceMode: boolean
}) {
  return (
    <Box>
      {Object.entries(billing)
        .filter(([k]) => k !== 'abbr')
        .map(([k, v]) => (
          <Box key={k} mb={2}>
            <Typography variant="subtitle1">{LABELS[k]}</Typography>
            <InlineEdit
              value={v != null ? v : '-'}
              fieldPath={`Students/${billing.abbr}/${k}`}
              editable={!['balanceDue', 'voucherBalance'].includes(k)}
              serviceMode={serviceMode}
              type={
                k.includes('Date')
                  ? 'date'
                  : k === 'baseRate'
                  ? 'number'
                  : 'text'
              }
            />
          </Box>
        ))}
    </Box>
  )
}
