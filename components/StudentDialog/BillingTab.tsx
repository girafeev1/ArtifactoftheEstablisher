// components/StudentDialog/BillingTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    n,
  )
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
  abbr,
  billing,
  serviceMode,
}: {
  abbr: string
  billing: any
  serviceMode: boolean
}) {
  return (
    <Box>
      {Object.entries(billing)
        .filter(([k]) => k !== 'abbr')
        .map(([k, v]) => {
          const path =
            k === 'defaultBillingType'
              ? `Students/${abbr}/billingType`
              : `Students/${abbr}/${k}`
          return (
            <Box key={k} mb={2}>
              <Typography variant="subtitle1">{LABELS[k]}</Typography>
              {k === 'baseRate' ? (
                <Typography>{
                  v != null ? formatCurrency(Number(v)) : '-'
                }</Typography>
              ) : (
                <InlineEdit
                  value={v}
                  fieldPath={path}
                  fieldKey={k}
                  editable={
                    !['balanceDue', 'voucherBalance'].includes(k) &&
                    (v === undefined || v === '')
                  }
                  serviceMode={serviceMode}
                  type={k.includes('Date') ? 'date' : 'text'}
                />
              )}
            </Box>
          )
        })}
    </Box>
  )
}
