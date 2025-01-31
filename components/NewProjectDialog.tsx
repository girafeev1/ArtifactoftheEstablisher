// components/NewProjectDialog.tsx
import React, { useState, ChangeEvent, FormEvent } from 'react';
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
} from '@mui/material';
import { useSnackbar } from 'notistack';

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectAdded: () => void;
  referenceNames: Record<string, string>;
}

const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  open,
  onClose,
  onProjectAdded,
  referenceNames,
}) => {
  const { enqueueSnackbar } = useSnackbar();

  // Removed `presenter` & `projectDescription`
  const [formData, setFormData] = useState({
    projectNumber: '',
    projectDate: '',
    agent: '',
    invoiceCompany: '',
    projectTitle: '',
    projectNature: '',
    amount: '',
    paid: false,
    paidOnDate: '',
    invoice: '',
  });

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name!]: value,
    }));
  };

  const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name!]: checked,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (
      !formData.projectNumber ||
      !formData.projectDate ||
      !formData.invoiceCompany ||
      !formData.projectTitle ||
      !formData.amount
    ) {
      enqueueSnackbar('Please fill in all required fields.', { variant: 'error' });
      return;
    }

    // Prepare project data
    const project = {
      projectNumber: formData.projectNumber,
      projectDate: formData.projectDate,
      agent: formData.agent,
      invoiceCompany: formData.invoiceCompany,
      projectTitle: formData.projectTitle,
      projectNature: formData.projectNature,
      amount: parseFloat(formData.amount),
      paid: formData.paid,
      paidOnDate: formData.paidOnDate,
      invoice: formData.invoice,
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });

      if (res.ok) {
        enqueueSnackbar('Project added successfully!', { variant: 'success' });
        // Reset
        setFormData({
          projectNumber: '',
          projectDate: '',
          agent: '',
          invoiceCompany: '',
          projectTitle: '',
          projectNature: '',
          amount: '',
          paid: false,
          paidOnDate: '',
          invoice: '',
        });
        onProjectAdded();
        onClose();
      } else {
        const errorData = await res.json();
        enqueueSnackbar(
          `Error: ${errorData.message || 'Failed to add project.'}`,
          { variant: 'error' }
        );
      }
    } catch (error: any) {
      enqueueSnackbar(
        `Error: ${error.message || 'Failed to add project.'}`,
        { variant: 'error' }
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add New Project</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <TextField
            margin="dense"
            label="Project Number"
            name="projectNumber"
            value={formData.projectNumber}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            margin="dense"
            label="Project Date"
            name="projectDate"
            type="date"
            value={formData.projectDate}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            margin="dense"
            label="Agent"
            name="agent"
            value={formData.agent}
            onChange={handleChange}
            fullWidth
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="invoice-company-label">Invoice Company</InputLabel>
            <Select
              labelId="invoice-company-label"
              label="Invoice Company"
              name="invoiceCompany"
              value={formData.invoiceCompany}
              onChange={handleChange}
              required
            >
              {Object.entries(referenceNames).map(([identifier, fullName]) => (
                <MenuItem key={identifier} value={identifier}>
                  {fullName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            margin="dense"
            label="Project Title"
            name="projectTitle"
            value={formData.projectTitle}
            onChange={handleChange}
            fullWidth
            required
          />
          <TextField
            margin="dense"
            label="Project Nature"
            name="projectNature"
            value={formData.projectNature}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            margin="dense"
            label="Amount"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleChange}
            fullWidth
            required
          />
          <FormControl fullWidth margin="dense">
            <InputLabel id="paid-label">Paid</InputLabel>
            <Select
              labelId="paid-label"
              label="Paid"
              name="paid"
              value={formData.paid ? 'Yes' : 'No'}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  paid: e.target.value === 'Yes',
                }))
              }
            >
              <MenuItem value="Yes">Yes</MenuItem>
              <MenuItem value="No">No</MenuItem>
            </Select>
          </FormControl>
          {formData.paid && (
            <TextField
              margin="dense"
              label="Paid On Date"
              name="paidOnDate"
              type="date"
              value={formData.paidOnDate}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
            />
          )}
          <TextField
            margin="dense"
            label="Invoice"
            name="invoice"
            value={formData.invoice}
            onChange={handleChange}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="secondary">
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="primary">
            Add Project
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NewProjectDialog;
