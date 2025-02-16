// components/projectdialog/editprojectdialog/EditProjectDialog.tsx

import React, { useState, useEffect } from 'react';
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
  invoiceUrl?: string;
}

interface EditProjectDialogProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  project: ProjectData | null;
  setProject: React.Dispatch<React.SetStateAction<ProjectData | null>>;
  onUpdated: () => void;
  bankAccounts?: BankAccount[];
  companyNameOfFile?: string;
  onToggleEdit?: () => void;
  onCreateInvoice?: (proj: ProjectData) => void;
}

export default function EditProjectDialog({
  open,
  onClose,
  fileId,
  project,
  setProject,
  onUpdated,
  bankAccounts = [],
  companyNameOfFile,
  onToggleEdit,
  onCreateInvoice,
}: EditProjectDialogProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // If there's no project, render nothing.
  if (!project) return null;

  // Filter bank accounts by the company name (if provided).
  const safeBankAccounts = companyNameOfFile
    ? bankAccounts.filter((ba) => ba.companyName === companyNameOfFile)
    : bankAccounts;

  const isPaid = project.paid === 'TRUE';

  // Local state for dropdown selections and a flag to mark when the user has manually edited the dropdown.
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');
  const [userBankEdited, setUserBankEdited] = useState(false);

  // On mount (or when project.bankAccountIdentifier or safeBankAccounts change),
  // if the user hasn’t yet changed the dropdowns manually, initialize them from the project.
  useEffect(() => {
    if (userBankEdited) return;
    console.log('[EditProjectDialog] safeBankAccounts =>', safeBankAccounts);
    if (!project.bankAccountIdentifier.trim() || safeBankAccounts.length === 0) {
      setSelectedBank('');
      setSelectedAccountType('');
      return;
    }
    const normalizedIdentifier = project.bankAccountIdentifier.trim().toUpperCase();
    const match = safeBankAccounts.find(
      (ba) => (ba.identifier || '').trim().toUpperCase() === normalizedIdentifier
    );
    if (match) {
      setSelectedBank(match.bankName);
      setSelectedAccountType(match.accountType);
      console.log('[EditProjectDialog] matched bank =>', match);
    } else {
      console.log('[EditProjectDialog] no match =>', project.bankAccountIdentifier);
      setSelectedBank('');
      setSelectedAccountType('');
    }
  }, [project.bankAccountIdentifier, safeBankAccounts, userBankEdited]);

  function handleCheckboxChange(checked: boolean) {
    setProject((prev) =>
      prev
        ? {
            ...prev,
            paid: checked ? 'TRUE' : 'FALSE',
            paidOnDate: checked ? prev.paidOnDate : '',
            bankAccountIdentifier: checked ? prev.bankAccountIdentifier : '',
          }
        : prev
    );
    if (!checked) {
      setSelectedBank('');
      setSelectedAccountType('');
      setUserBankEdited(false);
    }
  }

  function handleChangeBank(e: React.ChangeEvent<{ value: unknown }>) {
    const newBank = e.target.value as string;
    setSelectedBank(newBank);
    setSelectedAccountType('');
    setUserBankEdited(true);
    // Clear the project's bankAccountIdentifier until an account type is selected.
    setProject((prev) => (prev ? { ...prev, bankAccountIdentifier: '' } : prev));
  }

  function handleChangeAccountType(e: React.ChangeEvent<{ value: unknown }>) {
    const newType = e.target.value as string;
    setSelectedAccountType(newType);
    setUserBankEdited(true);
    const row = safeBankAccounts.find(
      (b) => b.bankName === selectedBank && b.accountType === newType
    );
    setProject((prev) =>
      prev ? { ...prev, bankAccountIdentifier: row?.identifier || '' } : prev
    );
  }

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
  async function handleEditInvoice() {
    handleMenuClose();
    if (!project.invoice) {
      alert('No invoice number found!');
      return;
    }
    try {
      const title = encodeURIComponent(project.invoice);
      const res = await fetch(`/api/invoices/gid?fileId=${fileId}&title=${title}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Unable to fetch invoice GID');
      }
      const data = await res.json();
      const gid = data.sheetId;
      if (!gid) {
        alert(`No sheet named "${project.invoice}" found.`);
        return;
      }
      const googleSheetUrl = `https://docs.google.com/spreadsheets/d/${fileId}/edit#gid=${gid}`;
      window.open(googleSheetUrl, '_blank');
    } catch (err: any) {
      console.error('[EditProjectDialog] handleEditInvoice =>', err);
      alert(err.message);
    }
  }

  function handleCreateInvoice() {
    console.log('[EditProjectDialog] user clicked createInvoice =>', project);
    if (onCreateInvoice) onCreateInvoice(project);
  }

  async function handleSave() {
    if (isPaid && !project.paidOnDate) {
      alert('Paid On Date is required if paid=TRUE');
      return;
    }
    if (isPaid && !project.bankAccountIdentifier.trim()) {
      alert('Select Paid To (Bank + Account Type)');
      return;
    }
    try {
      console.log('[EditProjectDialog] handleSave => saving =>', project);
      const payload = {
        originalIdentifier: project.projectNumber,
        projectNumber: project.projectNumber,
        projectDate: project.projectDate,
        agent: project.agent,
        invoiceCompany: project.invoiceCompany,
        projectTitle: project.projectTitle,
        projectNature: project.projectNature,
        amount: project.amount,
        paid: project.paid,
        paidOnDate: project.paidOnDate,
        bankAccountIdentifier: project.bankAccountIdentifier,
        invoice: project.invoice,
      };
      const resp = await fetch(`/api/projects/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      alert('Project updated successfully');
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('[EditProjectDialog] handleSave => error =>', err);
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete project "${project.projectNumber}"?`)) return;
    try {
      const resp = await fetch(`/api/projects/${fileId}?identifier=${encodeURIComponent(project.projectNumber)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text);
      }
      alert('Deleted successfully');
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('[EditProjectDialog] handleDelete => error =>', err);
      alert(err.message);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Project Number"
          value={project.projectNumber}
          onChange={(e) => setProject(prev => prev ? { ...prev, projectNumber: e.target.value } : prev)}
          fullWidth
        />
        <TextField
          label="Project Date"
          type="date"
          value={project.projectDate}
          onChange={(e) => setProject(prev => prev ? { ...prev, projectDate: e.target.value } : prev)}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Agent"
          value={project.agent}
          onChange={(e) => setProject(prev => prev ? { ...prev, agent: e.target.value } : prev)}
          fullWidth
        />
        <TextField
          label="Invoice Company"
          value={project.invoiceCompany}
          onChange={(e) => setProject(prev => prev ? { ...prev, invoiceCompany: e.target.value } : prev)}
          fullWidth
        />
        <TextField
          label="Project Title"
          value={project.projectTitle}
          onChange={(e) => setProject(prev => prev ? { ...prev, projectTitle: e.target.value } : prev)}
          fullWidth
        />
        <TextField
          label="Project Nature"
          value={project.projectNature}
          onChange={(e) => setProject(prev => prev ? { ...prev, projectNature: e.target.value } : prev)}
          fullWidth
        />
        <TextField
          label="Amount"
          type="number"
          value={project.amount}
          onChange={(e) => setProject(prev => prev ? { ...prev, amount: e.target.value } : prev)}
          fullWidth
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ mr: 1 }}>Paid:</Typography>
          <Checkbox
            checked={isPaid}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
          />
        </Box>
        {isPaid && (
          <>
            <TextField
              label="Paid On Date"
              type="date"
              value={project.paidOnDate}
              onChange={(e) => setProject(prev => prev ? { ...prev, paidOnDate: e.target.value } : prev)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Paid To (Bank Name)</InputLabel>
                <Select
                  value={selectedBank}
                  label="Paid To (Bank Name)"
                  onChange={handleChangeBank}
                >
                  <MenuItem value="">
                    <em>-- Choose Bank --</em>
                  </MenuItem>
                  {[...new Set(safeBankAccounts.map(ba => ba.bankName))].map(bn => (
                    <MenuItem key={bn} value={bn}>{bn}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth disabled={!selectedBank}>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={selectedAccountType}
                  label="Account Type"
                  onChange={handleChangeAccountType}
                >
                  <MenuItem value="">
                    <em>-- Choose Account Type --</em>
                  </MenuItem>
                  {[...new Set(
                    safeBankAccounts
                      .filter(ba => ba.bankName === selectedBank)
                      .map(ba => ba.accountType)
                  )].map(acct => (
                    <MenuItem key={acct} value={acct}>{acct}</MenuItem>
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
              <IconButton onClick={handleViewClick} size="small">
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
                <MenuItem onClick={handleViewPdf}>View PDF</MenuItem>
                <MenuItem onClick={handleEditInvoice}>Edit Invoice</MenuItem>
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
        <Button color="error" onClick={handleDelete}>Delete</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onToggleEdit}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
