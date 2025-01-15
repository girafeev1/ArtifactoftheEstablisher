// pages/dashboard/projects.tsx

import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import SidebarLayout from '../../components/SidebarLayout';
import { initializeApis } from '../../lib/googleApi';
import { listProjectOverviewFiles } from '../../lib/pmsReference';

interface ProjectProps {
  projectsByCategory: Record<string, any[]>;
  error?: string;
}

export default function ProjectsPage({ projectsByCategory, error }: ProjectProps) {
  return (
    <SidebarLayout>
      <h1>Projects</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {Object.keys(projectsByCategory).length === 0 ? (
        <p>No Project Overview files found.</p>
      ) : (
        Object.entries(projectsByCategory).map(([year, projects]) => (
          <div key={year}>
            <h2>{year}</h2>
            <ul>
              {projects.map((project) => (
                <li key={project.file.id}>
                  {project.fullCompanyName} - {project.file.name}
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
  if (!session?.accessToken) {
    return { redirect: { destination: '/api/auth/signin/google', permanent: false } };
  }

  try {
    const { initializeApis } = await import('../../lib/googleApi');
    const { drive, sheets } = initializeApis('user', { accessToken: session.accessToken });

    const projectsByCategory = await listProjectOverviewFiles(drive);

    return {
      props: { projectsByCategory },
    };
  } catch (err: any) {
    console.error('[getServerSideProps] Error:', err);
    return { props: { projectsByCategory: {}, error: err.message } };
  }
};
