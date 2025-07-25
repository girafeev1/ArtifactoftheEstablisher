// components/projectdialog/NewProjectDialog.tsx

import React from 'react';
import { Box, Typography, TextField, Button, FormControl, Select, MenuItem, InputLabel } from '@mui/material';

interface ClientEntry {
  companyName: string;
}

interface NewProjectDialogProps {
  projectNumber: string;
  setProjectNumber: (val: string) => void;
  editingProjectNumber: boolean;
  setEditingProjectNumber: (val: boolean) => void;
  projectDate: string;
  setProjectDate: (val: string) => void;
  clientCompany: string;
  setClientCompany: (val: string) => void;
  manualCompany: string;
  setManualCompany: (val: string) => void;
  useManualCompany: boolean;
  setUseManualCompany: (val: boolean) => void;
  projectTitle: string;
  setProjectTitle: (val: string) => void;
  projectNature: string;
  setProjectNature: (val: string) => void;
  amount: string;
  setAmount: (val: string) => void;
  clientsData: ClientEntry[];
  handleSaveAndExit: () => void;
  handleSaveAndNext: () => void;
  fileId: string;
}

export default function NewProjectDialog({
  projectNumber,
  setProjectNumber,
  editingProjectNumber,
  setEditingProjectNumber,
  projectDate,
  setProjectDate,
  clientCompany,
  setClientCompany,
  manualCompany,
  setManualCompany,
  useManualCompany,
  setUseManualCompany,
  projectTitle,
  setProjectTitle,
  projectNature,
  setProjectNature,
  amount,
  setAmount,
  clientsData,
  handleSaveAndExit,
  handleSaveAndNext,
  fileId,
}: NewProjectDialogProps) {
  function handleAddCompanyManually() {
    console.log('Switching to manual company input mode');
    setUseManualCompany(true);
    setClientCompany('');
  }

  function handleUseDropdownCompany() {
    console.log('Switching to dropdown selection mode');
    setUseManualCompany(false);
    setManualCompany('');
  }

  const handleSaveInternal = async (next: boolean) => {
    const finalCompany = useManualCompany ? manualCompany : clientCompany;
    if (!projectNumber || !projectDate || !finalCompany || !projectTitle || !projectNature || !amount) {
      console.log('[NewProjectDialog] Validation failed: Missing required fields');
      alert('All fields are required');
      return;
    }
    try {
      const payload = {
        projectNumber,
        projectDate,
        agent: '',
        invoiceCompany: finalCompany,
        projectTitle,
        projectNature,
        amount,
        paid: 'FALSE',
        paidOnDate: '',
        bankAccountIdentifier: '',
        invoice: '',
      };
      console.log('[NewProjectDialog] Saving project with payload:', payload);
      console.log('[NewProjectDialog] Sending POST request to:', `/api/businesses/${fileId}`);
      const resp = await fetch(`/api/businesses/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const responseText = await resp.text();
      console.log('[NewProjectDialog] Response status:', resp.status, 'Response body:', responseText);
      if (!resp.ok) {
        console.error('[NewProjectDialog] Error response:', responseText);
        throw new Error(responseText || 'Failed to save project');
      }
      console.log('[NewProjectDialog] Project created successfully');
      if (next) {
        console.log('[NewProjectDialog] Triggering handleSaveAndNext');
        handleSaveAndNext();
      } else {
        console.log('[NewProjectDialog] Triggering handleSaveAndExit');
        handleSaveAndExit();
      }
    } catch (err: any) {
      console.error('[NewProjectDialog] Save error:', err);
      alert(`Error saving project: ${err.message}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 500, mx: 'auto', p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Project Number:
        </Typography>
        {editingProjectNumber ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              fullWidth
            />
            <Button onClick={() => setEditingProjectNumber(false)} size="small">
              Done
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1">{projectNumber || '(not set)'}</Typography>
            <Button variant="outlined" size="small" onClick={() => setEditingProjectNumber(true)}>
              Edit
            </Button>
          </Box>
        )}
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Project Pickup Date:
        </Typography>
        <TextField
          type="date"
          value={projectDate}
          onChange={(e) => setProjectDate(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Client Company:
        </Typography>
        {useManualCompany ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              value={manualCompany}
              onChange={(e) => {
                console.log('Manual client input:', e.target.value);
                setManualCompany(e.target.value);
              }}
              fullWidth
              placeholder="Enter new company name"
            />
            <Button variant="outlined" onClick={handleUseDropdownCompany}>
              Use existing
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Client Company</InputLabel>
              <Select
                value={clientCompany}
                label="Client Company"
                onChange={(e) => {
                  console.log('Selected client from dropdown:', e.target.value);
                  setClientCompany(e.target.value);
                }}
              >
                <MenuItem value="">
                  <em>-- Select Client --</em>
                </MenuItem>
                {clientsData.map((c) => (
                  <MenuItem key={c.companyName} value={c.companyName}>
                    {c.companyName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={handleAddCompanyManually}>
              Add New
            </Button>
          </Box>
        )}
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Project Title:
        </Typography>
        <TextField
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          fullWidth
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Project Nature:
        </Typography>
        <TextField
          value={projectNature}
          onChange={(e) => setProjectNature(e.target.value)}
          fullWidth
        />
      </Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Amount:
        </Typography>
        <TextField
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={() => handleSaveInternal(false)}>
          Save & Exit
        </Button>
        <Button variant="contained" onClick={() => handleSaveInternal(true)}>
          Save & Next
        </Button>
      </Box>
    </Box>
  );
}
