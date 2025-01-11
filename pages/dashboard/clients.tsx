import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeUserApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook } from '../../lib/pmsReference';
import { useState } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Alert,
} from '@mui/material';
import { useSnackbar } from 'notistack';

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

interface ClientsPageProps {
  companies: AddressBookEntry[];
  error?: string;
}

export default function ClientsPage({ companies, error }: ClientsPageProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [clientList, setClientList] = useState<AddressBookEntry[]>(companies || []);

  // State for "View/Edit" existing client
  const [selectedClient, setSelectedClient] = useState<AddressBookEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // State for "Add Client"
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState<AddressBookEntry>({
    companyName: '',
    title: '',
    nameAddressed: '',
    emailAddress: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
  });

  const handleOpenViewDialog = (client: AddressBookEntry) => {
    setSelectedClient(client);
    setDialogOpen(true);
    setEditMode(false);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedClient(null);
    setEditMode(false);
  };

  // "Edit" => toggles fields to be editable
  const handleEdit = () => {
    setEditMode(true);
  };

  // "Save" changes for existing client
  const handleSaveEdit = async () => {
    if (!selectedClient) return;
    try {
      const originalCompanyName = selectedClient.companyName; // the old key

      console.log('Attempting to save edit:', JSON.stringify(selectedClient, null, 2));
      const response = await fetch('/api/info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client',
          data: {
            originalIdentifier: originalCompanyName,
            ...selectedClient, // pass the updated fields
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Fetch Response Error:', JSON.stringify(errorData, null, 2));
        throw new Error(errorData.error || 'Failed to update client');
      }

      // Optionally reload the page or fetch new data
      const updatedList = clientList.map((c) =>
        c.companyName === originalCompanyName ? selectedClient : c
      );
      setClientList(updatedList);
      setEditMode(false);
      handleCloseDialog(); // Close the dialog after successful update
      enqueueSnackbar('Client updated successfully', { variant: 'success' });
    } catch (error: any) {
      console.error('Error saving edits:', error);
      console.log('Error details:', JSON.stringify(error, null, 2));
      enqueueSnackbar(`Failed to save changes: ${error.message}`, { variant: 'error' });
    }
  };

  // "Add Client" logic
  const handleOpenAddDialog = () => {
    setNewClient({
      companyName: '',
      title: '',
      nameAddressed: '',
      emailAddress: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      addressLine4: '',
      addressLine5: '',
    });
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
    setNewClient({ // Reset the form
      companyName: '',
      title: '',
      nameAddressed: '',
      emailAddress: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      addressLine4: '',
      addressLine5: '',
    });
  };

  const handleSubmitNewClient = async () => {
    try {
      console.log('Attempting to add new client:', newClient);
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client',
          data: newClient,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add new client');
      }

      // Reload or update local state
      setClientList([...clientList, newClient]);
      setAddDialogOpen(false);
      enqueueSnackbar('New client added successfully', { variant: 'success' });
    } catch (error: any) {
      console.error('Error adding new client:', error);
      enqueueSnackbar(`Failed to add new client: ${error.message}`, { variant: 'error' });
    }
  };

  // Build line 6 => "<title>. <nameAddressed>"
  const getLine6 = (entry: AddressBookEntry) => {
    const t = entry.title?.trim() ? `${entry.title.trim()}.` : '';
    const n = entry.nameAddressed?.trim() || '';
    return (t && n) ? `${t} ${n}` : (t || n);
  };

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>Clients</Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: {error}
        </Alert>
      )}
      <Button variant="contained" onClick={handleOpenAddDialog} sx={{ mb: 2 }}>
        Add Client
      </Button>

      {clientList.length === 0 ? (
        <Typography>No clients found.</Typography>
      ) : (
        <List>
          {clientList.map((entry, idx) => (
            <ListItem key={idx} disablePadding>
              <ListItemButton onClick={() => handleOpenViewDialog(entry)}>
                {entry.companyName}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {/* Dialog for viewing/editing existing client */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth>
        {selectedClient && (
          <>
            <DialogTitle>{selectedClient.companyName}</DialogTitle>
            <DialogContent dividers>
              {editMode ? (
                <>
                  <TextField
                    fullWidth
                    label="Address Line 1"
                    margin="normal"
                    value={selectedClient.addressLine1}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine1: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Address Line 2"
                    margin="normal"
                    value={selectedClient.addressLine2}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine2: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Address Line 3"
                    margin="normal"
                    value={selectedClient.addressLine3}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine3: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Address Line 4"
                    margin="normal"
                    value={selectedClient.addressLine4}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine4: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Address Line 5"
                    margin="normal"
                    value={selectedClient.addressLine5}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine5: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Title"
                    margin="normal"
                    value={selectedClient.title}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, title: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Name Addressed"
                    margin="normal"
                    value={selectedClient.nameAddressed}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, nameAddressed: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Email Address"
                    margin="normal"
                    value={selectedClient.emailAddress}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, emailAddress: e.target.value })
                    }
                  />
                </>
              ) : (
                <>
                  <Typography variant="body1">{selectedClient.addressLine1}</Typography>
                  <Typography variant="body1">{selectedClient.addressLine2}</Typography>
                  <Typography variant="body1">{selectedClient.addressLine3}</Typography>
                  <Typography variant="body1">
                    {selectedClient.addressLine4}, {selectedClient.addressLine5}
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 2 }}>
                    {getLine6(selectedClient)}
                  </Typography>
                </>
              )}
            </DialogContent>
            <DialogActions>
              {!editMode ? (
                <>
                  <Button onClick={handleEdit}>Edit</Button>
                  <Button onClick={handleCloseDialog}>Close</Button>
                </>
              ) : (
                <>
                  <Button onClick={handleSaveEdit}>Save</Button>
                  <Button onClick={handleCloseDialog}>Cancel</Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog for adding a NEW client */}
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
          <TextField
            fullWidth
            label="Title"
            margin="normal"
            value={newClient.title}
            onChange={(e) => setNewClient({ ...newClient, title: e.target.value })}
          />
          <TextField
            fullWidth
            label="Name Addressed"
            margin="normal"
            value={newClient.nameAddressed}
            onChange={(e) => setNewClient({ ...newClient, nameAddressed: e.target.value })}
          />
          <TextField
            fullWidth
            label="Email Address"
            margin="normal"
            value={newClient.emailAddress}
            onChange={(e) => setNewClient({ ...newClient, emailAddress: e.target.value })}
          />
          <TextField
            fullWidth
            label="Address Line 1"
            margin="normal"
            value={newClient.addressLine1}
            onChange={(e) => setNewClient({ ...newClient, addressLine1: e.target.value })}
          />
          <TextField
            fullWidth
            label="Address Line 2"
            margin="normal"
            value={newClient.addressLine2}
            onChange={(e) => setNewClient({ ...newClient, addressLine2: e.target.value })}
          />
          <TextField
            fullWidth
            label="Address Line 3"
            margin="normal"
            value={newClient.addressLine3}
            onChange={(e) => setNewClient({ ...newClient, addressLine3: e.target.value })}
          />
          <TextField
            fullWidth
            label="Address Line 4"
            margin="normal"
            value={newClient.addressLine4}
            onChange={(e) => setNewClient({ ...newClient, addressLine4: e.target.value })}
          />
          <TextField
            fullWidth
            label="Address Line 5"
            margin="normal"
            value={newClient.addressLine5}
            onChange={(e) => setNewClient({ ...newClient, addressLine5: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSubmitNewClient}>Submit</Button>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ClientsPageProps> = async (ctx) => {
  const session = await getSession(ctx);
  console.log('Session in getServerSideProps:', session); // Log session for debugging

  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin/google', permanent: false },
    };
  }

  try {
    const { initializeUserApis } = await import('../../lib/googleApi');
    const { drive, sheets } = initializeUserApis(session.accessToken);
    const referenceLogId = await findPMSReferenceLogFile(drive);
    const companies = await fetchAddressBook(sheets, referenceLogId);
    return { props: { companies } };
  } catch (err: any) {
    return {
      props: {
        companies: [],
        error: err.message || 'Error fetching clients',
      },
    };
  }
};
