import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LandingPage from '@/components/screens/LandingPage';
import { getLandingSession } from '@/server/landing-session';

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Welcome back to AgentFactory OS.',
};

export default async function WelcomePage() {
  const session = await getLandingSession((await cookies()).toString());
  if (!session?.authenticated) redirect('/login');
  return <LandingPage authenticated />;
}
