import type { Metadata } from 'next';
import AuthScreen from '@/components/screens/AuthScreen';
export const metadata: Metadata = { title: 'Verify email' };
export default function Page() {
  return <AuthScreen mode="verify-email" />;
}
