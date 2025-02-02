// components/NewProjectDialog.tsx

import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Checkbox,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { useSnackbar } from 'notistack';

/**
 * Props:
 * - mode="global" => user picks invoice company + project date => we derive year from date =>
 *   the user can see a partial projectNumber (#2024-001) where the last 3 digits are editable.
 * - mode="file" => user is locked to a certain invoice company + year code from the file label =>
 *   user picks project date (month/day only?), last 3 digits are still editable.
 */
interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  referenceNames: Record<string, string>;
  mode?: 'global' | 'file';
  preselectedInvoiceCompany?: string; // if mode="file", you can pass these
  preselectedYearCode?: string;      // from the file label
}

export default function NewProjectDialog({
  open,
  onClose,
  onProjectAdded,
  referenceNames,
  mode = 'global',
  preselectedYearCode = '',
}: NewProjectDialogProps) {
  const { enqueueSnackbar } = useSnackbar();

  // We'll store data in a local state
  const [invoiceCompany, setInvoiceCompany] = useState<string>('');
  const [dateValue, setDateValue] = useState<string>(''); // yyyy-mm-dd
  const [yearCode, setYearCode] = useState<string>('');   // e.g. "2024"
  const [projectNumber, setProjectNumber] = useState<string>('');  // #2024-001
  const [title, setTitle] = useState<string>('');
  const [nature, setNature] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paid, setPaid] = useState<boolean>(false);
  const [paidOnDate, setPaidOnDate] = useState<string>('');

  // When dialog opens, reset
  useEffect(() => {
    if (open) {
      if (mode === 'file') {
        setInvoiceCompany(preselectedInvoiceCompany);
        setYearCode(preselectedYearCode);
        // projectNumber => "#<yearCode>-001"
        setProjectNumber(`#${preselectedYearCode}-001`);
      } else {
        setInvoiceCompany('');
        setYearCode('');
        setProjectNumber('#0000-001');
      }
      setDateValue('');
      setTitle('');
      setNature('');
      setAmount('');
      setPaid(false);
      setPaidOnDate('');
    }
  }, [open, mode, preselectedInvoiceCompany, preselectedYearCode]);

  // If user toggles paid => uncheck => clear the paidOnDate
  useEffect(() => {
    if (!paid) {
      setPaidOnDate('');
    }
  }, [paid]);

  // If user is in "global" mode, whenever they pick a date, we extract the year
  // => update yearCode => update the projectNumber.
  const handleDateChange = (val: string) => {
    setDateValue(val);
    if (mode === 'global') {
      if (!val) return;
      // extract the year from "yyyy-mm-dd"
      const splitted = val.split('-');
      if (splitted.length >= 1) {
        const yyyy = splitted[0];
        setYearCode(yyyy);
        // keep last 3 digits from the existing projectNumber if user has changed it?
        const last3 = projectNumber.slice(projectNumber.indexOf('-') + 1) || '001';
        setProjectNumber(`#${yyyy}-${last3}`);
      }
    } else {
      // mode="file" => we do partial lock
      // if user is forced to pick a date in the same year => we only consider month/day?
      // We won't change the year code from the date, because the file is locked to preselectedYearCode
      setDateValue(val);
    }
  };

  // If user modifies the last 3 digits => let them do so, but keep `#2024-???`
  const handleProjectNumberChange = (val: string) => {
    // we assume the format "#yearCode-xxx"
    // let's parse out the last 3 digits
    const dashIndex = projectNumber.indexOf('-');
    if (dashIndex === -1) {
      // fallback
      setProjectNumber(val);
      return;
    }
    const prefix = projectNumber.substring(0, dashIndex + 1);
    // user modifies the part after the dash
    setProjectNumber(prefix + val.replace(/[^0-9]/g, '').padStart(3, '0'));
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!yearCode || !invoiceCompany || !title || !amount) {
      enqueueSnackbar('Please fill in all required fields (year, invoice co, title, amount).', { variant: 'error' });
      return;
    }
    if (!projectNumber) {
      enqueueSnackbar('Project number is missing.', { variant: 'error' });
      return;
    }
    // For this example, we simulate an API call
    console.log('[NewProjectDialog] Submitting new project => yearCode:', yearCode, 'invoiceCo:', invoiceCompany, 'projectNumber:', projectNumber);
    enqueueSnackbar('Simulated adding new project. Implement the actual API call.', { variant: 'success' });
    onProjectAdded();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'global' ? 'Add New Project (Global)' : 'Add New Project (File)'} </DialogTitle>
      <DialogContent dividers>
        {mode === 'global' ? (
          <FormControl fullWidth margin="dense">
            <InputLabel id="invoice-company-label">Invoice Company</InputLabel>
            <Select
              labelId="invoice-company-label"
              label="Invoice Company"
              value={invoiceCompany}
              onChange={(e) => setInvoiceCompany(e.target.value as string)}
            >
              {/* read from referenceNames if needed */}
              {Object.entries(referenceNames).map(([code, fullName]) => (
                <MenuItem key={code} value={code}>{`${code} - ${fullName}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body1">
              Invoice Company: {preselectedInvoiceCompany}
            </Typography>
          </Box>
        )}
        {mode === 'global' ? (
          <TextField
            label="Project Date"
            type="date"
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
        ) : (
          <TextField
            label="Project Date (Month/Day Only?)"
            type="date"
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
        )}
        <Box sx={{ mb: 1, mt: 1 }}>
          {mode === 'global' ? (
            <Typography variant="body2">
              Year Code: {yearCode || '(derived from Project Date)'}
            </Typography>
          ) : (
            <Typography variant="body2">
              Year Code: {preselectedYearCode}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2">Project Number:</Typography>
          {/* Let user edit the last 3 digits. We'll parse out the last 3 digits. */}
          <TextField
            value={projectNumber}
            onChange={(e) => {
              // If there's a dash, we only let them edit the part after the dash
              // We'll parse it out for simplicity
              const dashIndex = projectNumber.indexOf('-');
              if (dashIndex === -1) {
                // fallback
                setProjectNumber(e.target.value);
              } else {
                const prefix = projectNumber.substring(0, dashIndex + 1);
                const suffixRaw = e.target.value.replace(/^.*-/, ''); // remove everything before the dash
                const suffixClean = suffixRaw.replace(/[^0-9]/g, '').padStart(3, '0');
                setProjectNumber(prefix + suffixClean);
              }
            }}
            size="small"
            sx={{ width: 160 }}
          />
        </Box>
        <TextField
          label="Project Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          margin="dense"
        />
        <TextField
          label="Project Nature"
          value={nature}
          onChange={(e) => setNature(e.target.value)}
          fullWidth
          margin="dense"
        />
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          margin="dense"
        />
        <FormControl fullWidth margin="dense">
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Typography sx={{ flexGrow: 1 }}>Paid</Typography>
            <Checkbox
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
          </Box>
        </FormControl>
        {paid && (
          <TextField
            label="Paid On Date"
            type="date"
            value={paidOnDate}
            onChange={(e) => setPaidOnDate(e.target.value)}
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            required
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">Cancel</Button>
        <Button type="button" variant="contained" color="primary" onClick={handleSubmit}>
          Add Project
        </Button>
      </DialogActions>
    </Dialog>
  );
}
