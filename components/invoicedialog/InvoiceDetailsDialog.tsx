// components/invoicedialog/InvoiceDetailsDialog.tsx

import React from 'react';
import { Box, Typography, TextField, Button, IconButton, Divider } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { ReactSortable } from 'react-sortablejs';

export interface LineItem {
  title: string;
  feeDescription: string;
  notes: string;
  unitPrice: string;
  quantity: string;
  total: string;
}

interface InvoiceDetailsDialogProps {
  lineItems: LineItem[];
  setLineItems: (items: LineItem[]) => void;
  invoiceNumber: string;
  onFinish: () => void;
}

const InvoiceDetailsDialog: React.FC<InvoiceDetailsDialogProps> = ({
  lineItems,
  setLineItems,
  invoiceNumber,
  onFinish,
}) => {
  const handleLineItemChange = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    if (field === 'unitPrice' || field === 'quantity') {
      const unit = parseFloat(updated[index].unitPrice) || 0;
      const qty = parseFloat(updated[index].quantity) || 0;
      updated[index].total = (unit * qty).toFixed(2);
    }
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { title: '', feeDescription: '', notes: '', unitPrice: '', quantity: '', total: '' },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    const updated = [...lineItems];
    updated.splice(index, 1);
    setLineItems(updated);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Create Invoice - #{invoiceNumber}
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Invoice Details
      </Typography>
      <ReactSortable list={lineItems} setList={setLineItems} options={{ handle: '.drag-handle' }}>
        {lineItems.map((item, index) => (
          <Box
            key={index}
            data-id={index.toString()}
            sx={{
              border: '1px solid #ccc',
              borderRadius: 2,
              p: 1.5,
              mb: 2,
              backgroundColor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" className="drag-handle" sx={{ cursor: 'move' }}>
                Item {index + 1}
              </Typography>
              {lineItems.length > 1 && (
                <IconButton onClick={() => handleRemoveLineItem(index)} size="small">
                  <Remove />
                </IconButton>
              )}
            </Box>
            <TextField
              label="Item Title"
              value={item.title}
              onChange={(e) => handleLineItemChange(index, 'title', e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
            />
            <TextField
              label="Fee Description"
              value={item.feeDescription}
              onChange={(e) => handleLineItemChange(index, 'feeDescription', e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
            />
            <TextField
              label="Notes (optional)"
              value={item.notes}
              onChange={(e) => handleLineItemChange(index, 'notes', e.target.value)}
              fullWidth
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="Unit Price"
                type="number"
                value={item.unitPrice}
                onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)}
                fullWidth
              />
              <TextField
                label="Quantity"
                type="number"
                value={item.quantity}
                onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                fullWidth
              />
              <TextField
                label="Total"
                value={item.total}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Box>
          </Box>
        ))}
      </ReactSortable>
      <Button variant="outlined" onClick={handleAddLineItem} startIcon={<Add />}>
        Add Line Item
      </Button>
      <Divider sx={{ my: 2 }} />
      {/* No Finish button here – the next step is handled in CreateInvoice */}
    </Box>
  );
};

export default InvoiceDetailsDialog;
