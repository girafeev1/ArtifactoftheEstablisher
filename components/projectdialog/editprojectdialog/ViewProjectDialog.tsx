// components/projectdialog/editprojectdialog/ViewProjectDialog.tsx

import React, { useState, useMemo } from 'react';
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
  Box,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface BankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  comments?: string;
  identifier?: string;
}

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
  bankAccountIdentifier: string; // Contains the identifier for Paid To
  invoice: string; // Display text for invoice
  invoiceUrl?: string | null; // Hyperlink if present (or null)
}

interface ViewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  onToggleEdit: () => void;
  onCreateInvoice?: () => void;
  bankAccounts?: BankAccount[];
  fileId: string; // used for editing invoice via API
}

export default function ViewProjectDialog({
  open,
  onClose,
  project,
  onToggleEdit,
  onCreateInvoice,
  bankAccounts = [],
  fileId,
}: ViewProjectDialogProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Look up the bank account matching the project.bankAccountIdentifier.
  const matchedBank = useMemo(() => {
    if (!project.bankAccountIdentifier) return null;
    return bankAccounts.find(
      (b) => b.identifier === project.bankAccountIdentifier
    );
  }, [bankAccounts, project.bankAccountIdentifier]);

  function handleViewClick(e: React.MouseEvent<HTMLButtonElement>) {
    setAnchorEl(e.currentTarget);
  }
  function handleMenuClose() {
    setAnchorEl(null);
  }
  function handleViewPdf() {
    handleMenuClose();
    if (!project.invoice && !project.invoiceUrl) {
      alert('No invoice link is set!');
      return;
    }
    window.open(project.invoiceUrl || project.invoice, '_blank');
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
        {/* Show "Paid To" only if a matching bank was found */}
        {matchedBank && (
          <Typography variant="body2">
            <strong>Paid To:</strong> {matchedBank.bankName} - {matchedBank.accountType}
          </Typography>
        )}

        {/* Invoice field */}
        {project.invoice ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
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
          // If no invoice number is fetched, show a Create Invoice button independently.
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={handleCreateInvoice}>
              Create Invoice
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onToggleEdit}>Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
