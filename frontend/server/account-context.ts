import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLandingSession } from '@/server/landing-session';
import { getProjects, getWorkspaceMembers } from '@/server/projects';

export async function getAccountContext() {
  const cookieStore = await cookies();
  const header = cookieStore.toString();
  const session = await getLandingSession(header);
  if (!session?.authenticated) redirect('/login');
  const [projects, members] = await Promise.all([getProjects(header), getWorkspaceMembers(header)]);
  return { user: session.user, projects, members };
}
