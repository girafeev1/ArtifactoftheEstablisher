// components/EditProjectDialog.tsx

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Button,
  IconButton,
  Menu
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
}: EditProjectDialogProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  if (!project) {
    console.log('[EditProjectDialog] no project => returning null');
    return null;
  }

  const safeSetProject = setProject; // for convenience
  const safeBankAccounts = companyNameOfFile
    ? bankAccounts.filter((ba) => ba.companyName === companyNameOfFile)
    : bankAccounts;

  const isPaid = project.paid === 'TRUE';

  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');

  // bridging bank account
  useEffect(() => {
    if (!project.bankAccountIdentifier) {
      setSelectedBank('');
      setSelectedAccountType('');
      return;
    }
    const match = safeBankAccounts.find(
      (ba) => ba.identifier === project.bankAccountIdentifier
    );
    if (match) {
      setSelectedBank(match.bankName);
      setSelectedAccountType(match.accountType);
    } else {
      setSelectedBank('');
      setSelectedAccountType('');
    }
  }, [project.bankAccountIdentifier, safeBankAccounts]);

  function handleCheckboxChange(checked: boolean) {
    safeSetProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paid: checked ? 'TRUE' : 'FALSE',
        paidOnDate: checked ? prev.paidOnDate : '',
        bankAccountIdentifier: checked ? prev.bankAccountIdentifier : '',
      };
    });
    if (!checked) {
      setSelectedBank('');
      setSelectedAccountType('');
    }
  }

  function handleChangeBank(e: React.ChangeEvent<{ value: unknown }>) {
    const newBank = e.target.value as string;
    setSelectedBank(newBank);
    setSelectedAccountType('');

    safeSetProject((prev) => {
      if (!prev) return prev;
      return { ...prev, bankAccountIdentifier: '' };
    });
  }

  function handleChangeAccountType(e: React.ChangeEvent<{ value: unknown }>) {
    const newType = e.target.value as string;
    setSelectedAccountType(newType);

    const row = safeBankAccounts.find(
      (ba) => ba.bankName === selectedBank && ba.accountType === newType
    );
    safeSetProject((prev) => {
      if (!prev) return prev;
      return { ...prev, bankAccountIdentifier: row?.identifier || '' };
    });
  }

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
    window.open(project.invoice, '_blank');
  }

  async function handleSave() {
    try {
      if (isPaid && !project.paidOnDate) {
        alert('Paid On Date required if paid=TRUE');
        return;
      }
      if (isPaid && !project.bankAccountIdentifier) {
        alert('Select Bank + Account Type');
        return;
      }
      console.log('[EditProjectDialog] saving =>', project);

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
        const text = await resp.text();
        throw new Error(text);
      }
      alert('Project updated successfully');
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('[EditProjectDialog] handleSave => error:', err);
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
        const txt = await resp.text();
        throw new Error(txt);
      }
      alert('Deleted successfully');
      onUpdated();
      onClose();
    } catch (err: any) {
      console.error('[EditProjectDialog] handleDelete => error:', err);
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
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, projectNumber: e.target.value }))
          }
          fullWidth
        />

        <TextField
          label="Project Date"
          type="date"
          value={project.projectDate}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, projectDate: e.target.value }))
          }
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Agent"
          value={project.agent}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, agent: e.target.value }))
          }
          fullWidth
        />

        <TextField
          label="Invoice Company"
          value={project.invoiceCompany}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, invoiceCompany: e.target.value }))
          }
          fullWidth
        />

        <TextField
          label="Project Title"
          value={project.projectTitle}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, projectTitle: e.target.value }))
          }
          fullWidth
        />

        <TextField
          label="Project Nature"
          value={project.projectNature}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, projectNature: e.target.value }))
          }
          fullWidth
        />

        <TextField
          label="Amount"
          type="number"
          value={project.amount}
          onChange={(e) =>
            safeSetProject((prev) => prev && ({ ...prev, amount: e.target.value }))
          }
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
              onChange={(e) =>
                safeSetProject((prev) => prev && ({ ...prev, paidOnDate: e.target.value }))
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Bank Name</InputLabel>
                <Select value={selectedBank} label="Bank Name" onChange={handleChangeBank}>
                  <MenuItem value="">
                    <em>-- Choose Bank --</em>
                  </MenuItem>
                  {[...new Set(safeBankAccounts.map((ba) => ba.bankName))].map((bn) => (
                    <MenuItem key={bn} value={bn}>
                      {bn}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={!selectedBank}>
                <InputLabel>Account Type</InputLabel>
                <Select value={selectedAccountType} label="Account Type" onChange={handleChangeAccountType}>
                  <MenuItem value="">
                    <em>-- Choose Account Type --</em>
                  </MenuItem>
                  {[...new Set(
                    safeBankAccounts
                      .filter((ba) => ba.bankName === selectedBank)
                      .map((ba) => ba.accountType)
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

        {/* Invoice */}
        {!project.invoice ? (
          <Box>
            <Typography variant="subtitle2">Invoice Number:</Typography>
            <Typography variant="body2">(none)</Typography>
          </Box>
        ) : (
          <Box>
            <Typography variant="subtitle2">Invoice Number:</Typography>
            <Typography variant="body1">{project.invoice}</Typography>
            <IconButton onClick={handleViewClick}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
              <MenuItem onClick={handleViewPdf}>View PDF</MenuItem>
            </Menu>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={handleDelete}>
          Delete
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onToggleEdit}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
