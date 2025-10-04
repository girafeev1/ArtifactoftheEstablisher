import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'

import SidebarLayout from '../SidebarLayout'
import ViewClientDialog from '../clientdialog/ViewClientDialog'
import EditClientDialog, { type Client as EditDialogClient } from '../clientdialog/EditClientDialog'
import NewClientDialog from '../clientdialog/NewClientDialog'

import {
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

import type { ClientDirectoryRecord } from '../../lib/clientDirectory'
import type { BankAccountDirectoryRecord } from '../../lib/bankAccountsDirectory'

interface ClientBankDatabasePageProps {
  clients: ClientDirectoryRecord[]
  bankAccounts: BankAccountDirectoryRecord[]
  initialView: 'clients' | 'bank'
  error?: string
}

const convertToClientDetails = (record: ClientDirectoryRecord) => {
  const title = record.title ?? ''
  const nameAddressed = record.nameAddressed ?? record.name ?? ''
  const cleanedTitle = title && nameAddressed.toLowerCase().startsWith(title.toLowerCase()) ? '' : title

  return {
    companyName: record.companyName,
    title: cleanedTitle,
    nameAddressed,
    emailAddress: record.emailAddress ?? '',
    addressLine1: record.addressLine1 ?? '',
    addressLine2: record.addressLine2 ?? '',
    addressLine3: record.addressLine3 ?? '',
    addressLine4: record.addressLine4 ?? '',
    addressLine5: record.addressLine5 ?? record.region ?? '',
  }
}

const convertToEditClient = (record: ClientDirectoryRecord): EditDialogClient => ({
  companyName: record.companyName,
  title: record.title ?? 'Mr.',
  nameAddressed: record.nameAddressed ?? record.name ?? '',
  emailAddress: record.emailAddress ?? '',
  addressLine1: record.addressLine1 ?? '',
  addressLine2: record.addressLine2 ?? '',
  addressLine3: record.addressLine3 ?? '',
  addressLine4: record.addressLine4 ?? '',
  addressLine5: record.addressLine5 ?? record.region ?? 'Kowloon',
})

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
  })

const getContactSecondary = (client: ClientDirectoryRecord) => {
  const contact = [client.title, client.nameAddressed ?? client.name]
    .filter(Boolean)
    .join(' ')
    .trim()

  const email = client.emailAddress ?? 'N/A'
  return contact ? `${contact} - ${email}` : `N/A - ${email}`
}

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

export function ClientBankDatabasePage({
  clients,
  bankAccounts,
  initialView,
  error,
}: ClientBankDatabasePageProps) {
  const router = useRouter()
  const [view, setView] = useState<'clients' | 'bank'>(initialView)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [filteredClients, setFilteredClients] = useState<ClientDirectoryRecord[]>(clients)
  const [selectedClient, setSelectedClient] = useState<ClientDirectoryRecord | null>(null)
  const [editableClient, setEditableClient] = useState<EditDialogClient | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  useEffect(() => {
    setView(initialView)
  }, [initialView])

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

  const groupedBankAccounts = useMemo(() => {
    const map = new Map<
      string,
      {
        bankName: string
        bankCode: string | null
        entries: BankAccountDirectoryRecord[]
        active: boolean
      }
    >()

    bankAccounts.forEach((account) => {
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
  }, [bankAccounts])

  const handleToggleView = (newView: 'clients' | 'bank') => {
    setView(newView)
  }

  const handleClientClick = (client: ClientDirectoryRecord) => {
    setSelectedClient(client)
    setViewDialogOpen(true)
  }

  const handleCloseViewDialog = () => {
    setViewDialogOpen(false)
    setSelectedClient(null)
  }

  const handleEditFromView = () => {
    if (!selectedClient) return
    setViewDialogOpen(false)
    setEditableClient(convertToEditClient(selectedClient))
    setEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false)
    setEditableClient(null)
    setSelectedClient(null)
  }

  const handleClientChange = (client: EditDialogClient) => {
    setEditableClient(client)
  }

  const handleSaveClient = async () => {
    alert('Editing clients in Firestore is not yet implemented.')
    setEditDialogOpen(false)
    setEditableClient(null)
    setSelectedClient(null)
    router.replace(router.asPath)
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

  return (
    <SidebarLayout>
      <Typography variant='h4' gutterBottom>
        {view === 'clients' ? 'Client Accounts (Database)' : 'Company Bank Accounts (Database)'}
      </Typography>
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}
      <ToggleButtonGroup
        exclusive
        value={view}
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

      {view === 'clients' ? (
        <Box>
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
                      secondary={getContactSecondary(entry)}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      ) : groupedBankAccounts.length === 0 ? (
        <Typography>No bank accounts found.</Typography>
      ) : (
        groupedBankAccounts.map((group) => (
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

export default ClientBankDatabasePage
