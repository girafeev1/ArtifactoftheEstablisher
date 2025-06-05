// components/clientdialog/NewClientDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';

export interface Client {
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

interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function NewClientDialog({ open, onClose, onSubmitted }: NewClientDialogProps) {
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

  const handleChange = (key: keyof Client, value: string) => {
    setNewClient((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    try {
      const resp = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: newClient }),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to add client');
      }
      alert('New client added successfully');
      onSubmitted();
      onClose();
    } catch (err: any) {
      console.error('[handleSubmitNewClient] error:', err);
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Add New Client</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Company Name"
              fullWidth
              margin="normal"
              value={newClient.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Title</InputLabel>
              <Select
                value={newClient.title}
                label="Title"
                onChange={(e) => handleChange('title', e.target.value)}
              >
                <MenuItem value="Mr.">Mr.</MenuItem>
                <MenuItem value="Mrs.">Mrs.</MenuItem>
                <MenuItem value="Ms.">Ms.</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Name Addressed"
              fullWidth
              margin="normal"
              value={newClient.nameAddressed}
              onChange={(e) => handleChange('nameAddressed', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Email Address"
              fullWidth
              margin="normal"
              value={newClient.emailAddress}
              onChange={(e) => handleChange('emailAddress', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 1"
              fullWidth
              margin="normal"
              value={newClient.addressLine1}
              onChange={(e) => handleChange('addressLine1', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 2"
              fullWidth
              margin="normal"
              value={newClient.addressLine2}
              onChange={(e) => handleChange('addressLine2', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 3"
              fullWidth
              margin="normal"
              value={newClient.addressLine3}
              onChange={(e) => handleChange('addressLine3', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 4"
              fullWidth
              margin="normal"
              value={newClient.addressLine4}
              onChange={(e) => handleChange('addressLine4', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Region</InputLabel>
              <Select
                value={newClient.addressLine5}
                label="Region"
                onChange={(e) => handleChange('addressLine5', e.target.value)}
              >
                <MenuItem value="Kowloon">Kowloon</MenuItem>
                <MenuItem value="Hong Kong">Hong Kong</MenuItem>
                <MenuItem value="New Territories">New Territories</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
