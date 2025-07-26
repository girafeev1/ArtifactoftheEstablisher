// components/invoicedialog/BasicInfoDialog.tsx

import React from 'react';
import { Box, Typography, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import type { InvoiceBankAccount } from '../projectdialog/ProjectOverview';

interface BasicInfoDialogProps {
  fileId: string;
  invoiceSheetId: string;
  projectDate: string;
  projectNumber: string;
  issuerEnglish: string;
  issuerChinese: string;
  issuerRoom: string;
  issuerBuilding: string;
  issuerStreet: string;
  issuerDistrict: string;
  issuerRegion: string;
  issuerEmail: string;
  issuerPhone: string;
  relevantBanks: InvoiceBankAccount[];
  selectedBank: string;
  setSelectedBank: (val: string) => void;
  selectedAccountType: string;
  setSelectedAccountType: (val: string) => void;
  matchedBank: InvoiceBankAccount | undefined;
  invoiceNumber: string;
  onSaveAndNext: () => void;
}

export default function BasicInfoDialog({
  fileId,
  invoiceSheetId,
  projectDate,
  projectNumber,
  issuerEnglish,
  issuerChinese,
  issuerRoom,
  issuerBuilding,
  issuerStreet,
  issuerDistrict,
  issuerRegion,
  issuerEmail,
  issuerPhone,
  relevantBanks,
  selectedBank,
  setSelectedBank,
  selectedAccountType,
  setSelectedAccountType,
  matchedBank,
  invoiceNumber,
  onSaveAndNext,
}: BasicInfoDialogProps) {
  function renderAddressLine(value?: string) {
    if (!value || !value.trim()) return null;
    return <Typography variant="body2">{value}</Typography>;
  }

  return (
    <Box>
      {/* Updated title */}
      <Typography variant="h6" gutterBottom>
        Create Invoice - #{invoiceNumber}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Invoice Issuing Company Information
      </Typography>
      <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, mb: 2 }}>
        <Box sx={{ mb: 1 }}>
          <strong>Name:</strong> {issuerEnglish}{issuerChinese ? ` (${issuerChinese})` : ''}
        </Box>
        <Box sx={{ mb: 1 }}>
          <strong>Address: </strong>
          <Box sx={{ ml: 3 }}>
            {renderAddressLine(issuerRoom)}
            {renderAddressLine(issuerBuilding)}
            {renderAddressLine(issuerStreet)}
            {renderAddressLine(issuerDistrict)}
            {renderAddressLine(issuerRegion ? issuerRegion + ', Hong Kong' : '')}
          </Box>
        </Box>
        <Box sx={{ mb: 1 }}>
          <strong>Tel: </strong> {issuerPhone}
        </Box>
        <Box sx={{ mb: 1 }}>
          <strong>Email: </strong> {issuerEmail}
        </Box>
      </Box>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        Bank Account Information
      </Typography>
      {relevantBanks.length === 0 ? (
        <Typography sx={{ color: 'red', mt: 2 }}>
          No bank accounts found for {issuerEnglish}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Bank</InputLabel>
            <Select
              value={selectedBank}
              onChange={(e) => {
                setSelectedBank(e.target.value as string);
                setSelectedAccountType('');
              }}
              displayEmpty
            >
              <MenuItem value="">
                <em>-- Select Bank --</em>
              </MenuItem>
              {[...new Set(relevantBanks.map((b) => b.bankName))].map((bn) => (
                <MenuItem key={bn} value={bn}>
                  {bn}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={!selectedBank}>
            <InputLabel>Account Type</InputLabel>
            <Select
              value={selectedAccountType}
              onChange={(e) => setSelectedAccountType(e.target.value as string)}
              displayEmpty
            >
              <MenuItem value="">
                <em>-- Select Account Type --</em>
              </MenuItem>
              {[...new Set(
                relevantBanks.filter((b) => b.bankName === selectedBank).map((b) => b.accountType)
              )].map((acct) => (
                <MenuItem key={acct} value={acct}>
                  {acct}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}
      {matchedBank && (
        <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Bank: {matchedBank.bankName} {matchedBank.bankCode}
          </Typography>
          <Typography variant="body2" gutterBottom>
            Account Type: {matchedBank.accountType}
          </Typography>
          <Typography variant="body2" gutterBottom>
            Account #: {matchedBank.accountNumber}
          </Typography>
          {matchedBank.fpsId && (
            <Typography variant="body2" gutterBottom>
              FPS ID: {matchedBank.fpsId}
            </Typography>
          )}
          {matchedBank.fpsEmail && (
            <Typography variant="body2" gutterBottom>
              FPS Email: {matchedBank.fpsEmail}
            </Typography>
          )}
        </Box>
      )}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1">Invoice Number:</Typography>
        <Typography variant="h6">#{invoiceNumber || 'Generating...'}</Typography>
      </Box>
    </Box>
  );
}
