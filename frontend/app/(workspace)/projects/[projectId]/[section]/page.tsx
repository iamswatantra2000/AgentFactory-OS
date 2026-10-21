import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ProjectOverview } from '@/components/screen-components/Projects/ProjectOverview';
import { ProjectSetup } from '@/components/screen-components/Projects/ProjectSetup';
import { getLandingSession } from '@/server/landing-session';
import { getProject, getProjects } from '@/server/projects';

export const metadata: Metadata = { title: 'Project' };
const sections = new Set([
  'overview',
  'playground',
  'agents',
  'work',
  'knowledge',
  'reviews',
  'analytics',
  'team',
  'settings',
  'setup',
]);

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string; section: string }>;
}) {
  const { projectId, section } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !sections.has(section)) notFound();
  const cookieStore = await cookies();
  const header = cookieStore.toString();
  const session = await getLandingSession(header);
  if (!session?.authenticated)
    redirect(
      `/login?notice=session-expired&returnTo=${encodeURIComponent(`/projects/${projectId}/${section}`)}`,
    );
  const [project, list] = await Promise.all([getProject(header, projectId), getProjects(header)]);
  if (!project)
    return (
      <main
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          textAlign: 'center',
          fontFamily: 'var(--af-font-interface)',
          padding: 24,
        }}
      >
        <h1>{list ? 'You don’t have access to this project' : 'Projects are unavailable'}</h1>
        <p>
          {list
            ? 'It may have been removed, or you may need an Owner or Admin to add you to the project.'
            : 'The project service could not be reached. Your account and project data remain safe.'}
        </p>
        <a href="/projects">Back to Projects</a>
      </main>
    );
  if (project.status === 'preparing' && section !== 'setup')
    redirect(`/projects/${projectId}/setup`);
  if (project.status !== 'preparing' && section === 'setup')
    redirect(`/projects/${projectId}/overview`);
  if (section === 'setup') return <ProjectSetup project={project} />;
  return <ProjectOverview project={project} list={list} user={session.user} section={section} />;
}
