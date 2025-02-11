// components/projectdialog/editprojectdialog/EditProject.tsx

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
  invoiceUrl?: string; // so we can handle hyperlink separately
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
  const [project, setProject] = useState<ProjectData | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (open && initialProject) {
      console.log('[EditProject] open => copying initialProject => read-only by default');
      setProject({ ...initialProject });
      setIsEditing(false);
    }
  }, [open, initialProject]);

  function handleToggleEdit() {
    setIsEditing((prev) => !prev);
  }

  function handleCreateInvoice() {
    if (onCreateInvoice) {
      onCreateInvoice();
      onClose();
    }
  }

  if (!project) {
    return null;
  }

  // If not editing => show <ViewProjectDialog>
  if (!isEditing) {
    return (
      <ViewProjectDialog
        open={open}
        onClose={onClose}
        project={project}
        onToggleEdit={handleToggleEdit}
        onCreateInvoice={handleCreateInvoice}
        bankAccounts={bankAccounts}
        fileId={fileId}
      />
    );
  }

  // else => show <EditProjectDialog>
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
