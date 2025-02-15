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
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl?: string | null;
}
interface ViewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  onEdit: () => void;
  onCreateInvoice?: () => void;
  bankAccounts?: BankAccount[];
  fileId: string;
}

export default function ViewProjectDialog({
  open,
  onClose,
  project,
  onEdit,
  onCreateInvoice,
  bankAccounts = [],
  fileId,
}: ViewProjectDialogProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const matchedBank = useMemo(() => {
    if (!project.bankAccountIdentifier || !bankAccounts.length) return null;
    const id = project.bankAccountIdentifier.trim().toUpperCase();
    return bankAccounts.find(b => (b.identifier || '').trim().toUpperCase() === id) || null;
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
    if (onCreateInvoice) onCreateInvoice();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>View Project</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h5" gutterBottom>{project.projectNumber}</Typography>
        <Typography variant="subtitle1" gutterBottom>Project Date: {project.projectDate}</Typography>
        <Typography variant="body2"><strong>Agent:</strong> {project.agent}</Typography>
        <Typography variant="body2"><strong>Invoice Company:</strong> {project.invoiceCompany}</Typography>
        <Typography variant="body2"><strong>Project Title:</strong> {project.projectTitle}</Typography>
        <Typography variant="body2"><strong>Project Nature:</strong> {project.projectNature}</Typography>
        <Typography variant="body2"><strong>Amount:</strong> {project.amount}</Typography>
        <Typography variant="body2"><strong>Paid:</strong> {project.paid === 'TRUE' ? 'Yes' : 'No'}</Typography>
        {project.paid === 'TRUE' && (
          <>
            <Typography variant="body2"><strong>Paid On Date:</strong> {project.paidOnDate}</Typography>
            {matchedBank && (
              <Typography variant="body2">
                <strong>Paid To:</strong> {matchedBank.bankName} – {matchedBank.accountType}
              </Typography>
            )}
          </>
        )}
        {project.invoice ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              <strong>Invoice:</strong> {project.invoice} {project.invoiceUrl && '(Hyperlink: see Google Sheets)'}
            </Typography>
            <IconButton onClick={handleViewClick} size="small">
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
              <MenuItem onClick={handleViewPdf}>View PDF</MenuItem>
            </Menu>
          </Box>
        ) : (
          onCreateInvoice && (
            <Box sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={handleCreateInvoice}>
                Create Invoice
              </Button>
            </Box>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onEdit}>Edit</Button>
      </DialogActions>
    </Dialog>
  );
}
