// components/clientdialog/ViewClientDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';

interface ViewClientDialogProps {
  open: boolean;
  client: {
    documentId: string;
    companyName: string;
    title: string;
    representative: string;
    emailAddress: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    addressLine3: string;
    addressLine4: string;
    addressLine5: string;
  };
  onClose: () => void;
}

const ViewClientDialog: React.FC<ViewClientDialogProps> = ({ open, client, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Client Details</DialogTitle>
      <DialogContent>
        <Typography variant="h6">{client.companyName}</Typography>
        <Typography>
          {client.title} {client.representative}
        </Typography>

interface ViewClientDialogProps {
  open: boolean;
  onClose: () => void;
  client: ClientDetails | null;
  onEdit: () => void;
}

export default function ViewClientDialog({
  open,
  onClose,
  client,
  onEdit,
}: ViewClientDialogProps) {
  if (!client) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Client Details</DialogTitle>
      <DialogContent dividers>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {client.companyName}
        </Typography>
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Contact
        </Typography>
        <Typography variant="body2">
          {client.title} {client.nameAddressed}
        </Typography>
        {client.emailAddress && (
          <Typography variant="body2">{client.emailAddress}</Typography>
        )}
        <Typography variant="subtitle1" sx={{ mt: 1 }}>
          Address:
        </Typography>
        {client.addressLine1 && <Typography variant="body2">{client.addressLine1}</Typography>}
        {client.addressLine2 && <Typography variant="body2">{client.addressLine2}</Typography>}
        {client.addressLine3 && <Typography variant="body2">{client.addressLine3}</Typography>}
        {client.addressLine4 && <Typography variant="body2">{client.addressLine4}</Typography>}
        {client.addressLine5 && <Typography variant="body2">{client.addressLine5}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={onEdit}>Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
