// components/invoicedialog/BillToDialog.tsx

import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, FormControlLabel, Checkbox } from '@mui/material';

export interface ClientDetails {
  companyName: string;
  title: string;
  nameAddressed: string;
  emailAddress: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  addressLine5: string;
}

interface BillToDialogProps {
  fileId: string;
  invoiceSheetId: string;
  initialCompanyName: string;
  existingClients: ClientDetails[];
  onSaveClientDetails: (client: ClientDetails, register?: boolean) => void; // Updated to match usage
  onNext: (client: ClientDetails) => void; // Align with onSaveClientDetails
  invoiceNumber: string;
}

export default function BillToDialog({
  fileId,
  invoiceSheetId,
  initialCompanyName,
  existingClients,
  onSaveClientDetails,
  onNext,
  invoiceNumber,
}: BillToDialogProps) {
  console.log('[BillToDialog] initialCompanyName:', initialCompanyName);
  console.log('[BillToDialog] existingClients (raw):', existingClients);

  const foundClient = existingClients.find((c) => {
    const clientName = c.companyName || '';
    const initName = initialCompanyName || '';
    const match = clientName.trim().toLowerCase() === initName.trim().toLowerCase();
    console.log(`[BillToDialog] Comparing "${clientName}" with "${initName}" => ${match}`);
    return match;
  });
  console.log('[BillToDialog] foundClient:', foundClient);

  const [isRegistered, setIsRegistered] = useState<boolean>(!!foundClient);
  const [client, setClient] = useState<ClientDetails>(
    foundClient || {
      companyName: initialCompanyName,
      title: '',
      nameAddressed: '',
      emailAddress: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      addressLine4: '',
      addressLine5: '',
    }
  );
  const [registerClient, setRegisterClient] = useState<boolean>(false);

  useEffect(() => {
    if (foundClient) {
      console.log('[BillToDialog] Found registered client:', foundClient);
      setIsRegistered(true);
      setClient(foundClient);
      onSaveClientDetails(foundClient); // Immediately update parent with found client data
    } else {
      console.log('[BillToDialog] No registered client found for:', initialCompanyName);
      setIsRegistered(false);
      setClient(prev => ({ ...prev, companyName: initialCompanyName }));
    }
  }, [initialCompanyName, foundClient, onSaveClientDetails]);

  console.log('[BillToDialog] Final client state:', client, 'isRegistered:', isRegistered);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Create Invoice - #{invoiceNumber}
      </Typography>
      <Typography variant="h6" gutterBottom>
        Client Company Information
      </Typography>
      <TextField
        label="Company Name"
        fullWidth
        margin="normal"
        value={client.companyName}
        InputProps={{
          readOnly: isRegistered,
        }}
        onChange={(e) => {
          console.log('[BillToDialog] Company Name changed to:', e.target.value);
          setClient({ ...client, companyName: e.target.value });
        }}
      />
      {isRegistered ? (
        <>
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Contact
          </Typography>
          {(client.title || client.nameAddressed) && (
            <Typography variant="body2">
              {client.title} {client.nameAddressed}
            </Typography>
          )}
          {client.emailAddress && (
            <Typography variant="body2">
              {client.emailAddress}
            </Typography>
          )}
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            Address:
          </Typography>
          {client.addressLine1 && <Typography variant="body2">{client.addressLine1}</Typography>}
          {client.addressLine2 && <Typography variant="body2">{client.addressLine2}</Typography>}
          {client.addressLine3 && <Typography variant="body2">{client.addressLine3}</Typography>}
          {client.addressLine4 && <Typography variant="body2">{client.addressLine4}</Typography>}
          {client.addressLine5 && <Typography variant="body2">{client.addressLine5}</Typography>}
        </>
      ) : (
        <>
          <TextField
            label="Title"
            fullWidth
            margin="normal"
            value={client.title}
            onChange={(e) => {
              console.log('[BillToDialog] Title changed to:', e.target.value);
              setClient({ ...client, title: e.target.value });
            }}
          />
          <TextField
            label="Name Addressed"
            fullWidth
            margin="normal"
            value={client.nameAddressed}
            onChange={(e) => {
              console.log('[BillToDialog] Name Addressed changed to:', e.target.value);
              setClient({ ...client, nameAddressed: e.target.value });
            }}
          />
          <TextField
            label="Email Address"
            fullWidth
            margin="normal"
            value={client.emailAddress}
            onChange={(e) => {
              console.log('[BillToDialog] Email Address changed to:', e.target.value);
              setClient({ ...client, emailAddress: e.target.value });
            }}
          />
          <TextField
            label="Room/Floor/Block"
            fullWidth
            margin="normal"
            value={client.addressLine1}
            onChange={(e) => {
              console.log('[BillToDialog] Room/Floor/Block changed to:', e.target.value);
              setClient({ ...client, addressLine1: e.target.value });
            }}
          />
          <TextField
            label="Building Name"
            fullWidth
            margin="normal"
            value={client.addressLine2}
            onChange={(e) => {
              console.log('[BillToDialog] Building Name changed to:', e.target.value);
              setClient({ ...client, addressLine2: e.target.value });
            }}
          />
          <TextField
            label="Street"
            fullWidth
            margin="normal"
            value={client.addressLine3}
            onChange={(e) => {
              console.log('[BillToDialog] Street changed to:', e.target.value);
              setClient({ ...client, addressLine3: e.target.value });
            }}
          />
          <TextField
            label="District"
            fullWidth
            margin="normal"
            value={client.addressLine4}
            onChange={(e) => {
              console.log('[BillToDialog] District changed to:', e.target.value);
              setClient({ ...client, addressLine4: e.target.value });
            }}
          />
          <TextField
            label="Region"
            fullWidth
            margin="normal"
            value={client.addressLine5}
            onChange={(e) => {
              console.log('[BillToDialog] Region changed to:', e.target.value);
              setClient({ ...client, addressLine5: e.target.value });
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={registerClient}
                onChange={(e) => {
                  console.log('[BillToDialog] Register client checkbox changed:', e.target.checked);
                  setRegisterClient(e.target.checked);
                }}
              />
            }
            label="Register this client to Address Book"
          />
        </>
      )}
    </Box>
  );
}
