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
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMemo, useState } from 'react'

interface CompanyBankAccountsDatabasePageProps {
  accounts: BankAccountDirectoryRecord[]
}

const renderDetail = (label: string, value: string | null) => (
  <Typography variant='body2' sx={{ mt: 0.5 }}>
    <strong>{label}:</strong> {value ?? 'N/A'}
  </Typography>
)

export default function CompanyBankAccountsDatabasePage({
  accounts,
}: CompanyBankAccountsDatabasePageProps) {
  const [query, setQuery] = useState('')

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase()

    const filtered = trimmed
      ? accounts.filter((account) =>
          [
            account.bankName,
            account.bankCode,
            account.accountId,
            account.accountType,
            account.accountNumber,
            account.fpsId,
            account.fpsEmail,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(trimmed))
        )
      : accounts

    return filtered.reduce((acc, account) => {
      const key = `${account.bankName}__${account.bankCode ?? 'unknown'}`
      if (!acc[key]) {
        acc[key] = { bankName: account.bankName, bankCode: account.bankCode, entries: [] as typeof filtered }
      }
      acc[key].entries.push(account)
      return acc
    }, {} as Record<string, { bankName: string; bankCode: string | null; entries: BankAccountDirectoryRecord[] }>)
  }, [accounts, query])

  const keys = useMemo(() => Object.keys(filteredGroups).sort(), [filteredGroups])

  return (
    <SidebarLayout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant='h4'>Company Bank Accounts (Database)</Typography>
          <Typography variant='subtitle1' color='text.secondary'>
            Establish Records Limited directory
          </Typography>
        </Box>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search bank, account number, or FPS details'
          size='small'
          sx={{ width: { xs: '100%', sm: 320 } }}
        />
      </Box>

      {keys.length === 0 ? (
        <Typography>No bank accounts found.</Typography>
      ) : (
        <Grid container spacing={2}>
          {keys.map((key) => {
            const group = filteredGroups[key]
            return (
              <Grid item xs={12} key={key}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                      <Typography variant='h6' sx={{ fontFamily: 'Cantata One' }}>
                        {group.bankName}
                      </Typography>
                      {group.bankCode && <Chip size='small' label={`Bank Code ${group.bankCode}`} />}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {group.entries.map((entry) => (
                      <Box key={entry.accountId} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant='subtitle1' sx={{ fontFamily: 'Newsreader', fontWeight: 500 }}>
                          Account: {entry.accountId}
                        </Typography>
                        {renderDetail('Account Type', entry.accountType)}
                        {renderDetail('Account Number', entry.accountNumber)}
                        {renderDetail('FPS ID', entry.fpsId)}
                        {renderDetail('FPS Email', entry.fpsEmail)}
                        <Typography variant='body2' sx={{ mt: 0.5 }}>
                          <strong>Status:</strong> {entry.status === null ? 'Unknown' : entry.status ? 'Active' : 'Inactive'}
                        </Typography>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )
          })}
        </Grid>
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
