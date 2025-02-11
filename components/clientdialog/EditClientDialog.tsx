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

interface EditClientDialogProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  onClientChange: (updated: Client) => void; // pass changes upward
  onSave: () => void; // parent triggers actual save
  onDelete?: () => void;
}

export default function EditClientDialog({
  open,
  onClose,
  client,
  onClientChange,
  onSave,
  onDelete,
}: EditClientDialogProps) {
  if (!client) return null;

  function handleChange<K extends keyof Client>(key: K, value: string) {
    onClientChange({ ...client, [key]: value });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Edit Client Info</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          label="Company Name"
          margin="normal"
          value={client.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
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
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Name Addressed"
              margin="normal"
              value={client.nameAddressed}
              onChange={(e) => handleChange('nameAddressed', e.target.value)}
            />
          </Grid>
        </Grid>
        <TextField
          fullWidth
          label="Email Address"
          margin="normal"
          value={client.emailAddress}
          onChange={(e) => handleChange('emailAddress', e.target.value)}
        />
        <TextField
          fullWidth
          label="Room/ Floor/ Block"
          margin="normal"
          value={client.addressLine1}
          onChange={(e) => handleChange('addressLine1', e.target.value)}
        />
        <TextField
          fullWidth
          label="Building Name"
          margin="normal"
          value={client.addressLine2}
          onChange={(e) => handleChange('addressLine2', e.target.value)}
        />
        <TextField
          fullWidth
          label="Street Name"
          margin="normal"
          value={client.addressLine3}
          onChange={(e) => handleChange('addressLine3', e.target.value)}
        />
        <TextField
          fullWidth
          label="District"
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
          <Button color="error" onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
