// components/ViewProjectDialog.tsx

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Box
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface ProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
}

interface ViewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  onToggleEdit: () => void;
  onCreateInvoice?: () => void;
}

export default function ViewProjectDialog({
  open,
  onClose,
  project,
  onToggleEdit,
  onCreateInvoice,
}: ViewProjectDialogProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  function handleViewClick(e: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(e.currentTarget);
  }
  function handleMenuClose() {
    setAnchorEl(null);
  }
  function handleViewPdf() {
    handleMenuClose();
    if (!project.invoice) {
      alert('No invoice link is set!');
      return;
    }
    // open the link in new tab
    window.open(project.invoice, '_blank');
  }
  function handleCreateInvoice() {
    if (onCreateInvoice) {
      onCreateInvoice();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>View Project</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2">
          <strong>Project Number:</strong> {project.projectNumber}
        </Typography>
        <Typography variant="body2">
          <strong>Project Date:</strong> {project.projectDate}
        </Typography>
        <Typography variant="body2">
          <strong>Agent:</strong> {project.agent}
        </Typography>
        <Typography variant="body2">
          <strong>Invoice Company:</strong> {project.invoiceCompany}
        </Typography>
        <Typography variant="body2">
          <strong>Project Title:</strong> {project.projectTitle}
        </Typography>
        <Typography variant="body2">
          <strong>Project Nature:</strong> {project.projectNature}
        </Typography>
        <Typography variant="body2">
          <strong>Amount:</strong> {project.amount}
        </Typography>
        <Typography variant="body2">
          <strong>Paid:</strong> {project.paid === 'TRUE' ? 'Yes' : 'No'}
        </Typography>
        {project.paid === 'TRUE' && (
          <Typography variant="body2">
            <strong>Paid On Date:</strong> {project.paidOnDate}
          </Typography>
        )}

        {/* Invoice */}
        {project.invoice ? (
          <Box>
            <Typography variant="body2">
              <strong>Invoice:</strong> {project.invoice}
            </Typography>
            <IconButton onClick={handleViewClick} size="small">
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
              <MenuItem onClick={handleViewPdf}>View PDF</MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2">Invoice Number:</Typography>
            <Button variant="outlined" sx={{ mt: 1 }} onClick={handleCreateInvoice}>
              Create Invoice
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onToggleEdit}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
