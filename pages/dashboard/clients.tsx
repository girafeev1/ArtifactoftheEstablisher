// pages/dashboard/clients.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchAddressBook } from '../../lib/pmsReference';
import { useState, useMemo } from 'react';
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
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
  Box,
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

  // State for Alphabetical Filter
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  // State for "View/Edit" existing client
  const [selectedClient, setSelectedClient] = useState<AddressBookEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // State for "Add Client"
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState<AddressBookEntry>({
    companyName: '',
    title: 'Mr.', // Default to Mr.
    nameAddressed: '',
    emailAddress: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: 'Kowloon', // Default to Kowloon
  });

  // Extract unique starting letters
  const uniqueLetters = useMemo(() => {
    const lettersSet = new Set<string>();
    clientList.forEach((client) => {
      if (client.companyName && typeof client.companyName === 'string') {
        lettersSet.add(client.companyName.charAt(0).toUpperCase());
      }
    });
    // Sort the letters alphabetically
    return Array.from(lettersSet).sort();
  }, [clientList]);

  // Handle letter selection
  const handleLetterClick = (letter: string) => {
    if (selectedLetter === letter) {
      setSelectedLetter(null); // Toggle off if already selected
    } else {
      setSelectedLetter(letter);
    }
  };

  // Filtered client list based on selected letter
  const filteredClients = useMemo(() => {
    if (!selectedLetter) return clientList;
    return clientList.filter(
      (client) =>
        client.companyName &&
        client.companyName.charAt(0).toUpperCase() === selectedLetter
    );
  }, [selectedLetter, clientList]);

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

      // Update the client list
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

      // Update the client list
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

      {/* Alphabetical Directory Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Filter by Starting Letter:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {uniqueLetters.map((letter) => (
            <Button
              key={letter}
              variant={selectedLetter === letter ? 'contained' : 'outlined'}
              onClick={() => handleLetterClick(letter)}
            >
              {letter}
            </Button>
          ))}
        </Box>
      </Box>

      {filteredClients.length === 0 ? (
        <Typography>No clients found.</Typography>
      ) : (
        <List>
          {filteredClients.map((entry, idx) => (
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
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth margin="normal">
                        <InputLabel id="title-label">Title</InputLabel>
                        <Select
                          labelId="title-label"
                          value={selectedClient.title}
                          label="Title"
                          onChange={(e) =>
                            setSelectedClient({ ...selectedClient, title: e.target.value })
                          }
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
                        onChange={(e) =>
                          setSelectedClient({ ...selectedClient, nameAddressed: e.target.value })
                        }
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    fullWidth
                    label="Email Address"
                    margin="normal"
                    value={selectedClient.emailAddress}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, emailAddress: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Room/Floor/Block"
                    margin="normal"
                    value={selectedClient.addressLine1}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine1: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Building Name"
                    margin="normal"
                    value={selectedClient.addressLine2}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine2: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Street Name"
                    margin="normal"
                    value={selectedClient.addressLine3}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine3: e.target.value })
                    }
                  />
                  <TextField
                    fullWidth
                    label="District"
                    margin="normal"
                    value={selectedClient.addressLine4}
                    onChange={(e) =>
                      setSelectedClient({ ...selectedClient, addressLine4: e.target.value })
                    }
                  />
                  <FormControl fullWidth margin="normal">
                    <InputLabel id="region-label">Region</InputLabel>
                    <Select
                      labelId="region-label"
                      value={selectedClient.addressLine5}
                      label="Region"
                      onChange={(e) =>
                        setSelectedClient({ ...selectedClient, addressLine5: e.target.value })
                      }
                    >
                      <MenuItem value="Kowloon">Kowloon</MenuItem>
                      <MenuItem value="Hong Kong">Hong Kong</MenuItem>
                      <MenuItem value="New Territories">New Territories</MenuItem>
                    </Select>
                  </FormControl>
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
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel id="title-add-label">Title</InputLabel>
                <Select
                  labelId="title-add-label"
                  value={newClient.title}
                  label="Title"
                  onChange={(e) =>
                    setNewClient({ ...newClient, title: e.target.value })
                  }
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
                onChange={(e) =>
                  setNewClient({ ...newClient, nameAddressed: e.target.value })
                }
              />
            </Grid>
          </Grid>
          <TextField
            fullWidth
            label="Email Address"
            margin="normal"
            value={newClient.emailAddress}
            onChange={(e) =>
              setNewClient({ ...newClient, emailAddress: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Room/Floor/Block"
            margin="normal"
            value={newClient.addressLine1}
            onChange={(e) =>
              setNewClient({ ...newClient, addressLine1: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Building Name"
            margin="normal"
            value={newClient.addressLine2}
            onChange={(e) =>
              setNewClient({ ...newClient, addressLine2: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="Street Name"
            margin="normal"
            value={newClient.addressLine3}
            onChange={(e) =>
              setNewClient({ ...newClient, addressLine3: e.target.value })
            }
          />
          <TextField
            fullWidth
            label="District"
            margin="normal"
            value={newClient.addressLine4}
            onChange={(e) =>
              setNewClient({ ...newClient, addressLine4: e.target.value })
            }
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="region-add-label">Region</InputLabel>
            <Select
              labelId="region-add-label"
              value={newClient.addressLine5}
              label="Region"
              onChange={(e) =>
                setNewClient({ ...newClient, addressLine5: e.target.value })
              }
            >
              <MenuItem value="Kowloon">Kowloon</MenuItem>
              <MenuItem value="Hong Kong">Hong Kong</MenuItem>
              <MenuItem value="New Territories">New Territories</MenuItem>
            </Select>
          </FormControl>
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
  console.log('Session in getServerSideProps:', session);

  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin/google', permanent: false },
    };
  }

  try {
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken });
    const referenceLogId = await findPMSReferenceLogFile(drive);
    const companies = await fetchAddressBook(sheets, referenceLogId);

    return { props: { companies } };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return {
      props: {
        companies: [],
        error: err.message || 'Error fetching clients',
      },
    };
  }
};
