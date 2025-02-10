// pages/dashboard/records.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook, fetchBankAccounts } from '../../lib/pmsReference';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';

import EditClientDialog from '../../components/EditClientDialog';
import NewClientDialog from '../../components/NewClientDialog';

interface Client {
  companyName: string;
  title: string;
  nameAddressed: string;
  emailAddress: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  addressLine5: string;
}

interface BankAccount {
  companyName: string;
  bankName: string;
  bankCode: string; // possibly has parentheses
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  comments?: string; // we won’t display
}

interface RecordsPageProps {
  clients: Client[];
  bankAccounts: BankAccount[];
  error?: string;
}

export default function RecordsPage({ clients, bankAccounts, error }: RecordsPageProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const initialView = router.query.view === 'bank' ? 'bank' : 'clients';
  const [view, setView] = useState<'clients' | 'bank'>(initialView);

  // For clients
  const uniqueLetters = Array.from(
    new Set(clients.map((c) => c.companyName.charAt(0).toUpperCase()))
  ).sort();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);

  // For editing an existing client
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // For adding a new client
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Group bank accounts by bankName + bankCode (minus parentheses)
  const bankGroups = bankAccounts.reduce((acc, account) => {
    // Remove parentheses from bank code
    const codeNoParen = account.bankCode.replace('(', '').replace(')', '');
    // e.g. group key: "OCBC 035"
    const groupKey = `${account.bankName} ${codeNoParen}`.trim();

    if (!acc[groupKey]) acc[groupKey] = [];
    // store the updated code in the array
    acc[groupKey].push({ ...account, bankCode: codeNoParen });
    return acc;
  }, {} as Record<string, BankAccount[]>);

  // Sync tab (clients/bank) with query
  useEffect(() => {
    if (router.query.view === 'bank') {
      setView('bank');
    } else {
      setView('clients');
    }
  }, [router.query.view]);

  // Filter clients by letter
  useEffect(() => {
    if (selectedLetter) {
      setFilteredClients(
        clients.filter(
          (c) => c.companyName.charAt(0).toUpperCase() === selectedLetter
        )
      );
    } else {
      setFilteredClients(clients);
    }
  }, [selectedLetter, clients]);

  // ------ Editing client ------
  function handleClientClick(client: Client) {
    setSelectedClient({ ...client });
    setEditDialogOpen(true);
  }
  function handleCloseEditDialog() {
    setEditDialogOpen(false);
    setSelectedClient(null);
  }
  async function handleSaveClientEdit() {
    if (!selectedClient) return;
    try {
      const resp = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            originalIdentifier: selectedClient.companyName,
            ...selectedClient,
          },
        }),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update client');
      }
      enqueueSnackbar('Client updated successfully', { variant: 'success' });
      handleCloseEditDialog();
      router.replace(router.asPath);
    } catch (err: any) {
      console.error('[handleSaveClientEdit] error:', err);
      enqueueSnackbar(`Failed: ${err.message}`, { variant: 'error' });
    }
  }

  // ------ Deleting client from edit dialog ------
  async function handleDeleteClient() {
    if (!selectedClient) return;
    if (!window.confirm(`Are you sure you want to DELETE client "${selectedClient.companyName}"?`)) {
      return;
    }
    try {
      const resp = await fetch(`/api/clients?identifier=${encodeURIComponent(selectedClient.companyName)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete client');
      }
      enqueueSnackbar('Client deleted successfully', { variant: 'success' });
      handleCloseEditDialog();
      router.replace(router.asPath);
    } catch (err: any) {
      console.error('[handleDeleteClient] error:', err);
      enqueueSnackbar(`Failed to delete client: ${err.message}`, { variant: 'error' });
    }
  }

  // ------ Adding a new client ------
  function handleOpenAddDialog() {
    setAddDialogOpen(true);
  }
  function handleCloseAddDialog() {
    setAddDialogOpen(false);
  }
  function handleAddClientSubmitted() {
    handleCloseAddDialog();
    router.replace(router.asPath);
  }

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>Records</Typography>
      {error && <Typography color="error">{error}</Typography>}

      <ToggleButtonGroup
        exclusive
        value={view}
        onChange={(e, newVal) => {
          if (newVal) {
            setView(newVal);
            router.push(`/dashboard/records?view=${newVal}`, undefined, { shallow: true });
          }
        }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="clients">Clients Account</ToggleButton>
        <ToggleButton value="bank">Company Bank Account</ToggleButton>
      </ToggleButtonGroup>

      {view === 'clients' && (
        <Box>
          {/* Alphabet Filter */}
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

          {/* Add Client Button */}
          <Box sx={{ mb: 2 }}>
            <Button variant="contained" onClick={handleOpenAddDialog}>
              Add Client
            </Button>
          </Box>

          {/* Client Listing */}
          {filteredClients.length === 0 ? (
            <Typography>No client data found.</Typography>
          ) : (
            <List>
              {filteredClients.map((client) => (
                <ListItem
                  key={client.companyName}
                  disablePadding
                >
                  <ListItemButton onClick={() => handleClientClick(client)}>
                    <ListItemText
                      primary={client.companyName}
                      secondary={`${client.title} ${client.nameAddressed} - ${client.emailAddress}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}

          {/* EDIT CLIENT DIALOG */}
          <EditClientDialog
            open={editDialogOpen}
            onClose={handleCloseEditDialog}
            client={selectedClient}
            onClientChange={(updated) => setSelectedClient(updated)}
            onSave={handleSaveClientEdit}
            onDelete={handleDeleteClient}
          />

          {/* ADD NEW CLIENT DIALOG */}
          <NewClientDialog
            open={addDialogOpen}
            onClose={handleCloseAddDialog}
            onSubmitted={handleAddClientSubmitted}
          />
        </Box>
      )}

      {view === 'bank' && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Company Bank Account
          </Typography>
          {Object.keys(bankGroups).length === 0 ? (
            <Typography>No bank account data found.</Typography>
          ) : (
            Object.entries(bankGroups).map(([bankGroup, accounts]) => (
              // do not expand by default => user must open
              <Accordion key={bankGroup}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">{bankGroup}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {accounts.map((acc) => (
                    <Box key={acc.accountNumber} sx={{ mb: 2 }}>
                      <Typography>
                        <strong>Type:</strong> {acc.accountType}
                      </Typography>
                      <Typography>
                        <strong>Account #:</strong> {acc.accountNumber}
                      </Typography>

                      {/* Skip FPS ID if empty */}
                      {acc.fpsId && acc.fpsId.trim() && (
                        <Typography>
                          <strong>FPS ID:</strong> {acc.fpsId}
                        </Typography>
                      )}

                      {/* Skip FPS Email if empty */}
                      {acc.fpsEmail && acc.fpsEmail.trim() && (
                        <Typography>
                          <strong>FPS Email:</strong> {acc.fpsEmail}
                        </Typography>
                      )}

                      {/* Omit comments entirely */}
                      <hr />
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      )}
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<RecordsPageProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }
  try {
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });
    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const clients = await fetchAddressBook(sheets, pmsRefLogFileId);
    let bankAccounts = await fetchBankAccounts(sheets, pmsRefLogFileId);

    // optionally remove parentheses from bank code globally
    // bankAccounts = bankAccounts.map((acc) => ({
    //   ...acc,
    //   bankCode: acc.bankCode.replace('(', '').replace(')', ''),
    // }));

    return { props: { clients, bankAccounts } };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return { props: { clients: [], bankAccounts: [], error: err.message || 'Error fetching records' } };
  }
};
