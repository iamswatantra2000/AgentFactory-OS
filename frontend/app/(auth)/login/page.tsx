import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthScreen from '@/components/screens/AuthScreen';
import { getLandingSession } from '@/server/landing-session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const session = await getLandingSession((await cookies()).toString());
  if (session?.authenticated) redirect('/welcome');
  return <AuthScreen mode="login" />;
}
