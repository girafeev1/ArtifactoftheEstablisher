// pages/dashboard/projects.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { Session } from 'next-auth';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeUserApis } from '../../lib/googleApi';
import { listProjectOverviewFiles } from '../../lib/projectOverview';
// (Your existing function that does the Drive search)

interface ProjectProps {
  user: Session['user'];
  projectsByCategory: Record<string, any[]>;
}

export default function ProjectsPage({ user, projectsByCategory }: ProjectProps) {
  return (
    <SidebarLayout>
      <h1>Projects</h1>
      <button onClick={() => alert('Go to a new project form...')}>
        New Project
      </button>
      <hr />

      {Object.keys(projectsByCategory).length === 0 ? (
        <p>No Project Overview files found.</p>
      ) : (
        Object.entries(projectsByCategory).map(([yearOrCode, projects]) => (
          <div key={yearOrCode} style={{ marginTop: '1rem' }}>
            <h2>{yearOrCode}</h2>
            <ul>
              {projects.map((p: any) => (
                <li key={p.file.id}>
                  <strong>{p.fullCompanyName}</strong> - {p.file.name} (
                  {p.file.id})
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </SidebarLayout>
  );
}

export const getServerSideProps: GetServerSideProps<ProjectProps> = async (ctx) => {
  const session = await getSession(ctx);
  if (!session || !session.accessToken) {
    return {
      redirect: {
        destination: '/api/auth/signin/google',
        permanent: false,
      },
    };
  }

  // 1. Initialize user-based Google APIs
  const { drive, sheets } = initializeUserApis(session.accessToken);

  // 2. If you need the "subsidiaryData" from PMS Reference Log:
  //    e.g., to map abbreviations => full names
  //    (Pseudo-code)
  // const secrets = await loadSecrets();
  // const pmsRefId = secrets.PMS_REFERENCE_LOG_ID;
  // const subsidiaryData = await fetchReferenceOfSubsidiaryNames(sheets, pmsRefId);

  // For now, assume you have some "subsidiaryData" or an empty array
  const subsidiaryData = [];

  // 3. List the user’s visible Project Overview files
  const projectsByCategory = await listProjectOverviewFiles(drive, subsidiaryData);

  return {
    props: {
      user: session.user,
      projectsByCategory,
    },
  };
};
