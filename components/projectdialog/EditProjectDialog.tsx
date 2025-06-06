// components/projectdialog/EditProjectDialog.tsx

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Checkbox,
  Menu,
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

export interface ProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  presenter: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
  invoiceUrl?: string;
}

interface EditProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: ProjectData;
  setProject: (project: ProjectData) => void;
  bankAccounts: BankAccount[];
  companyNameOfFile?: string;
  isPaid: boolean;
  selectedBank: string;
  setSelectedBank: (value: string) => void;
  selectedAccountType: string;
  setSelectedAccountType: (value: string) => void;
  anchorEl: HTMLElement | null;
  setAnchorEl: (el: HTMLElement | null) => void;
  handleViewPdf: () => void;
  handleOpenSheet: () => void;
  handleCreateInvoice: () => void;
  handleSave: () => void;
  handleDelete: () => void;
  fileId: string;
}

export default function EditProjectDialog({
  open,
  onClose,
  project,
  setProject,
  bankAccounts,
  companyNameOfFile,
  isPaid,
  selectedBank,
  setSelectedBank,
  selectedAccountType,
  setSelectedAccountType,
  anchorEl,
  setAnchorEl,
  handleViewPdf,
  handleOpenSheet,
  handleCreateInvoice,
  handleSave,
  handleDelete,
  fileId,
}: EditProjectDialogProps) {
  console.log('[EditProjectDialog] fileId prop:', fileId);
  const menuOpen = Boolean(anchorEl);
  const safeBankAccounts = companyNameOfFile
    ? bankAccounts.filter((ba) => ba.companyName === companyNameOfFile)
    : bankAccounts;

  React.useEffect(() => {
    console.log('EditProjectDialog: project.bankAccountIdentifier =', project.bankAccountIdentifier);
    if (project.bankAccountIdentifier && !selectedBank && !selectedAccountType) {
      const match = bankAccounts.find(
        (ba) => (ba.identifier || '').trim().toUpperCase() === project.bankAccountIdentifier.trim().toUpperCase()
      );
      console.log('EditProjectDialog: Matching bank account =', match);
      if (match) {
        setSelectedBank(match.bankName);
        setSelectedAccountType(match.accountType);
      }
    }
  }, [project.bankAccountIdentifier, bankAccounts, selectedBank, selectedAccountType, setSelectedBank, setSelectedAccountType]);

  const internalHandleViewPdf = () => {
    setAnchorEl(null);
    console.log('internalHandleViewPdf: invoiceUrl =', project.invoiceUrl);
    if (project.invoiceUrl) {
      window.open(project.invoiceUrl, '_blank');
    } else {
      alert('No invoice URL attached.');
    }
  };

  const handleSaveInternal = async () => {
    console.log('[EditProjectDialog] handleSaveInternal invoked, fileId:', fileId);
    const initialProject = { ...project }; // Snapshot of initial state
    if (project.paid === 'TRUE' && !project.paidOnDate) {
      alert('Paid On Date is required if paid=TRUE');
      return;
    }
    if (project.paid === 'TRUE' && !project.bankAccountIdentifier.trim()) {
      alert('Select Paid To (Bank + Account Type)');
      return;
    }
    try {
      const payload = {
        originalIdentifier: initialProject.projectNumber || project.projectNumber,
        projectNumber: project.projectNumber,
        projectDate: project.projectDate,
        agent: project.agent,
        invoiceCompany: project.invoiceCompany,
        presenter: project.presenter,
        projectTitle: project.projectTitle,
        projectNature: project.projectNature,
        amount: project.amount,
        paid: project.paid,
        paidOnDate: project.paidOnDate,
        bankAccountIdentifier: project.bankAccountIdentifier,
        invoice: project.invoice !== initialProject.invoice ? project.invoice : initialProject.invoice,
      };
      console.log('[EditProjectDialog] Sending payload:', payload);
      const resp = await fetch(`/api/businesses/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      console.log('[EditProjectDialog] Response status:', resp.status);
      if (!resp.ok) {
        const txt = await resp.text();
        console.error('[EditProjectDialog] Error response:', txt);
        throw new Error(txt);
      }
      alert('Project updated successfully');
      handleSave();
    } catch (err: any) {
      console.error('[EditProjectDialog] handleSave error:', err);
      alert(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit Project | {project.projectNumber} |
        {project.presenter ? `${project.presenter} - ` : ''}
        {project.projectTitle}
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Project Number"
          value={project.projectNumber}
          onChange={(e) => setProject({ ...project, projectNumber: e.target.value })}
          fullWidth
        />
        <TextField
          label="Presenter / Work Type"
          value={project.presenter}
          onChange={(e) => setProject({ ...project, presenter: e.target.value })}
          fullWidth
        />
        <TextField
          label="Project Title"
          value={project.projectTitle}
          onChange={(e) => setProject({ ...project, projectTitle: e.target.value })}
          fullWidth
        />
        <TextField
          label="Project Nature"
          value={project.projectNature}
          onChange={(e) => setProject({ ...project, projectNature: e.target.value })}
          fullWidth
        />
        <TextField
          label="Project Date"
          type="date"
          value={project.projectDate || ''}
          onChange={(e) => setProject({ ...project, projectDate: e.target.value })}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Invoice Company"
          value={project.invoiceCompany}
          onChange={(e) => setProject({ ...project, invoiceCompany: e.target.value })}
          fullWidth
        />
        <TextField
          label="Presenter / Work Type"
          value={project.presenterWorkType}
          onChange={(e) => setProject({ ...project, presenterWorkType: e.target.value })}
          fullWidth
        />
        <TextField
          label="Agent"
          value={project.agent}
          onChange={(e) => setProject({ ...project, agent: e.target.value })}
          fullWidth
        />
        <TextField
          label="Amount"
          type="number"
          value={project.amount}
          onChange={(e) => setProject({ ...project, amount: e.target.value })}
          fullWidth
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ mr: 1 }}>Paid:</Typography>
          <Checkbox
            checked={isPaid}
            onChange={(e) =>
              setProject({
                ...project,
                paid: e.target.checked ? 'TRUE' : 'FALSE',
                paidOnDate: e.target.checked ? project.paidOnDate : '',
              })
            }
          />
        </Box>
        {isPaid && (
          <>
            <TextField
              label="Paid On Date"
              type="date"
              value={project.paidOnDate}
              onChange={(e) => setProject({ ...project, paidOnDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel id="bank-name-label" shrink>Paid To (Bank Name)</InputLabel>
                <Select
                  labelId="bank-name-label"
                  value={selectedBank}
                  label="Paid To (Bank Name)"
                  onChange={(e) => {
                    setSelectedBank(e.target.value as string);
                    setSelectedAccountType('');
                    const row = bankAccounts.find((b) => b.bankName === e.target.value);
                    console.log('On bank change, found row:', row);
                    if (row) {
                      setProject({ ...project, bankAccountIdentifier: row.identifier || '' });
                    }
                  }}
                  displayEmpty
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value="" disabled>
                    -- Choose Bank --
                  </MenuItem>
                  {[...new Set(safeBankAccounts.map((ba) => ba.bankName))].map((bn) => (
                    <MenuItem key={bn} value={bn}>
                      {bn}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!selectedBank}>
                <InputLabel id="account-type-label" shrink>Account Type</InputLabel>
                <Select
                  labelId="account-type-label"
                  value={selectedAccountType}
                  label="Account Type"
                  onChange={(e) => {
                    setSelectedAccountType(e.target.value as string);
                    const row = bankAccounts.find(
                      (b) => b.bankName === selectedBank && b.accountType === e.target.value
                    );
                    console.log('On account type change, found row:', row);
                    if (row) {
                      setProject({ ...project, bankAccountIdentifier: row.identifier || '' });
                    }
                  }}
                  displayEmpty
                  MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
                >
                  <MenuItem value="" disabled>
                    -- Choose Account Type --
                  </MenuItem>
                  {[...new Set(
                    safeBankAccounts.filter((ba) => ba.bankName === selectedBank).map((ba) => ba.accountType)
                  )].map((acct) => (
                    <MenuItem key={acct} value={acct}>
                      {acct}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </>
        )}
        <Box>
          <Typography variant="subtitle2">Invoice Number:</Typography>
          {project.invoice ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body1" sx={{ mr: 1 }}>
                {project.invoice}
              </Typography>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={internalHandleViewPdf}>View PDF</MenuItem>
                <MenuItem onClick={handleOpenSheet}>Open Sheet</MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button variant="contained" color="primary" onClick={handleCreateInvoice}>
              Create Invoice
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={handleDelete}>
          Delete
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSaveInternal}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
