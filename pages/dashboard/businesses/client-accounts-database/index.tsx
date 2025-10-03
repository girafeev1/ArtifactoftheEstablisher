// pages/dashboard/businesses/client-accounts-database/index.tsx

import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

import SidebarLayout from '../../../../components/SidebarLayout'
import { fetchClientsDirectory, ClientDirectoryRecord } from '../../../../lib/clientDirectory'

import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'

interface ClientAccountsDatabasePageProps {
  clients: ClientDirectoryRecord[]
}

const renderLine = (label: string, value: string | null) => (
  <Typography variant='body2' sx={{ mt: 0.5 }}>
    <strong>{label}:</strong> {value ?? 'N/A'}
  </Typography>
)

export default function ClientAccountsDatabasePage({
  clients,
}: ClientAccountsDatabasePageProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) {
      return clients
    }
    return clients.filter((client) =>
      [
        client.companyName,
        client.name,
        client.email,
        client.addressLine1,
        client.addressLine2,
        client.addressLine3,
        client.addressLine4,
        client.addressLine5,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(trimmed))
    )
  }, [clients, query])

  return (
    <SidebarLayout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant='h4'>Client Accounts (Database)</Typography>
          <Typography variant='subtitle1' color='text.secondary'>
            Establish Productions Limited directory
          </Typography>
        </Box>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search clients by name, email, or address'
          size='small'
          sx={{ width: { xs: '100%', sm: 320 } }}
        />
      </Box>

      {filtered.length === 0 ? (
        <Typography>No client entries found.</Typography>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((client) => (
            <Grid item xs={12} md={6} lg={4} key={client.companyName}>
              <Card variant='outlined' sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Typography variant='h6' sx={{ fontFamily: 'Cantata One' }}>
                      {client.companyName}
                    </Typography>
                    {client.region && <Chip size='small' label={client.region} />}
                  </Box>
                  {client.title || client.name ? (
                    renderLine('Contact', [client.title, client.name].filter(Boolean).join(' ') || null)
                  ) : null}
                  {renderLine('Email', client.email)}
                  {renderLine('Phone', client.phone)}
                  {renderLine('Address 1', client.addressLine1)}
                  {renderLine('Address 2', client.addressLine2)}
                  {renderLine('Address 3', client.addressLine3)}
                  {renderLine('Address 4', client.addressLine4)}
                  {renderLine('Address 5', client.addressLine5)}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </SidebarLayout>
  )
}

export const getServerSideProps: GetServerSideProps<ClientAccountsDatabasePageProps> = async (
  ctx
) => {
  const session = await getSession(ctx)
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin', permanent: false },
    }
  }

  try {
    const clients = await fetchClientsDirectory()
    return {
      props: {
        clients,
      },
    }
  } catch (err) {
    console.error('[client-accounts-database] Failed to load clients:', err)
    return {
      props: {
        clients: [],
      },
    }
  }
}
