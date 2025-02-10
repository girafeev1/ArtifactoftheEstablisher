// components/EditProject.tsx

import React, { useEffect, useState } from 'react';
import ViewProjectDialog from './ViewProjectDialog';
import EditProjectDialog from './EditProjectDialog';

interface BankAccount {
  companyName: string;
  bankName: string;
  bankCode: string;
  accountType: string;
  accountNumber: string;
  fpsId?: string;
  fpsEmail?: string;
  comments?: string;
  identifier?: string;
}

interface ProjectData {
  projectNumber: string;
  projectDate: string;
  agent: string;
  invoiceCompany: string;
  projectTitle: string;
  projectNature: string;
  amount: string;
  paid: 'TRUE' | 'FALSE';
  paidOnDate: string;
  bankAccountIdentifier: string;
  invoice: string;
}

interface EditProjectProps {
  open: boolean;
  onClose: () => void;
  fileId: string;
  initialProject: ProjectData | null;
  onUpdated: () => void;
  bankAccounts?: BankAccount[];
  onCreateInvoice?: () => void;
  companyNameOfFile?: string;
}

export default function EditProject({
  open,
  onClose,
  fileId,
  initialProject,
  onUpdated,
  bankAccounts,
  onCreateInvoice,
  companyNameOfFile,
}: EditProjectProps) {
  // We store the project details in state
  const [project, setProject] = useState<ProjectData | null>(null);
  // isEditing => false => read-only, true => editable
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (open && initialProject) {
      console.log('[EditProject] open => copying initialProject => read-only by default');
      setProject({ ...initialProject });
      setIsEditing(false);
    }
  }, [open, initialProject]);

  // If no project or not open => no dialog
  if (!project) {
    return null;
  }

  function handleToggleEdit() {
    setIsEditing((prev) => !prev);
  }

  function handleCreateInvoice() {
    if (onCreateInvoice) {
      onCreateInvoice();
      onClose();
    }
  }

  // In read-only mode => show <ViewProjectDialog>
  if (!isEditing) {
    return (
      <ViewProjectDialog
        open={open}
        onClose={onClose}
        project={project}
        onToggleEdit={handleToggleEdit}
        onCreateInvoice={handleCreateInvoice}
      />
    );
  }

  // In editing mode => show <EditProjectDialog>
  return (
    <EditProjectDialog
      open={open}
      onClose={onClose}
      fileId={fileId}
      project={project}
      setProject={setProject}
      onUpdated={onUpdated}
      bankAccounts={bankAccounts}
      companyNameOfFile={companyNameOfFile}
      onToggleEdit={handleToggleEdit}
    />
  );
}
