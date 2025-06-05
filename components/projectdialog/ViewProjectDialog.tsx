// components/invoicedialog/ViewProjectDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  Box,
  Divider,
  Checkbox,
  Menu,
  MenuItem,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';

export interface ProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  presenterWorkType: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl?: string;
}

interface ViewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCreateInvoice: () => void;
  project: ProjectData;
  formattedAmount: string;
  matchedBank: { bankName: string; accountType: string } | null;
  anchorEl: HTMLElement | null;
  setAnchorEl: (el: HTMLElement | null) => void;
  handleViewPdf: () => void;
}

export default function ViewProjectDialog({
  open,
  onClose,
  onEdit,
  onCreateInvoice,
  project,
  formattedAmount,
  matchedBank,
  anchorEl,
  setAnchorEl,
  handleViewPdf,
}: ViewProjectDialogProps) {
  const menuOpen = Boolean(anchorEl);

  const internalHandleViewPdf = () => {
    setAnchorEl(null);
    console.log('ViewProjectDialog: invoiceUrl =', project.invoiceUrl);
    if (project.invoiceUrl) {
      window.open(project.invoiceUrl, '_blank');
    } else {
      alert('No invoice URL attached.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle1">{project.projectNumber}</Typography>
        <Typography variant="subtitle1">{project.invoiceCompany}</Typography>
        <Typography variant="subtitle1">{project.presenterWorkType}</Typography>
        <Typography variant="h4">{project.projectTitle}</Typography>
        <Typography variant="body2"> - {project.projectNature}</Typography>
        <Divider />
        <Typography variant="body2">
          <strong>Project Pickup Date:</strong> {project.projectDate || 'Not set'}
        </Typography>
        <Typography variant="body2">
          <strong>Amount:</strong> {formattedAmount}
        </Typography>
        <Typography variant="body2">
          <strong>Paid:</strong>{' '}
          <Checkbox
            checked={project.paid === 'TRUE'}
            icon={<CloseIcon />}
            checkedIcon={<CheckIcon />}
            disabled
          />
        </Typography>
        {project.paid === 'TRUE' && project.paidOnDate && (
          <Typography variant="body2">
            <strong>Paid On:</strong> {project.paidOnDate}
          </Typography>
        )}
        {matchedBank && (
          <Typography variant="body2">
            <strong>Pay to:</strong> {matchedBank.bankName} – {matchedBank.accountType}
          </Typography>
        )}
        <Divider />
        {project.invoice || project.invoiceUrl ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              <strong>Invoice:</strong>{' '}
              {project.invoiceUrl ? (
                <a href={project.invoiceUrl} target="_blank" rel="noopener noreferrer">
                  {project.invoice || project.invoiceUrl}
                </a>
              ) : (
                project.invoice
              )}
            </Typography>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={internalHandleViewPdf}>View PDF</MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={onCreateInvoice}>
              Create Invoice
            </Button>
          </Box>
        )}
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
