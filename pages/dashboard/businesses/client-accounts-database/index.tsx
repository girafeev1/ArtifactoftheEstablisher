// pages/dashboard/businesses/client-accounts-database/index.tsx

import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'

import SidebarLayout from '../../../../components/SidebarLayout'
import ViewClientDialog from '../../../../components/clientdialog/ViewClientDialog'
import EditClientDialog, { type Client as EditDialogClient } from '../../../../components/clientdialog/EditClientDialog'
import NewClientDialog from '../../../../components/clientdialog/NewClientDialog'
import {
  ClientDirectoryRecord,
  fetchClientsDirectory,
} from '../../../../lib/clientDirectory'

import {
  Alert,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'

interface ClientAccountsDatabasePageProps {
  clients: ClientDirectoryRecord[]
  error?: string
}

const convertToClientDetails = (record: ClientDirectoryRecord) => ({
  companyName: record.companyName,
  title: record.title ?? '',
  nameAddressed: record.nameAddressed ?? record.name ?? '',
  emailAddress: record.emailAddress ?? '',
  addressLine1: record.addressLine1 ?? '',
  addressLine2: record.addressLine2 ?? '',
  addressLine3: record.addressLine3 ?? '',
  addressLine4: record.addressLine4 ?? '',
  addressLine5: record.region ?? record.addressLine5 ?? '',
})

const convertToEditClient = (record: ClientDirectoryRecord): EditDialogClient => ({
  companyName: record.companyName,
  title: record.title ?? 'Mr.',
  nameAddressed: record.nameAddressed ?? record.name ?? '',
  emailAddress: record.emailAddress ?? '',
  addressLine1: record.addressLine1 ?? '',
  addressLine2: record.addressLine2 ?? '',
  addressLine3: record.addressLine3 ?? '',
  addressLine4: record.addressLine4 ?? '',
  addressLine5: record.region ?? record.addressLine5 ?? 'Kowloon',
})

export default function ClientAccountsDatabasePage({ clients, error }: ClientAccountsDatabasePageProps) {
  const router = useRouter()
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [filteredClients, setFilteredClients] = useState<ClientDirectoryRecord[]>(clients)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRecord | null>(null)
  const [editableClient, setEditableClient] = useState<EditDialogClient | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const uniqueLetters = useMemo(
    () => Array.from(new Set(clients.map((client) => client.companyName.charAt(0).toUpperCase()))).sort(),
    [clients]
  )

  useEffect(() => {
    if (selectedLetter) {
      setFilteredClients(
        clients.filter((client) => client.companyName.charAt(0).toUpperCase() === selectedLetter)
      )
    } else {
      setFilteredClients(clients)
    }
  }, [selectedLetter, clients])

  const handleClientClick = (client: ClientDirectoryRecord) => {
    setSelectedClient(client)
    setViewDialogOpen(true)
  }

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false)
    setSelectedClient(null)
  }

  const handleEditFromView = () => {
    if (!selectedClient) {
      return
    }
    setViewDialogOpen(false)
    setEditableClient(convertToEditClient(selectedClient))
    setEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setSelectedClient(null)
    setEditableClient(null)
  }

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true)
  }

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false)
  }

  const handleNewClientSubmitted = () => {
    setAddDialogOpen(false)
    router.replace(router.asPath)
  }

  const handleClientChange = (client: EditDialogClient) => {
    setEditableClient(client)
  }

  const handleSaveClient = async () => {
    alert('Editing clients in Firestore is not yet implemented.')
    setEditDialogOpen(false)
    setEditableClient(null)
    router.replace(router.asPath)
  }

  const handleToggleView = (newView: 'clients' | 'bank') => {
    if (newView === 'clients') {
      router.push('/dashboard/businesses/client-accounts-database', undefined, { shallow: true })
    } else {
      router.push('/dashboard/businesses/company-bank-accounts-database', undefined, { shallow: true })
    }
  }

  return (
    <SidebarLayout>
      <Typography variant='h4' gutterBottom>
        Client Accounts (Database)
      </Typography>
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}
      <ToggleButtonGroup
        exclusive
        value='clients'
        onChange={(event, value) => {
          if (value) {
            handleToggleView(value)
          }
        }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value='clients'>Client Accounts</ToggleButton>
        <ToggleButton value='bank'>Company Bank Accounts</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {uniqueLetters.map((letter) => (
          <Button
            key={letter}
            variant={selectedLetter === letter ? 'contained' : 'outlined'}
            onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
          >
            {letter}
          </Button>
        ))}
      </Box>
      <Box sx={{ mb: 2 }}>
        <Button variant='contained' onClick={handleOpenAddDialog}>
          Add Client
        </Button>
      </Box>
      {filteredClients.length === 0 ? (
        <Typography>No client data found.</Typography>
      ) : (
        <List>
          {filteredClients.map((entry, idx) => (
            <ListItem key={`${entry.companyName}-${idx}`} disablePadding>
              <ListItemButton onClick={() => handleClientClick(entry)}>
                <ListItemText
                  primary={entry.companyName}
                  secondary={`${entry.title ?? ''} ${entry.nameAddressed ?? ''} - ${
                    entry.emailAddress ?? 'N/A'
                  }`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
      <ViewClientDialog
        open={viewDialogOpen}
        onClose={handleCloseViewDialog}
        client={selectedClient ? convertToClientDetails(selectedClient) : null}
        onEdit={handleEditFromView}
      />
      {editableClient && (
        <EditClientDialog
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          client={editableClient}
          onClientChange={handleClientChange}
          onSave={async () => handleSaveClient()}
        />
      )}
      <NewClientDialog open={addDialogOpen} onClose={handleCloseAddDialog} onSubmitted={handleNewClientSubmitted} />
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
        error: err instanceof Error ? err.message : 'Failed to load client directory',
      },
    }
  }
}
