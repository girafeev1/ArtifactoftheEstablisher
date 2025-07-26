// components/invoicedialog/CreateInvoice.tsx

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogActions, Button } from '@mui/material';
import BasicInfoDialog from './BasicInfoDialog';
import BillToDialog from './BillToDialog';
import InvoiceDetailsDialog from './InvoiceDetailsDialog';
import InvoiceConfirmation from './InvoiceConfirmation';
import type { LineItem } from './InvoiceDetailsDialog';

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

interface CreateInvoiceProps {
  open: boolean;
  onClose: () => void;
  onInvoiceUpdated: () => void;
  fileId: string;
  invoiceSheetId: string;
  projectDate: string;
  projectNumber: string;
  subsidiaryInfo: any;
  issuerCompany: string;
  clientCompany: string;
  bankAccounts: any[];
}

const CreateInvoice: React.FC<CreateInvoiceProps> = ({
  open,
  onClose,
  onInvoiceUpdated,
  fileId,
  invoiceSheetId,
  projectDate,
  projectNumber,
  subsidiaryInfo,
  issuerCompany,
  clientCompany,
  bankAccounts,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedBank, setSelectedBank] = useState('');
  const [selectedAccountType, setSelectedAccountType] = useState('');
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { title: '', feeDescription: '', notes: '', unitPrice: '', quantity: '', total: '' },
  ]);
  const [billToData, setBillToData] = useState<ClientDetails | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients', {
          method: 'GET',
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch clients');
        const data = await response.json();
        console.log('[CreateInvoice] Fetched clientsData:', data);
        setClientsData(data);
      } catch (error) {
        console.error('[CreateInvoice] Error fetching clients:', error);
      } finally {
        setLoading(false);
      }
    };
    if (open) fetchClients();
  }, [open]);

  function computeInvoiceNumber(dateStr: string, pNum: string): string {
    if (!dateStr || !pNum) return '???';
    let formattedDate = dateStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const tmp = new Date(dateStr);
      if (isNaN(tmp.valueOf())) return '???';
      const y = tmp.getFullYear();
      const mm = String(tmp.getMonth() + 1).padStart(2, '0');
      const dd = String(tmp.getDate()).padStart(2, '0');
      formattedDate = `${y}-${mm}-${dd}`;
    }
    const parts = formattedDate.split('-');
    const mmdd = parts[1] + parts[2];
    const cleaned = pNum.startsWith('#') ? pNum.slice(1) : pNum;
    const yearFromPNum = cleaned.slice(0, 4);
    const dashIdx = cleaned.lastIndexOf('-');
    const nnn = dashIdx !== -1 ? cleaned.slice(dashIdx + 1) : '???';
    return `${yearFromPNum}-${mmdd}-${nnn}`;
  }
  const invoiceNumber = computeInvoiceNumber(projectDate, projectNumber);

  const handleBasicInfoNext = () => {
    if (!selectedBank || !selectedAccountType) {
      alert('Please select both a bank and an account type to proceed.');
      return;
    }
    console.log('[CreateInvoice] Basic Info step complete:', { selectedBank, selectedAccountType });
    setStepIndex(1);
  };

  const handleBillToNext = (client: ClientDetails) => {
    console.log('[CreateInvoice] Bill To step complete:', client);
    setBillToData(client);
    setStepIndex(2);
  };

  const handleInvoiceDetailsNext = () => {
    console.log('[CreateInvoice] Invoice details complete.');
    setStepIndex(3);
  };

  const handleConfirm = async () => {
    if (!fileId) {
      alert('Error: fileId is missing.');
      return;
    }
    const matchedBank = bankAccounts.find(
      (ba) => ba.bankName === selectedBank && ba.accountType === selectedAccountType
    );
    const invoiceData = {
      fileId,
      projectNumber,
      invoiceNumber,
      issuedDate: projectDate,
      issuer: {
        englishName: issuerCompany,
        chineseName: subsidiaryInfo?.chineseName || '',
        room: subsidiaryInfo?.room || '',
        building: subsidiaryInfo?.building || '',
        street: subsidiaryInfo?.street || '',
        district: subsidiaryInfo?.district || '',
        region: subsidiaryInfo?.region || '',
        email: subsidiaryInfo?.email || '',
        phone: subsidiaryInfo?.phone || '',
      },
      bankInfo: matchedBank
        ? {
            bankName: matchedBank.bankName,
            bankCode: matchedBank.bankCode,
            accountType: matchedBank.accountType,
            accountNumber: matchedBank.accountNumber,
            fpsId: matchedBank.fpsId || '',
            fpsEmail: matchedBank.fpsEmail || '',
          }
        : null,
      billTo: billToData || {
        companyName: clientCompany,
        title: '',
        nameAddressed: '',
        emailAddress: '',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        addressLine4: '',
        addressLine5: '',
      },
      lineItems,
    };
    console.log('[CreateInvoice] Invoice confirmed. Sending data:', invoiceData);
    try {
      const response = await fetch('/api/invoices/createInvoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create invoice sheet: ${errorText}`);
      }
      const result = await response.json();
      console.log('[CreateInvoice] Invoice sheet created successfully:', result);
      onInvoiceUpdated();
      onClose();
    } catch (error: any) {
      console.error('[CreateInvoice] Error creating invoice sheet:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {stepIndex === 0 && (
        <>
          <DialogContent dividers>
            <BasicInfoDialog
              fileId={fileId}
              invoiceSheetId={invoiceSheetId}
              projectDate={projectDate}
              projectNumber={projectNumber}
              issuerEnglish={issuerCompany}
              issuerChinese={subsidiaryInfo?.chineseName || ''}
              issuerRoom={subsidiaryInfo?.room || ''}
              issuerBuilding={subsidiaryInfo?.building || ''}
              issuerStreet={subsidiaryInfo?.street || ''}
              issuerDistrict={subsidiaryInfo?.district || ''}
              issuerRegion={subsidiaryInfo?.region || ''}
              issuerEmail={subsidiaryInfo?.email || ''}
              issuerPhone={subsidiaryInfo?.phone || ''}
              relevantBanks={bankAccounts}
              selectedBank={selectedBank}
              setSelectedBank={setSelectedBank}
              selectedAccountType={selectedAccountType}
              setSelectedAccountType={setSelectedAccountType}
              matchedBank={bankAccounts.find(
                (ba) => ba.bankName === selectedBank && ba.accountType === selectedAccountType
              )}
              invoiceNumber={invoiceNumber}
              onSaveAndNext={handleBasicInfoNext}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleBasicInfoNext}>
              Save & Next
            </Button>
          </DialogActions>
        </>
      )}
      {stepIndex === 1 && (
        <>
          <DialogContent dividers>
            <BillToDialog
              fileId={fileId}
              invoiceSheetId={invoiceSheetId}
              initialCompanyName={clientCompany}
              existingClients={clientsData}
              onSaveClientDetails={handleBillToNext}
              onNext={handleBillToNext}
              invoiceNumber={invoiceNumber}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStepIndex(0)}>Back</Button>
            <Button variant="outlined" onClick={onClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => handleBillToNext(clientCompany ? clientsData.find(c => c.companyName === clientCompany) || { companyName: clientCompany, title: '', nameAddressed: '', emailAddress: '', addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '', addressLine5: '' } : { companyName: '', title: '', nameAddressed: '', emailAddress: '', addressLine1: '', addressLine2: '', addressLine3: '', addressLine4: '', addressLine5: '' })}
            >
              Save & Next
            </Button>
          </DialogActions>
        </>
      )}
      {stepIndex === 2 && (
        <>
          <DialogContent dividers>
            <InvoiceDetailsDialog
              lineItems={lineItems}
              setLineItems={setLineItems}
              invoiceNumber={invoiceNumber}
              onFinish={handleInvoiceDetailsNext}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setStepIndex(1)}>Back</Button>
            <Button variant="outlined" onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleInvoiceDetailsNext}>
              Next
            </Button>
          </DialogActions>
        </>
      )}
      {stepIndex === 3 && (
        <InvoiceConfirmation
          open={open}
          onClose={onClose}
          onConfirm={handleConfirm}
          basicInfo={{
            issuerEnglish: issuerCompany,
            issuerChinese: subsidiaryInfo?.chineseName || '',
            issuerRoom: subsidiaryInfo?.room || '',
            issuerBuilding: subsidiaryInfo?.building || '',
            issuerStreet: subsidiaryInfo?.street || '',
            issuerDistrict: subsidiaryInfo?.district || '',
            issuerRegion: subsidiaryInfo?.region || '',
            issuerEmail: subsidiaryInfo?.email || '',
            issuerPhone: subsidiaryInfo?.phone || '',
            selectedBank,
            selectedAccountType,
            matchedBank: bankAccounts.find(
              (ba) => ba.bankName === selectedBank && ba.accountType === selectedAccountType
            ),
            invoiceNumber,
          }}
          billTo={
            billToData || {
              companyName: clientCompany,
              title: '',
              nameAddressed: '',
              emailAddress: '',
              addressLine1: '',
              addressLine2: '',
              addressLine3: '',
              addressLine4: '',
              addressLine5: '',
            }
          }
          lineItems={lineItems}
        />
      )}
    </Dialog>
  );
};

export default CreateInvoice;
