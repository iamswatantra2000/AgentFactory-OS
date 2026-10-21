import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthScreen from '@/components/screens/AuthScreen';
import { getLandingSession } from '@/server/landing-session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; returnTo?: string }>;
}) {
  const session = await getLandingSession((await cookies()).toString());
  if (session?.authenticated) redirect('/welcome');
  const query = await searchParams;
  return <AuthScreen mode="login" notice={query.notice} returnTo={query.returnTo} />;
}
