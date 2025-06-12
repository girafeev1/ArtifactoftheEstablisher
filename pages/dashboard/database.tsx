// pages/dashboard/database.tsx

import SidebarLayout from '../../components/SidebarLayout';
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
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';
import ViewClientDialog from '../../components/clientdialog/ViewClientDialog';
import EditClientDialog from '../../components/clientdialog/EditClientDialog';
import NewClientDialog from '../../components/clientdialog/NewClientDialog';

interface AddressBookEntry {
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
  fpsId?: string;
  fpsEmail?: string;
  // Removed comments field from display
}

export default function DatabasePage() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [clients, setClients] = useState<AddressBookEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const loadData = async () => {
      try {
        const resp = await fetch('/api/clients');
        const json = await resp.json();
        setClients(json.clients || []);
        setBankAccounts(json.bankAccounts || []);
      } catch (err: any) {
        setError(err.message);
      }
    };
    loadData();
  }, []);

  const initialView = router.query.view === 'bank' ? 'bank' : 'clients';
  const [view, setView] = useState<'clients' | 'bank'>(initialView);
  const uniqueLetters = Array.from(new Set(clients.map(c => c.companyName.charAt(0).toUpperCase()))).sort();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [filteredClients, setFilteredClients] = useState<AddressBookEntry[]>(clients);

  const [selectedClient, setSelectedClient] = useState<AddressBookEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  useEffect(() => {
    if (selectedLetter) {
      setFilteredClients(clients.filter(c => c.companyName.charAt(0).toUpperCase() === selectedLetter));
    } else {
      setFilteredClients(clients);
    }
  }, [selectedLetter, clients]);

  const handleClientClick = (client: AddressBookEntry) => {
    setSelectedClient(client);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClient(null);
  };

  const handleEditFromView = () => {
    setDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedClient(null);
  };

  const handleOpenAddDialog = () => {
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
  };

  const handleNewClientSubmitted = () => {
    enqueueSnackbar('Update Success', { variant: 'success' });
    handleCloseAddDialog();
    router.replace(router.asPath);
  };

  const handleToggleView = (newView: 'clients' | 'bank') => {
    setView(newView);
    router.push(`/dashboard/database?view=${newView}`, undefined, { shallow: true });
  };

  // Group bank accounts by bankName (exclude the comments field)
  const groupedBankAccounts = bankAccounts.reduce((acc, account) => {
    if (!acc[account.bankName]) {
      acc[account.bankName] = [];
    }
    acc[account.bankName].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>Database</Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}
      <ToggleButtonGroup
        exclusive
        value={view}
        onChange={(e, newVal) => {
          if (newVal) handleToggleView(newVal);
        }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="clients">Client Accounts</ToggleButton>
        <ToggleButton value="bank">Company Bank Accounts</ToggleButton>
      </ToggleButtonGroup>
      {view === 'clients' ? (
        <Box>
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
          <Box sx={{ mb: 2 }}>
            <Button variant="contained" onClick={handleOpenAddDialog}>
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
                      secondary={`${entry.title} ${entry.nameAddressed} - ${entry.emailAddress}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Company Bank Accounts</Typography>
          {Object.keys(groupedBankAccounts).length === 0 ? (
            <Typography>No bank accounts found.</Typography>
          ) : (
            <List>
              {Object.entries(groupedBankAccounts).map(([bankName, accounts], idx) => (
                <Accordion key={`${bankName}-${idx}`}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>{bankName}</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {accounts.map((account, i) => (
                      <Box key={`${bankName}-${i}`} sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <strong>Bank Code:</strong> {account.bankCode}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Account Type:</strong> {account.accountType}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Account Number:</strong> {account.accountNumber}
                        </Typography>
                        {account.fpsId && (
                          <Typography variant="body2">
                            <strong>FPS ID:</strong> {account.fpsId}
                          </Typography>
                        )}
                        {account.fpsEmail && (
                          <Typography variant="body2">
                            <strong>FPS Email:</strong> {account.fpsEmail}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </Box>
      )}
      <ViewClientDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        client={selectedClient}
        onEdit={handleEditFromView}
      />
      <EditClientDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        client={selectedClient!}
        onClientChange={(updated) => setSelectedClient(updated)}
        onSave={async (client) => {
          try {
            const response = await fetch('/api/clients', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: client }),
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to update client');
            }
            enqueueSnackbar('Update Success', { variant: 'success' });
            router.replace(router.asPath);
            handleCloseEditDialog();
          } catch (err: any) {
            enqueueSnackbar(`Error updating client: ${err.message}`, { variant: 'error' });
          }
        }}
        onDelete={async (client) => {
          try {
            const response = await fetch(`/api/clients?identifier=${encodeURIComponent(client.companyName)}`, {
              method: 'DELETE',
            });
            if (!response.ok) {
              const err = await response.json();
              throw new Error(err.error || 'Failed to delete client');
            }
            enqueueSnackbar('Update Success', { variant: 'success' });
            router.replace(router.asPath);
            handleCloseEditDialog();
          } catch (err: any) {
            enqueueSnackbar(`Error deleting client: ${err.message}`, { variant: 'error' });
          }
        }}
      />
      <NewClientDialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        onSubmitted={handleNewClientSubmitted}
      />
    </SidebarLayout>
  );
}

