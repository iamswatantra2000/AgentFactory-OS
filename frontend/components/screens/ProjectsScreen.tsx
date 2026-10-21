import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ProjectsHome } from '@/components/screen-components/Projects/ProjectsHome';
import { getLandingSession } from '@/server/landing-session';
import { getProjects, getWorkspaceMembers } from '@/server/projects';

export default async function ProjectsScreen({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; create?: string }>;
}) {
  const cookieStore = await cookies();
  const header = cookieStore.toString();
  const session = await getLandingSession(header);
  if (!session?.authenticated)
    redirect(
      cookieStore.has('af_session') && session?.authenticated === false
        ? '/login?notice=session-expired'
        : '/login',
    );

  const [data, members] = await Promise.all([getProjects(header), getWorkspaceMembers(header)]);
  const query = await searchParams;
  return (
    <ProjectsHome
      user={session.user}
      data={data}
      members={members}
      renderedAt={new Date().toISOString()}
      initialTemplate={query.template}
      openCreate={query.create === '1'}
    />
  );
}
