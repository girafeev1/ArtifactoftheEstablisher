// components/clientdialog/EditClientDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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

interface EditClientDialogProps {
  open: boolean;
  client: Client;
  onClientChange: (client: Client) => void;
  onSave: (client: Client) => Promise<void>;
  onDelete?: (client: Client) => Promise<void>;
  onClose: () => void;
}

export default function EditClientDialog({
  open,
  client,
  onClientChange,
  onSave,
  onDelete,
  onClose,
}: EditClientDialogProps) {
  if (!client) return null;

  const handleChange = (key: keyof Client, value: string) => {
    onClientChange({ ...client, [key]: value });
  };

  const handleSave = async () => {
    await onSave(client);
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(client);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Edit Client Information</DialogTitle>
      <DialogContent dividers>
        <TextField
          label="Company Name"
          fullWidth
          margin="normal"
          value={client.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
        />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Title</InputLabel>
              <Select
                value={client.title}
                label="Title"
                onChange={(e) => handleChange('title', e.target.value)}
              >
                <MenuItem value="Mr.">Mr.</MenuItem>
                <MenuItem value="Mrs.">Mrs.</MenuItem>
                <MenuItem value="Ms.">Ms.</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Name Addressed"
              fullWidth
              margin="normal"
              value={client.nameAddressed}
              onChange={(e) => handleChange('nameAddressed', e.target.value)}
            />
          </Grid>
        </Grid>
        <TextField
          label="Email Address"
          fullWidth
          margin="normal"
          value={client.emailAddress}
          onChange={(e) => handleChange('emailAddress', e.target.value)}
        />
        <TextField
          label="Address Line 1"
          fullWidth
          margin="normal"
          value={client.addressLine1}
          onChange={(e) => handleChange('addressLine1', e.target.value)}
        />
        <TextField
          label="Address Line 2"
          fullWidth
          margin="normal"
          value={client.addressLine2}
          onChange={(e) => handleChange('addressLine2', e.target.value)}
        />
        <TextField
          label="Address Line 3"
          fullWidth
          margin="normal"
          value={client.addressLine3}
          onChange={(e) => handleChange('addressLine3', e.target.value)}
        />
        <TextField
          label="Address Line 4"
          fullWidth
          margin="normal"
          value={client.addressLine4}
          onChange={(e) => handleChange('addressLine4', e.target.value)}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Region</InputLabel>
          <Select
            value={client.addressLine5}
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
        {onDelete && (
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
