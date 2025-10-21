// components/invoicedialog/InvoiceConfirmation.tsx

import React from 'react';
import { DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import { ClientDetails } from './BillToDialog';
import { InvoiceBankAccount } from '../projectdialog/ProjectOverview';
import { LineItem } from './InvoiceDetailsDialog';

interface InvoiceConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  basicInfo: {
    issuerEnglish: string;
    issuerChinese: string;
    issuerRoom: string;
    issuerBuilding: string;
    issuerStreet: string;
    issuerDistrict: string;
    issuerRegion: string;
    issuerEmail: string;
    issuerPhone: string;
    selectedBank: string;
    selectedAccountType: string;
    matchedBank: InvoiceBankAccount | undefined;
    invoiceNumber: string;
  };
  billTo: ClientDetails;
  lineItems: LineItem[];
}

export default function InvoiceConfirmation({ open, onClose, onConfirm, basicInfo, billTo, lineItems }: InvoiceConfirmationProps) {
  console.log('InvoiceConfirmation: basicInfo =', basicInfo);
  console.log('InvoiceConfirmation: billTo =', billTo);
  console.log('InvoiceConfirmation: lineItems =', lineItems);

  return (
    <>
      <DialogContent dividers>
        <Typography variant="h6" gutterBottom>Create Invoice - #{basicInfo.invoiceNumber}</Typography>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Issuer Information</Typography>
          <Typography>{basicInfo.issuerEnglish} ({basicInfo.issuerChinese})</Typography>
          <Typography>{basicInfo.issuerRoom}</Typography>
          <Typography>{basicInfo.issuerBuilding}</Typography>
          <Typography>{basicInfo.issuerStreet}</Typography>
          <Typography>{basicInfo.issuerDistrict}, {basicInfo.issuerRegion}</Typography>
          <Typography>Email: {basicInfo.issuerEmail}</Typography>
          <Typography>Phone: {basicInfo.issuerPhone}</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Bill To</Typography>
          <Typography>{billTo.companyName}</Typography>
          <Typography>{billTo.title} {billTo.representative}</Typography>
          <Typography>{billTo.addressLine1}</Typography>
          <Typography>{billTo.addressLine2}</Typography>
          <Typography>{billTo.addressLine3}</Typography>
          <Typography>{billTo.addressLine4}, {billTo.addressLine5}</Typography>
          <Typography>Email: {billTo.emailAddress}</Typography>
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Bank Information</Typography>
          <Typography>Bank: {basicInfo.matchedBank?.bankName} ({basicInfo.matchedBank?.bankCode})</Typography>
          <Typography>Account Type: {basicInfo.matchedBank?.accountType}</Typography>
          <Typography>Account Number: {basicInfo.matchedBank?.accountNumber}</Typography>
          {basicInfo.matchedBank?.fpsId && <Typography>FPS ID: {basicInfo.matchedBank.fpsId}</Typography>}
        </Box>
        <Box>
          <Typography variant="subtitle1">Line Items</Typography>
          {lineItems.map((item, index) => (
            <Box key={index} sx={{ mb: 1 }}>
              <Typography>{item.title}</Typography>
              <Typography>{item.feeDescription}</Typography>
              <Typography>Unit Price: ${item.unitPrice} x {item.quantity} = ${item.total}</Typography>
              {item.notes && <Typography>Notes: {item.notes}</Typography>}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Back</Button>
        <Button variant="outlined" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>Confirm</Button>
      </DialogActions>
    </>
  );
}
