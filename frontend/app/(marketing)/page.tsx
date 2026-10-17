import type { Metadata } from 'next';
import LandingPage from '@/components/screens/LandingPage';

export const metadata: Metadata = {
  title: 'AgentFactory OS — Design the work. Keep the judgment.',
  description:
    'Design your AI-enabled company around clear roles, shared context, and human decisions. Explore the AgentFactory OS product preview.',
};

export default function MarketingHome() {
  return <LandingPage />;
}
