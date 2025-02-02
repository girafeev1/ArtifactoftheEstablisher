// pages/dashboard/projects/[fileId].tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { initializeApis } from '../../../lib/googleApi';
import SidebarLayout from '../../../components/SidebarLayout';
import { findPMSReferenceLogFile, fetchReferenceNames } from '../../../lib/pmsReference';
import { fetchProjectRows } from '../../../lib/projectOverview';
import { useState } from 'react';
import { useRouter } from 'next/router';
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
  IconButton,
  Grid
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface SingleProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  invoice: string;
}

interface FileViewProps {
  fileId: string;
  fileLabel: string; // e.g., "Full Company Name - 2024"
  projects: SingleProjectData[];
  error?: string;
}

/**
 * Inline EditableField component.
 * Displays a text value with a pencil icon; when clicked, becomes an input field.
 */
function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      autoFocus
      fullWidth
    />
  ) : (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Typography sx={{ flexGrow: 1 }}>{value || '—'}</Typography>
      <IconButton size="small" onClick={() => setEditing(true)}>
        <EditIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

/**
 * Helper to generate a new project number.
 * Assumes format "#YYYY-XXX" where XXX is numeric.
 */
function generateNewProjectNumber(projects: SingleProjectData[], year: string): string {
  const numbers = projects
    .filter((p) => p.projectNumber.startsWith(`#${year}-`))
    .map((p) => {
      const parts = p.projectNumber.split('-');
      return parts[1] ? parseInt(parts[1], 10) : 0;
    });
  const max = numbers.length ? Math.max(...numbers) : 0;
  const newNum = (max + 1).toString().padStart(3, '0');
  return `#${year}-${newNum}`;
}

export default function SingleFilePage({ fileId, fileLabel, projects, error }: FileViewProps) {
  const router = useRouter();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<SingleProjectData | null>(null);
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  // Declare newProject state (as Partial<SingleProjectData>)
  const [newProject, setNewProject] = useState<Partial<SingleProjectData>>({});
  const [projectList, setProjectList] = useState<SingleProjectData[]>(projects);

  // "Back to Projects" button
  const handleBack = () => {
    router.push('/dashboard/projects');
  };

  // Open edit dialog on row click
  const handleProjectClick = (project: SingleProjectData) => {
    console.log('Project clicked for editing:', project);
    setEditItem({ ...project });
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditItem(null);
    setEditDialogOpen(false);
  };

  // Save edited project by calling API route for update
  const handleSaveEdit = async () => {
    if (!editItem) return;
    try {
      console.log('Submitting update for project:', editItem);
      const response = await fetch(`/api/projects/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          originalIdentifier: editItem.projectNumber,
          projectNumber: editItem.projectNumber,
          projectDate: editItem.projectDate,
          agent: editItem.agent,
          invoiceCompany: editItem.invoiceCompany,
          projectTitle: editItem.projectTitle,
          projectNature: editItem.projectNature,
          amount: editItem.amount,
          paid: editItem.paid,
          paidOnDate: editItem.paidOnDate,
          invoice: editItem.invoice,
        }),
      });
      const text = await response.text();
      console.log('Raw API response text:', text);
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        throw new Error('API response is not valid JSON.');
      }
      if (!response.ok) {
        throw new Error(json.error || 'Update failed');
      }
      console.log('Project updated successfully:', json);
      router.replace(router.asPath);
      handleCloseEditDialog();
    } catch (err: any) {
      console.error('Error updating project:', err);
    }
  };

  // For edit dialog, convert "TRUE"/"FALSE" to boolean for the checkbox.
  const isPaid = editItem?.paid === 'TRUE';
  const handleCheckboxChange = (checked: boolean) => {
    if (editItem) {
      setEditItem({ ...editItem, paid: checked ? 'TRUE' : 'FALSE' });
    }
  };

  // New Project: generate new project number based on existing projects and the year from fileLabel.
  const handleNewProject = () => {
    // Extract year from fileLabel (assumed format "Full Company Name - YYYY")
    const parts = fileLabel.split(' - ');
    const year = parts[1] || new Date().getFullYear().toString();
    const newProjNum = generateNewProjectNumber(projectList, year);
    setNewProject({
      projectNumber: newProjNum,
      projectDate: '',
      agent: '',
      invoiceCompany: '',
      projectTitle: '',
      projectNature: '',
      amount: '',
      paid: 'FALSE',
      paidOnDate: '',
      invoice: '',
    });
    setNewProjectDialogOpen(true);
  };

  const handleCloseNewProjectDialog = () => {
    setNewProjectDialogOpen(false);
  };

  const handleSubmitNewProject = async () => {
    if (!newProject.projectNumber || !newProject.projectDate || !newProject.invoiceCompany || !newProject.projectTitle || newProject.amount === undefined) {
      console.error('Missing required fields in new project');
      return;
    }
    try {
      console.log('Submitting new project:', newProject);
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileId,
          projectNumber: newProject.projectNumber,
          projectDate: newProject.projectDate,
          agent: newProject.agent,
          invoiceCompany: newProject.invoiceCompany,
          projectTitle: newProject.projectTitle,
          projectNature: newProject.projectNature,
          amount: parseFloat(newProject.amount as string),
          paid: newProject.paid,
          paidOnDate: newProject.paidOnDate,
        }),
      });
      const text = await response.text();
      console.log('Raw API response text (new project):', text);
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error('Error parsing JSON for new project:', e);
        throw new Error('API response is not valid JSON.');
      }
      if (!response.ok) {
        throw new Error(json.error || 'New project creation failed');
      }
      console.log('New project created successfully:', json);
      router.replace(router.asPath);
      handleCloseNewProjectDialog();
    } catch (err: any) {
      console.error('Error creating new project:', err);
    }
  };

  return (
    <SidebarLayout>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton onClick={handleBack} aria-label="Back to Projects">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1, textAlign: 'center' }}>Project Details</Typography>
        <Button variant="contained" onClick={handleNewProject}>New Project</Button>
      </Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Project Details</Typography>
          {projectList.length === 0 ? (
            <Typography>No project rows found.</Typography>
          ) : (
            <List>
              {projectList.map((proj) => (
                <ListItem key={proj.projectNumber} sx={{ cursor: 'pointer' }} onClick={() => handleProjectClick(proj)}>
                  <ListItemText
                    primary={`${proj.projectNumber} — ${proj.projectTitle}`}
                    secondary={
                      `$${proj.amount} | ${proj.paid === 'TRUE' ? 'Paid' : 'Unpaid'}` +
                      (proj.paid === 'TRUE' && proj.paidOnDate ? ` | ${proj.paidOnDate}` : '')
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Project</DialogTitle>
        {editItem && (
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <EditableField label="Project Number" value={editItem.projectNumber} onChange={(val) => setEditItem({ ...editItem, projectNumber: val })} />
            <EditableField label="Project Date" value={editItem.projectDate} onChange={(val) => setEditItem({ ...editItem, projectDate: val })} />
            <EditableField label="Agent" value={editItem.agent} onChange={(val) => setEditItem({ ...editItem, agent: val })} />
            <EditableField label="Invoice Company" value={editItem.invoiceCompany} onChange={(val) => setEditItem({ ...editItem, invoiceCompany: val })} />
            <EditableField label="Project Title" value={editItem.projectTitle} onChange={(val) => setEditItem({ ...editItem, projectTitle: val })} />
            <EditableField label="Project Nature" value={editItem.projectNature} onChange={(val) => setEditItem({ ...editItem, projectNature: val })} />
            <EditableField label="Amount" value={editItem.amount} onChange={(val) => setEditItem({ ...editItem, amount: val })} />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ flexGrow: 1 }}>Paid</Typography>
              <Checkbox checked={isPaid} onChange={(e) => handleCheckboxChange(e.target.checked)} />
              <IconButton size="small" disabled>
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
            {isPaid && (
              <EditableField label="Paid On Date" value={editItem.paidOnDate} onChange={(val) => setEditItem({ ...editItem, paidOnDate: val })} />
            )}
            <EditableField label="Invoice" value={editItem.invoice} onChange={(val) => setEditItem({ ...editItem, invoice: val })} />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
      {/* New Project Dialog */}
      <Dialog open={newProjectDialogOpen} onClose={handleCloseNewProjectDialog} maxWidth="sm" fullWidth>
        <DialogTitle>New Project</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Project Number"
            value={newProject.projectNumber || ''}
            InputProps={{ readOnly: true }}
            fullWidth
          />
          <TextField
            label="Project Date"
            type="date"
            value={newProject.projectDate || ''}
            onChange={(e) => setNewProject({ ...newProject, projectDate: e.target.value })}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Agent"
            value={newProject.agent || ''}
            onChange={(e) => setNewProject({ ...newProject, agent: e.target.value })}
            fullWidth
          />
          <TextField
            label="Invoice Company"
            value={newProject.invoiceCompany || ''}
            onChange={(e) => setNewProject({ ...newProject, invoiceCompany: e.target.value })}
            fullWidth
          />
          <TextField
            label="Project Title"
            value={newProject.projectTitle || ''}
            onChange={(e) => setNewProject({ ...newProject, projectTitle: e.target.value })}
            fullWidth
          />
          <TextField
            label="Project Nature"
            value={newProject.projectNature || ''}
            onChange={(e) => setNewProject({ ...newProject, projectNature: e.target.value })}
            fullWidth
          />
          <TextField
            label="Amount"
            type="number"
            value={newProject.amount || ''}
            onChange={(e) => setNewProject({ ...newProject, amount: e.target.value })}
            fullWidth
          />
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ flexGrow: 1 }}>Paid</Typography>
            <Checkbox
              checked={newProject.paid === 'TRUE' || newProject.paid === true}
              onChange={(e) =>
                setNewProject({ ...newProject, paid: e.target.checked ? 'TRUE' : 'FALSE' })
              }
            />
          </Box>
          {newProject.paid === 'TRUE' && (
            <TextField
              label="Paid On Date"
              type="date"
              value={newProject.paidOnDate || ''}
              onChange={(e) => setNewProject({ ...newProject, paidOnDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewProjectDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitNewProject}>Submit</Button>
        </DialogActions>
      </Dialog>
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FileViewProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }
  const fileId = ctx.params?.fileId as string;
  if (!fileId) {
    return { notFound: true };
  }
  try {
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken as string });
    const fileMeta = await drive.files.get({
      fileId,
      fields: 'id, name',
      supportsAllDrives: true,
    });
    const rawName = fileMeta.data.name || '';
    let year = '';
    let shortCode = '';
    const nameMatch = rawName.match(/^(\d{4})\s+(\S+)\s+Project Overview/i);
    if (nameMatch) {
      year = nameMatch[1];
      shortCode = nameMatch[2];
    }
    const pmsRefLogFileId = await findPMSReferenceLogFile(drive);
    const refMapping = await fetchReferenceNames(sheets, pmsRefLogFileId);
    const fullCoName = refMapping[shortCode] || shortCode || 'Unknown Company';
    const fileLabel = `${fullCoName} - ${year}`;
    const projects = await fetchProjectRows(sheets, fileId, 6);
    return { props: { fileId, fileLabel, projects } };
  } catch (err: any) {
    console.error('[getServerSideProps fileId] error:', err);
    return { props: { fileId, fileLabel: '', projects: [], error: err.message || 'Error retrieving file data' } };
  }
};
