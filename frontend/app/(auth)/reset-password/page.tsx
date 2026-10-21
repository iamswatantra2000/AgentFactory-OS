import type { Metadata } from 'next';
import AuthScreen from '@/components/screens/AuthScreen';
export const metadata: Metadata = { title: 'Reset password' };
export default function Page() {
  return <AuthScreen mode="reset-password" />;
}
