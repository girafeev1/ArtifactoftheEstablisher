// components/clientdialog/NewClientDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid
} from '@mui/material';

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

interface NewClientDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function NewClientDialog({
  open,
  onClose,
  onSubmitted,
}: NewClientDialogProps) {
  const [newClient, setNewClient] = useState<Client>({
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

  function handleChange<K extends keyof Client>(key: K, value: string) {
    setNewClient(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmitNewClient() {
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
      // Fix: Use backticks so that the template literal is parsed correctly.
      alert(`Failed: ${err.message}`);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Add New Client</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Company Name"
              value={newClient.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Title"
              value={newClient.title}
              onChange={(e) => handleChange('title', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Name Addressed"
              value={newClient.nameAddressed}
              onChange={(e) => handleChange('nameAddressed', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Email Address"
              value={newClient.emailAddress}
              onChange={(e) => handleChange('emailAddress', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address Line 1"
              value={newClient.addressLine1}
              onChange={(e) => handleChange('addressLine1', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address Line 2"
              value={newClient.addressLine2}
              onChange={(e) => handleChange('addressLine2', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address Line 3"
              value={newClient.addressLine3}
              onChange={(e) => handleChange('addressLine3', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address Line 4"
              value={newClient.addressLine4}
              onChange={(e) => handleChange('addressLine4', e.target.value)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address Line 5"
              value={newClient.addressLine5}
              onChange={(e) => handleChange('addressLine5', e.target.value)}
              margin="normal"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmitNewClient}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
