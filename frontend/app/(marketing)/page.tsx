import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLandingSession } from '@/server/landing-session';
import LandingPage from '@/components/screens/LandingPage';

export const metadata: Metadata = {
  title: 'AgentFactory OS — Design the work. Keep the judgment.',
  description:
    'Design your AI-enabled company around clear roles, shared context, and human decisions. Explore the AgentFactory OS product preview.',
};

export default async function MarketingHome() {
  const session = await getLandingSession((await cookies()).toString());
  if (session?.authenticated) redirect('/welcome');
  return <LandingPage showEntrance />;
}
