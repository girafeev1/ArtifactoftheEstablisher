// pages/dashboard/projects/[fileId].tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { initializeApis } from '../../../lib/googleApi';
import SidebarLayout from '../../../components/SidebarLayout';
import { findPMSReferenceLogFile, fetchReferenceNames } from '../../../lib/pmsReference';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { useState } from 'react';

/** Adjust columns as needed. If "paid" is stored as "TRUE"/"FALSE", we convert to boolean client-side. */
interface SingleProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';      // store as string to keep it easy
  paidOnDate: string;
  invoice: string;
}

interface FileViewProps {
  fileId: string;
  fileLabel: string; // e.g. "Some Company - 2024"
  projects: SingleProjectData[];
  error?: string;
}

/**
 * The default export component
 */
export default function SingleFilePage({
  fileId,
  fileLabel,
  projects,
  error,
}: FileViewProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SingleProjectData | null>(null);

  // Instead of an "Edit" button, we'll open the dialog on the entire row click
  const handleProjectClick = (project: SingleProjectData) => {
    setEditItem({ ...project }); // clone so we can edit
    setEditDialogOpen(true);
  };

  const handleClose = () => {
    setEditItem(null);
    setEditDialogOpen(false);
  };

  // Save => call /api/info with method=PUT, type=project
  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      // Here, originalIdentifier = the old projectNumber
      // If user changed the projectNumber, that goes in data.projectNumber
      const response = await fetch('/api/info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // so session cookies are sent
        body: JSON.stringify({
          type: 'project',
          data: {
            originalIdentifier: editItem.projectNumber, // the old number
            projectNumber: editItem.projectNumber,       // possibly updated
            projectDate: editItem.projectDate,
            agent: editItem.agent,
            invoiceCompany: editItem.invoiceCompany,
            projectTitle: editItem.projectTitle,
            projectNature: editItem.projectNature,
            amount: editItem.amount,
            paid: editItem.paid,            // "TRUE"/"FALSE"
            paidOnDate: editItem.paidOnDate,
            invoice: editItem.invoice,
          },
        }),
      });
      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Update failed');
      }
      console.log('Project updated successfully');
      handleClose();
      // If you want to refresh the page to see changes, do so:
      // location.reload();
    } catch (err) {
      console.error('Error updating project:', err);
    }
  };

  // Convert from "TRUE"/"FALSE" to boolean in the checkbox
  const isPaid = editItem?.paid === 'TRUE';
  const handleCheckboxChange = (checked: boolean) => {
    if (editItem) {
      setEditItem({ ...editItem, paid: checked ? 'TRUE' : 'FALSE' });
    }
  };

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5">{fileLabel}</Typography>
        {error && <Typography color="error">{error}</Typography>}
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Projects in this file
          </Typography>
          {projects.length === 0 ? (
            <Typography>No rows found.</Typography>
          ) : (
            <List>
              {projects.map((proj) => (
                <ListItem
                  key={proj.projectNumber}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleProjectClick(proj)}
                >
                  <ListItemText
                    primary={`${proj.projectNumber} — ${proj.projectTitle}`}
                    secondary={`$${proj.amount} | ${
                      proj.paid === 'TRUE' ? 'Paid' : 'Unpaid'
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog => opens upon row click */}
      <Dialog open={editDialogOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        {editItem && (
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Project Number"
              value={editItem.projectNumber}
              onChange={(e) =>
                setEditItem({ ...editItem, projectNumber: e.target.value })
              }
            />
            <TextField
              label="Project Title"
              value={editItem.projectTitle}
              onChange={(e) =>
                setEditItem({ ...editItem, projectTitle: e.target.value })
              }
            />
            <TextField
              label="Amount"
              value={editItem.amount}
              onChange={(e) => setEditItem({ ...editItem, amount: e.target.value })}
            />
            {/* Paid as a checkbox */}
            <FormControlLabel
              control={
                <Checkbox
                  checked={isPaid}
                  onChange={(e) => handleCheckboxChange(e.target.checked)}
                />
              }
              label="Paid"
            />
            {/* If paid===TRUE, show "Paid On Date" */}
            {isPaid && (
              <TextField
                label="Paid On Date"
                type="date"
                value={editItem.paidOnDate}
                onChange={(e) =>
                  setEditItem({ ...editItem, paidOnDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
            )}
            {/* You can add more fields, e.g. agent, invoice, etc. */}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </SidebarLayout>
  );
}

/** SSR => read rows from e.g. "Project Overview!A5:J", parse them, and build your <FileViewProps>. */
export const getServerSideProps: GetServerSideProps<FileViewProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return {
      redirect: { destination: '/api/auth/signin/google', permanent: false },
    };
  }
  const fileId = ctx.params?.fileId as string;
  if (!fileId) {
    return { notFound: true };
  }

  try {
    // 1) Initialize
    const { drive, sheets } = initializeApis('user', {
      accessToken: session.accessToken as string,
    });
    // 2) Maybe find the short code, year => build fileLabel
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'id, name',
      supportsAllDrives: true,
    });
    const rawName = fileMeta.data.name || '';
    // parse e.g. "2024 XYZ Project Overview"
    let year = '';
    let shortCode = '';
    const nameMatch = rawName.match(/^(\d{4})\s+(\S+)\s+Project Overview/i);
    if (nameMatch) {
      year = nameMatch[1];
      shortCode = nameMatch[2];
    }
    // get reference mapping => find the full name
    const pmsRefLogId = await findPMSReferenceLogFile(drive);
    const refResp = await fetchReferenceNames(sheets, pmsRefLogId);
    const fullCoName = refResp[shortCode] || shortCode || 'Unknown Company';
    const fileLabel = `${fullCoName} - ${year}`;

    // 3) read from A5:J (or whatever)
    const range = 'Project Overview!A6:J';
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: fileId,
      range,
    });
    const rows = resp.data.values || [];
    const projects: SingleProjectData[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue; // skip empty
      // interpret paid as "TRUE"/"FALSE"
      const paidVal = (r[7] || '').toString().toUpperCase(); // e.g. "TRUE" or "FALSE"
      const amountRaw = (r[6] || '').toString().replace(/[^0-9.]/g, '');
      projects.push({
        projectNumber: r[0],
        projectDate: r[1] || '',
        agent: r[2] || '',
        invoiceCompany: r[3] || '',
        projectTitle: r[4] || '',
        projectNature: r[5] || '',
        amount: amountRaw || '0',
        paid: paidVal === 'TRUE' ? 'TRUE' : 'FALSE',
        paidOnDate: r[8] || '',
        invoice: r[9] || '',
      });
    }

    return {
      props: {
        fileId,
        fileLabel,
        projects,
      },
    };
  } catch (err: any) {
    console.error('[getServerSideProps fileId] error:', err);
    return {
      props: {
        fileId,
        fileLabel: '',
        projects: [],
        error: err.message || 'Error retrieving file data',
      },
    };
  }
};
