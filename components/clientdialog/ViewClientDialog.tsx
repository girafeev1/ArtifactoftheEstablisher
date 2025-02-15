// components/clientdialog/ViewClientDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
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

interface ViewClientDialogProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  onEdit: () => void; // Trigger switching to edit mode
}

export default function ViewClientDialog({
  open,
  onClose,
  client,
  onEdit,
}: ViewClientDialogProps) {
  if (!client) return null;

  // Helper: Render a line only if value is present.
  const renderLine = (value?: string) =>
    value && value.trim() ? (
      <Typography variant="body2">{value}</Typography>
    ) : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Client Information</DialogTitle>
      <DialogContent dividers>
        {/* Company Name in a larger font */}
        {client.companyName && (
          <Typography variant="h5" gutterBottom>
            {client.companyName}
          </Typography>
        )}
        <Typography variant="subtitle1" gutterBottom>
          Address:
        </Typography>
        {renderLine(client.addressLine1)}
        {renderLine(client.addressLine2)}
        {renderLine(client.addressLine3)}
        {(client.addressLine4 || client.addressLine5) && (
          <Typography variant="body2">
            {(client.addressLine4 ? client.addressLine4 : '')}
            {client.addressLine4 && client.addressLine5 ? ', ' : ''}
            {client.addressLine5 ? client.addressLine5 : ''}
          </Typography>
        )}
        <Typography variant="body2">Hong Kong</Typography>
        <Box mt={1}>
        <Typography variant="subtitle1" gutterBottom>
          Contact:
        </Typography>
          {(client.title || client.nameAddressed) && (
            <Typography variant="body2">
              {client.title} {client.nameAddressed}
            </Typography>
          )}
          {(client.emailAddress || client.phone) && (
            <Typography variant="body2">
              {client.emailAddress} {client.phone}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onEdit}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
