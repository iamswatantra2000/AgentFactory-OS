import type { Metadata } from 'next';
import AuthScreen from '@/components/screens/AuthScreen';
export const metadata: Metadata = { title: 'Forgot password' };
export default function Page() {
  return <AuthScreen mode="forgot-password" />;
}
