// components/StudentDialog/BillingTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    n,
  )
import InlineEdit from '../../common/InlineEdit'

const LABELS: Record<string, string> = {
  billingCompany: 'Billing Company Info',
  defaultBillingType: 'Default Billing Type',
  baseRate: 'Base Rate',
  retainerStatus: 'Retainer Status',
  lastPaymentDate: 'Last Payment',
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
  const renderField = (k: string) => {
    const v = billing[k]
    const path =
      k === 'defaultBillingType'
        ? `Students/${abbr}/billingType`
        : `Students/${abbr}/${k}`
    return (
      <Box key={k} mb={2}>
        <Typography variant="subtitle2">{LABELS[k]}</Typography>
        {k === 'baseRate' ? (
          <Typography variant="h6">
            {v != null ? formatCurrency(Number(v)) : '-'}
          </Typography>
        ) : (
          <InlineEdit
            value={v}
            fieldPath={path}
            fieldKey={k}
            editable={!['balanceDue', 'voucherBalance'].includes(k)}
            serviceMode={serviceMode}
            type={k.includes('Date') ? 'date' : 'text'}
          />
        )}
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
        Billing Information
      </Typography>
      {['balanceDue', 'baseRate', 'retainerStatus', 'lastPaymentDate', 'voucherBalance'].map(renderField)}
      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
        Payment Information
      </Typography>
      {['defaultBillingType', 'billingCompany'].map(renderField)}
    </Box>
  )
}
