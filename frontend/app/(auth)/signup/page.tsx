import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthScreen from '@/components/screens/AuthScreen';
import { getLandingSession } from '@/server/landing-session';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage() {
  const session = await getLandingSession((await cookies()).toString());
  if (session?.authenticated) redirect('/welcome');
  return <AuthScreen mode="signup" />;
}
