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
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';

// Updated: Import your client dialogs as needed.
import ViewClientDialog from '../../components/clientdialog/ViewClientDialog';
import EditClientDialog from '../../components/clientdialog/EditClientDialog';
import NewClientDialog from '../../components/clientdialog/NewClientDialog';

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
  fpsId?: string;
  fpsEmail?: string;
  comments?: string;
}

interface RecordsPageProps {
  clients: Client[];
  bankAccounts: BankAccount[];
  error?: string;
}

export default function RecordsPage({ clients, bankAccounts, error }: RecordsPageProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  // Determine initial view based on query.
  const initialView = router.query.view === 'bank' ? 'bank' : 'clients';
  const [view, setView] = useState<'clients' | 'bank'>(initialView);

  // Group clients by the first letter of their company name.
  const uniqueLetters = Array.from(new Set(clients.map(c => c.companyName.charAt(0).toUpperCase()))).sort();
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);

  // For viewing/editing a client.
  const [viewClientOpen, setViewClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Group bank accounts (this code has been fixed to use backticks properly).
  const bankGroups = bankAccounts.reduce((acc, account) => {
    const codeNoParen = account.bankCode.replace('(', '').replace(')', '');
    const groupKey = `${account.bankName} ${codeNoParen}`.trim();
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

  useEffect(() => {
    if (selectedLetter) {
      setFilteredClients(clients.filter(c => c.companyName.charAt(0).toUpperCase() === selectedLetter));
    } else {
      setFilteredClients(clients);
    }
  }, [selectedLetter, clients]);

  function handleClientClick(client: Client) {
    setSelectedClient({ ...client });
    setViewClientOpen(true);
  }
  function handleCloseViewClient() {
    setViewClientOpen(false);
    setSelectedClient(null);
  }
  function handleEditFromView() {
    setViewClientOpen(false);
    setEditDialogOpen(true);
  }
  function handleCloseEditDialog() {
    setEditDialogOpen(false);
    setSelectedClient(null);
  }
  function handleOpenAddDialog() {
    setAddDialogOpen(true);
  }
  function handleCloseAddDialog() {
    setAddDialogOpen(false);
  }
  function handleNewClientSubmitted() {
    handleCloseAddDialog();
    router.replace(router.asPath);
  }

  function handleToggleView(newView: 'clients' | 'bank') {
    setView(newView);
    router.push(`/dashboard/records?view=${newView}`, undefined, { shallow: true });
  }

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>Records</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <ToggleButtonGroup
        exclusive
        value={view}
        onChange={(e, newVal) => {
          if (newVal) handleToggleView(newVal);
        }}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="clients">Clients Account</ToggleButton>
        <ToggleButton value="bank">Company Bank Account</ToggleButton>
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
              {filteredClients.map(client => (
                <ListItem key={client.companyName} disablePadding>
                  <ListItemButton onClick={() => handleClientClick(client)}>
                    <ListItemText
                      primary={`${client.companyName}`}
                      secondary={`${client.title} ${client.nameAddressed} - ${client.emailAddress}`}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      ) : (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>Company Bank Account</Typography>
          {Object.keys(bankGroups).length === 0 ? (
            <Typography>No bank account data found.</Typography>
          ) : (
            Object.entries(bankGroups).map(([groupKey, accounts]) => (
              <Accordion key={groupKey}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">{groupKey}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {accounts.map(acc => (
                    <Box key={acc.accountNumber} sx={{ mb: 2 }}>
                      <Typography><strong>Type:</strong> {acc.accountType}</Typography>
                      <Typography><strong>Account #:</strong> {acc.accountNumber}</Typography>
                      {acc.fpsId && <Typography><strong>FPS ID:</strong> {acc.fpsId}</Typography>}
                      {acc.fpsEmail && <Typography><strong>FPS Email:</strong> {acc.fpsEmail}</Typography>}
                      <hr />
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </Box>
      )}
      <ViewClientDialog
        open={viewClientOpen}
        onClose={handleCloseViewClient}
        client={selectedClient}
        onEdit={handleEditFromView}
      />
      <EditClientDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        client={selectedClient}
        onClientChange={(updated) => setSelectedClient(updated)}
        onSave={handleCloseEditDialog}
        onDelete={() => {}}
      />
      <NewClientDialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        onSubmitted={handleNewClientSubmitted}
      />
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<RecordsPageProps> = async (ctx) => {
  try {
    const session = await getSession(ctx);
    if (!session?.accessToken) {
      return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
    }
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });
    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const clients = await fetchAddressBook(sheets, pmsRefLogFileId);
    const bankAccounts = await fetchBankAccounts(sheets, pmsRefLogFileId);
    return { props: { clients, bankAccounts } };
  } catch (error: any) {
    console.error('[getServerSideProps] Error:', error);
    return { props: { clients: [], bankAccounts: [], error: error.message || 'Error fetching records' } };
  }
};
