// pages/dashboard/internal.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeUserApis } from '../../lib/googleApi';
import { findPMSReferenceLogFile, fetchBankAccounts } from '../../lib/pmsReference';
import { useState } from 'react';
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

  // Group accounts by company and then by bank
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
      <h1>Internal - Bank Account Information</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {Object.keys(groupedData).length === 0 && !error ? (
        <p>No bank account info found.</p>
      ) : (
        Object.entries(groupedData).map(([companyName, banks]) => (
          <div key={companyName}>
            <Typography variant="h5">{companyName}</Typography>
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
                  <Typography>{bankName}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Bank Code</th>
                        <th>Account Type</th>
                        <th>Account Number</th>
                        <th>FPS ID</th>
                        <th>FPS Email</th>
                        <th>Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((account, idx) => (
                        <tr key={idx}>
                          <td>{account.bankCode}</td>
                          <td>{account.accountType}</td>
                          <td>{account.accountNumber}</td>
                          <td>{account.fpsId}</td>
                          <td>{account.fpsEmail}</td>
                          <td>{account.comments}</td>
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
    return {
      redirect: { destination: '/api/auth/signin/google', permanent: false },
    };
  }

  try {
    // Import googleApi ONLY inside server code:
    const { initializeUserApis } = await import('../../lib/googleApi');

    // Create the user-based drive/sheets using their OAuth token
    const { drive, sheets } = initializeUserApis(session.accessToken);

    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);

    // Now fetch bank account data
    const bankAccounts = await fetchBankAccounts(sheets, pmsRefLogFileId);

    return {
      props: { bankAccounts },
    };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return {
      props: {
        bankAccounts: [],
        error: err.message || 'Failed to load bank accounts.',
      },
    };
  }
};
