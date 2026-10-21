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
  const cookieStore = await cookies();
  const session = await getLandingSession(cookieStore.toString());
  if (!session?.authenticated)
    redirect(
      cookieStore.has('af_session') && session?.authenticated === false
        ? '/login?notice=session-expired'
        : '/login',
    );
  return <LandingPage authenticated />;
}
