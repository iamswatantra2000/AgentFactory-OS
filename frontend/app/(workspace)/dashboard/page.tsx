import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DashboardScreen from '@/components/screens/DashboardScreen';
import { getLandingSession } from '@/server/landing-session';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await getLandingSession((await cookies()).toString());
  if (!session?.authenticated) redirect('/login');
  return <DashboardScreen user={session.user} />;
}
