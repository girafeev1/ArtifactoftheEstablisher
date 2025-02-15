// components/projectdialog/newprojectdialog/NewProjectPage1.tsx

import React from 'react';
import { Box, Typography, TextField, Button, FormControl, Select, MenuItem, InputLabel } from '@mui/material';

interface ClientEntry {
  companyName: string;
}
interface Page1Props {
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
  onClose: () => void;
  handleSaveAndExit: () => void;
  handleSaveAndNext: () => void;
}

export default function NewProjectPage1({
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
  onClose,
  handleSaveAndExit,
  handleSaveAndNext,
}: Page1Props) {
  function handleAddCompanyManually() {
    setUseManualCompany(true);
  }
  function handleUseDropdownCompany() {
    setUseManualCompany(false);
    setManualCompany('');
  }
  return (
    <>
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
          Project Pickup Date (YYYY-MM-DD):
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
              onChange={(e) => setManualCompany(e.target.value)}
              fullWidth
              placeholder="Enter new company name"
            />
            <Button variant="outlined" onClick={handleUseDropdownCompany}>
              Use dropdown
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Client Company</InputLabel>
              <Select
                value={clientCompany}
                label="Client Company"
                onChange={(e) => setClientCompany(e.target.value)}
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
    </>
  );
}
