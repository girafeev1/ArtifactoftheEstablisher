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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useSnackbar } from 'notistack';

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
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId: string;
  fpsEmail: string;
  comments: string;
}

interface RecordsPageProps {
  clients: Client[];
  bankAccounts: BankAccount[];
  error?: string;
}

export default function RecordsPage({ clients, bankAccounts, error }: RecordsPageProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  // Toggle between "clients" and "bank"
  const initialView = router.query.view === 'bank' ? 'bank' : 'clients';
  const [view, setView] = useState<'clients' | 'bank'>(initialView);

  // Alphabet filter for clients
  const uniqueLetters = Array.from(new Set(clients.map(c => c.companyName.charAt(0).toUpperCase()))).sort();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);

  // Edit client dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Add client dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState<Client>({
    companyName: '',
    title: 'Mr.',
    nameAddressed: '',
    emailAddress: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: 'Kowloon',
  });

  // For bank accounts, group by "BankName (BankCode)"
  const bankGroups = bankAccounts.reduce((acc, account) => {
    const bankKey = `${account.bankName} (${account.bankCode})`;
    if (!acc[bankKey]) acc[bankKey] = [];
    acc[bankKey].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

  // Manage toggles
  useEffect(() => {
    if (router.query.view === 'bank') {
      setView('bank');
    } else {
      setView('clients');
    }
  }, [router.query.view]);

  // Filter clients by selected letter
  useEffect(() => {
    if (selectedLetter) {
      setFilteredClients(clients.filter(c => c.companyName.charAt(0).toUpperCase() === selectedLetter));
    } else {
      setFilteredClients(clients);
    }
  }, [selectedLetter, clients]);

  /** ===================
   * CLIENT EDITING
   * =================== */
  const handleClientClick = (client: Client) => {
    setSelectedClient({ ...client });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setSelectedClient(null);
    setEditDialogOpen(false);
  };

  const handleSaveClientEdit = async () => {
    if (!selectedClient) return;
    try {
      const resp = await fetch('/api/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client',
          data: {
            originalIdentifier: selectedClient.companyName, // old name
            ...selectedClient,
          },
        }),
      });
      if (!resp.ok) {
        const errJson = await resp.json();
        throw new Error(errJson.error || 'Failed to update client');
      }
      enqueueSnackbar('Client updated successfully', { variant: 'success' });
      handleCloseEditDialog();
      // Optionally refresh state or re-fetch the data.
    } catch (err: any) {
      console.error('[handleSaveClientEdit] error:', err);
      enqueueSnackbar(`Failed to update client: ${err.message}`, { variant: 'error' });
    }
  };

  // OPTIONAL: Delete client
  const handleDeleteClient = async () => {
    if (!selectedClient) return;
    // If you implement a DELETE route, you could do it here.
    // For example:
    /*
    try {
      const resp = await fetch(`/api/clients?identifier=${selectedClient.companyName}`, { method: 'DELETE' });
      if (!resp.ok) {
        const errJson = await resp.json();
        throw new Error(errJson.error || 'Failed to delete client');
      }
      enqueueSnackbar('Client deleted successfully', { variant: 'success' });
      handleCloseEditDialog();
    } catch (err: any) {
      console.error('[handleDeleteClient] error:', err);
      enqueueSnackbar(`Failed to delete client: ${err.message}`, { variant: 'error' });
    }
    */
    enqueueSnackbar('Delete not yet implemented.', { variant: 'info' });
  };

  /** ===================
   * ADD NEW CLIENT
   * =================== */
  const handleOpenAddDialog = () => {
    setNewClient({
      companyName: '',
      title: 'Mr.',
      nameAddressed: '',
      emailAddress: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      addressLine4: '',
      addressLine5: 'Kowloon',
    });
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  const handleSubmitNewClient = async () => {
    try {
      const resp = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'client', data: newClient }),
      });
      if (!resp.ok) {
        const errJson = await resp.json();
        throw new Error(errJson.error || 'Failed to add client');
      }
      enqueueSnackbar('New client added successfully', { variant: 'success' });
      handleCloseAddDialog();
      // Optionally refresh
    } catch (err: any) {
      console.error('[handleSubmitNewClient] error:', err);
      enqueueSnackbar(`Failed to add client: ${err.message}`, { variant: 'error' });
    }
  };

  /** ===================
   * RENDER
   * =================== */
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

      {/* CLIENTS TAB */}
      {view === 'clients' && (
        <Box>
          {/* Alphabet Filter */}
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {uniqueLetters.map(letter => (
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
            <Button variant="contained" onClick={handleOpenAddDialog}>Add Client</Button>
          </Box>

          {/* Client Listing */}
          {filteredClients.length === 0 ? (
            <Typography>No client data found.</Typography>
          ) : (
            <List>
              {filteredClients.map((client, idx) => (
                <ListItem key={idx} disablePadding>
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

          {/* Edit Client Dialog */}
          <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} fullWidth>
            {selectedClient && (
              <>
                <DialogTitle>Edit Client Info</DialogTitle>
                <DialogContent dividers>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Company Name"
                        margin="normal"
                        value={selectedClient.companyName}
                        onChange={(e) => setSelectedClient({ ...selectedClient, companyName: e.target.value })}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel id="title-edit-label">Title</InputLabel>
                        <Select
                          labelId="title-edit-label"
                          value={selectedClient.title}
                          label="Title"
                          onChange={(e) => setSelectedClient({ ...selectedClient, title: e.target.value })}
                        >
                          <MenuItem value="Mr.">Mr.</MenuItem>
                          <MenuItem value="Mrs.">Mrs.</MenuItem>
                          <MenuItem value="Ms.">Ms.</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Name Addressed"
                        margin="normal"
                        value={selectedClient.nameAddressed}
                        onChange={(e) => setSelectedClient({ ...selectedClient, nameAddressed: e.target.value })}
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    fullWidth
                    label="Email Address"
                    margin="normal"
                    value={selectedClient.emailAddress}
                    onChange={(e) => setSelectedClient({ ...selectedClient, emailAddress: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Room/ Floor/ Block"
                    margin="normal"
                    value={selectedClient.addressLine1}
                    onChange={(e) => setSelectedClient({ ...selectedClient, addressLine1: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Building Name"
                    margin="normal"
                    value={selectedClient.addressLine2}
                    onChange={(e) => setSelectedClient({ ...selectedClient, addressLine2: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Street Name"
                    margin="normal"
                    value={selectedClient.addressLine3}
                    onChange={(e) => setSelectedClient({ ...selectedClient, addressLine3: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="District"
                    margin="normal"
                    value={selectedClient.addressLine4}
                    onChange={(e) => setSelectedClient({ ...selectedClient, addressLine4: e.target.value })}
                  />
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="region-edit-label">Region</InputLabel>
                    <Select
                      labelId="region-edit-label"
                      value={selectedClient.addressLine5}
                      label="Region"
                      onChange={(e) => setSelectedClient({ ...selectedClient, addressLine5: e.target.value })}
                    >
                      <MenuItem value="Kowloon">Kowloon</MenuItem>
                      <MenuItem value="Hong Kong">Hong Kong</MenuItem>
                      <MenuItem value="New Territories">New Territories</MenuItem>
                    </Select>
                  </FormControl>
                </DialogContent>
                <DialogActions>
                  <Button color="error" onClick={/* Implement delete logic here */ handleDeleteClient}>Delete</Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Button onClick={handleCloseEditDialog}>Cancel</Button>
                  <Button variant="contained" onClick={handleSaveClientEdit}>Save</Button>
                </DialogActions>
              </>
            )}
          </Dialog>

          {/* Add New Client Dialog */}
          <Dialog open={addDialogOpen} onClose={handleCloseAddDialog} fullWidth>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogContent dividers>
              <TextField
                fullWidth
                label="Company Name"
                margin="normal"
                value={newClient.companyName}
                onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="title-add-label">Title</InputLabel>
                    <Select
                      labelId="title-add-label"
                      value={newClient.title}
                      label="Title"
                      onChange={(e) => setNewClient({ ...newClient, title: e.target.value })}
                    >
                      <MenuItem value="Mr.">Mr.</MenuItem>
                      <MenuItem value="Mrs.">Mrs.</MenuItem>
                      <MenuItem value="Ms.">Ms.</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Name Addressed"
                    margin="normal"
                    value={newClient.nameAddressed}
                    onChange={(e) => setNewClient({ ...newClient, nameAddressed: e.target.value })}
                  />
                </Grid>
              </Grid>
              <TextField
                fullWidth
                label="Email Address"
                margin="normal"
                value={newClient.emailAddress}
                onChange={(e) => setNewClient({ ...newClient, emailAddress: e.target.value })}
              />
              <TextField
                fullWidth
                label="Room/ Floor/ Block"
                margin="normal"
                value={newClient.addressLine1}
                onChange={(e) => setNewClient({ ...newClient, addressLine1: e.target.value })}
              />
              <TextField
                fullWidth
                label="Building Name"
                margin="normal"
                value={newClient.addressLine2}
                onChange={(e) => setNewClient({ ...newClient, addressLine2: e.target.value })}
              />
              <TextField
                fullWidth
                label="Street Name"
                margin="normal"
                value={newClient.addressLine3}
                onChange={(e) => setNewClient({ ...newClient, addressLine3: e.target.value })}
              />
              <TextField
                fullWidth
                label="District"
                margin="normal"
                value={newClient.addressLine4}
                onChange={(e) => setNewClient({ ...newClient, addressLine4: e.target.value })}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel id="region-add-label">Region</InputLabel>
                <Select
                  labelId="region-add-label"
                  value={newClient.addressLine5}
                  label="Region"
                  onChange={(e) => setNewClient({ ...newClient, addressLine5: e.target.value })}
                >
                  <MenuItem value="Kowloon">Kowloon</MenuItem>
                  <MenuItem value="Hong Kong">Hong Kong</MenuItem>
                  <MenuItem value="New Territories">New Territories</MenuItem>
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseAddDialog}>Cancel</Button>
              <Button variant="contained" onClick={handleSubmitNewClient}>Submit</Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* BANK ACCOUNTS TAB */}
      {view === 'bank' && (
        <Box>
          <Typography variant="h6">Company Bank Account</Typography>
          {Object.keys(bankGroups).length === 0 ? (
            <Typography>No bank account data found.</Typography>
          ) : (
            Object.entries(bankGroups).map(([bankName, accounts]) => (
              <Box key={bankName} sx={{ mb: 2 }}>
                <Typography variant="subtitle1">{bankName}</Typography>
                <List>
                  {accounts.map((account, idx) => (
                    <ListItem key={idx}>
                      <ListItemText
                        primary={account.accountNumber}
                        secondary={`${account.accountType} | FPS: ${account.fpsId} / ${account.fpsEmail} ${account.comments ? `| ${account.comments}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
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
    const bankAccounts = await fetchBankAccounts(sheets, pmsRefLogFileId);
    return { props: { clients, bankAccounts } };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return { props: { clients: [], bankAccounts: [], error: err.message || 'Error fetching records' } };
  }
};
