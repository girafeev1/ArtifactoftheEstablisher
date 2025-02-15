// components/NewClientDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  onSubmitted: () => void; // triggers after successful creation
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

  function handleChange(key: keyof Client, value: string) {
    setNewClient((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
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
      alert(Failed: ${err.message});
    }
  }

  function handleClose() {
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth>
      <DialogTitle>Add New Client</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          label="Company Name"
          margin="normal"
          value={newClient.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
        />
        <Grid container spacing={2}>
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
              fullWidth
              label="Name Addressed"
              margin="normal"
              value={newClient.nameAddressed}
              onChange={(e) => handleChange('nameAddressed', e.target.value)}
            />
          </Grid>
        </Grid>
        <TextField
          fullWidth
          label="Email Address"
          margin="normal"
          value={newClient.emailAddress}
          onChange={(e) => handleChange('emailAddress', e.target.value)}
        />
        <TextField
          fullWidth
          label="Room/ Floor/ Block"
          margin="normal"
          value={newClient.addressLine1}
          onChange={(e) => handleChange('addressLine1', e.target.value)}
        />
        <TextField
          fullWidth
          label="Building Name"
          margin="normal"
          value={newClient.addressLine2}
          onChange={(e) => handleChange('addressLine2', e.target.value)}
        />
        <TextField
          fullWidth
          label="Street Name"
          margin="normal"
          value={newClient.addressLine3}
          onChange={(e) => handleChange('addressLine3', e.target.value)}
        />
        <TextField
          fullWidth
          label="District"
          margin="normal"
          value={newClient.addressLine4}
          onChange={(e) => handleChange('addressLine4', e.target.value)}
        />
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
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}>
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
