// pages/dashboard/internal.tsx

import { useState } from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchBankAccounts } from '../../lib/pmsReference';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface BankAccountRow {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId: string;
  fpsEmail: string;
  comments: string;
}

interface Props {
  bankAccounts: BankAccountRow[];
  error?: string;
}

export default function InternalPage({ bankAccounts, error }: Props) {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const groupedData = bankAccounts.reduce((acc, account) => {
    if (!acc[account.companyName]) {
      acc[account.companyName] = {};
    }
    if (!acc[account.companyName][account.bankName]) {
      acc[account.companyName][account.bankName] = [];
    }
    acc[account.companyName][account.bankName].push(account);
    return acc;
  }, {} as Record<string, Record<string, BankAccountRow[]>>);

  return (
    <SidebarLayout>
      <Typography variant="h4" gutterBottom>
        Bank Account Information
      </Typography>
      {error && <Typography color="error">{error}</Typography>}

      {Object.keys(groupedData).length === 0 ? (
        <Typography>No bank account information found.</Typography>
      ) : (
        Object.entries(groupedData).map(([companyName, banks]) => (
          <div key={companyName}>
            <Typography variant="h5" sx={{ mb: 1, textAlign: 'left' }}>
              {companyName}
            </Typography>
            {Object.entries(banks).map(([bankName, accounts]) => (
              <Accordion
                key={`${companyName}-${bankName}`}
                expanded={expanded === `${companyName}-${bankName}`}
                onChange={handleChange(`${companyName}-${bankName}`)}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`${companyName}-${bankName}-content`}
                  id={`${companyName}-${bankName}-header`}
                >
                  <Typography>
                    {bankName} {accounts[0]?.bankCode.replace(/^Code:\s*/, '')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Account Type</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Account Number</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>FPS ID</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>FPS Email</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{account.accountType}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{account.accountNumber}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{account.fpsId}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{account.fpsEmail}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>{account.comments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionDetails>
              </Accordion>
            ))}
          </div>
        ))
      )}
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }

  try {
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken });
    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const bankAccounts = await fetchBankAccounts(sheets, pmsRefLogFileId);

    return {
      props: { bankAccounts },
    };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return { props: { bankAccounts: [], error: err.message } };
  }
};
