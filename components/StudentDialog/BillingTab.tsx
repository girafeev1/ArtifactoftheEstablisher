// components/StudentDialog/BillingTab.tsx

import React from 'react'
import { Box, Typography } from '@mui/material'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(
    n,
  )
import InlineEdit from '../../common/InlineEdit'

const FIELD_KEYS = [
  'baseRate',
  'retainerStatus',
  'lastPaymentDate',
  'defaultBillingType',
  'billingCompany',
  'balanceDue',
  'voucherBalance',
] as const

type FieldKey = (typeof FIELD_KEYS)[number]

const LABELS: Record<FieldKey, string> = {
  baseRate: 'Base Rate',
  retainerStatus: 'Retainer Status',
  lastPaymentDate: 'Last Payment',
  defaultBillingType: 'Default Billing Type',
  billingCompany: 'Billing Company Info',
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
      {FIELD_KEYS.map((k) => {
        const v = billing[k]
        const path =
          k === 'defaultBillingType'
            ? `Students/${abbr}/billingType`
            : `Students/${abbr}/${k}`
        return (
          <Box key={k} mb={2}>
            <Typography variant="subtitle1">{LABELS[k]}</Typography>
            {k === 'baseRate' ? (
              <Typography>{v != null ? formatCurrency(Number(v)) : '-'}</Typography>
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
      })}
    </Box>
  )
}
