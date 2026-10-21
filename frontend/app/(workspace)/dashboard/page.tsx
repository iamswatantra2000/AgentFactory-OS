import type { Metadata } from 'next';
import ProjectsScreen from '@/components/screens/ProjectsScreen';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; create?: string }>;
}) {
  return <ProjectsScreen searchParams={searchParams} />;
}
