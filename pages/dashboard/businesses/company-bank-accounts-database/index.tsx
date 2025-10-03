// pages/dashboard/businesses/company-bank-accounts-database/index.tsx

import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

import SidebarLayout from '../../../../components/SidebarLayout'
import {
  BankAccountDirectoryRecord,
  fetchBankAccountsDirectory,
} from '../../../../lib/bankAccountsDirectory'

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMemo } from 'react'
import { useRouter } from 'next/router'

const formatBankName = (name: string) =>
  name.split(/(-|\s+)/).map((segment, index) => {
    if (segment === '-') {
      return (
        <span key={`hyphen-${index}`} className='federo-text' style={{ margin: '0 6px' }}>
          -
        </span>
      )
    }
    if (segment.trim().length === 0) {
      return (
        <span key={`space-${index}`} className='federo-text'>
          {segment}
        </span>
      )
    }
    return (
      <span key={`word-${index}`} className='federo-text' style={{ marginRight: 6 }}>
        {segment.split('').map((char, charIndex) => (
          <span key={`char-${index}-${charIndex}`} style={charIndex === 0 ? { fontWeight: 700 } : undefined}>
            {char}
          </span>
        ))}
      </span>
    )
  });


interface CompanyBankAccountsDatabasePageProps {
  accounts: BankAccountDirectoryRecord[]
}

export default function CompanyBankAccountsDatabasePage({
  accounts,
}: CompanyBankAccountsDatabasePageProps) {
  const router = useRouter()

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        bankName: string
        bankCode: string | null
        entries: BankAccountDirectoryRecord[]
        active: boolean
      }
    >()

    accounts.forEach((account) => {
      const key = `${account.bankName}__${account.bankCode ?? 'unknown'}`
      if (!map.has(key)) {
        map.set(key, {
          bankName: account.bankName,
          bankCode: account.bankCode,
          entries: [],
          active: false,
        })
      }
      const bucket = map.get(key)!
      bucket.entries.push(account)
      if (account.status === true) {
        bucket.active = true
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1
      }
      const codeA = a.bankCode ? Number(a.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
      const codeB = b.bankCode ? Number(b.bankCode.replace(/[^0-9]/g, '')) : Number.POSITIVE_INFINITY
      if (codeA !== codeB) {
        return codeA - codeB
      }
      return a.bankName.localeCompare(b.bankName)
    })
  }, [accounts])

  const getStatusChip = (active: boolean | null) => {
    if (active === null) {
      return null
    }
    return (
      <Chip
        size='small'
        label={active ? 'Active' : 'Inactive'}
        sx={{
          bgcolor: active ? 'rgba(76, 175, 80, 0.18)' : 'rgba(244, 67, 54, 0.18)',
          color: active ? 'success.main' : 'error.main',
          border: '1px solid',
          borderColor: active ? 'success.light' : 'error.light',
        }}
      />
    )
  }

  return (
    <SidebarLayout>
      <Typography variant='h4' gutterBottom>
        Company Bank Accounts (Database)
      </Typography>
      <ToggleButtonGroup
        exclusive
        value='bank'
        onChange={(event, value) => {
          if (value === 'clients') {
            router.push('/dashboard/businesses/client-accounts-database', undefined, { shallow: true })
          }
        }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value='clients'>Client Accounts</ToggleButton>
        <ToggleButton value='bank'>Company Bank Accounts</ToggleButton>
      </ToggleButtonGroup>
      {grouped.length === 0 ? (
        <Typography>No bank accounts found.</Typography>
      ) : (
        grouped.map((group) => (
          <Accordion key={`${group.bankName}-${group.bankCode ?? 'unknown'}`} sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography
                  variant='h5'
                  component='div'
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                >
                  {formatBankName(group.bankName)}
                  {group.bankCode && (
                    <Typography
                      variant='h6'
                      component='span'
                      color='text.secondary'
                      sx={{ fontSize: '0.7em' }}
                    >
                      {group.bankCode}
                    </Typography>
                  )}
                </Typography>
                {getStatusChip(group.active)}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {group.entries
                .slice()
                .sort((a, b) => {
                  if (a.status !== b.status) {
                    return (b.status ? 1 : 0) - (a.status ? 1 : 0)
                  }
                  return a.accountId.localeCompare(b.accountId)
                })
                .map((entry) => (
                  <Box
                    key={entry.accountId}
                    sx={{
                      mb: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    <Typography variant='h6'>
                      {entry.accountType ? `${entry.accountType} Account` : 'Account'}
                    </Typography>
                    <Typography variant='body1'>
                      {entry.accountNumber ?? 'Account number unavailable'}
                    </Typography>
                    <Typography variant='body2'>FPS ID: {entry.fpsId ?? 'N/A'}</Typography>
                    <Typography variant='body2'>FPS Email: {entry.fpsEmail ?? 'N/A'}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <Chip label={entry.accountId} size='small' variant='outlined' />
                    </Box>
                  </Box>
                ))}
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </SidebarLayout>
  )
}

export const getServerSideProps: GetServerSideProps<CompanyBankAccountsDatabasePageProps> = async (
  ctx
) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin', permanent: false },
    }
  }

  try {
    const accounts = await fetchBankAccountsDirectory()
    return {
      props: {
        accounts,
      },
    }
  } catch (err) {
    console.error('[company-bank-accounts-database] Failed to load bank accounts:', err)
    return {
      props: {
        accounts: [],
      },
    }
  }
}
