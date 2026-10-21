import type { Metadata } from 'next';
import AuthResultScreen from '@/components/screens/AuthResultScreen';
export const metadata: Metadata = { title: 'Password reset complete' };
export default function Page() {
  return <AuthResultScreen kind="reset-complete" />;
}
