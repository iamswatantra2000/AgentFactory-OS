import type { Metadata } from 'next';
import AuthResultScreen from '@/components/screens/AuthResultScreen';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLandingSession } from '@/server/landing-session';
export const metadata: Metadata = { title: 'Email verified' };
export default async function Page() {
  const session = await getLandingSession((await cookies()).toString());
  if (!session?.authenticated) redirect('/login');
  return <AuthResultScreen kind="email-verified" />;
}
