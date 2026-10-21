import type { Metadata } from 'next';
import ProjectsScreen from '@/components/screens/ProjectsScreen';

export const metadata: Metadata = { title: 'Projects' };
export default function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; create?: string }>;
}) {
  return <ProjectsScreen searchParams={searchParams} />;
}
