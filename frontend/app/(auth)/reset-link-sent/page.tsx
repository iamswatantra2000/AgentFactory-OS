import type { Metadata } from 'next';
import AuthResultScreen from '@/components/screens/AuthResultScreen';
export const metadata: Metadata = { title: 'Reset link sent' };
export default function Page() {
  return <AuthResultScreen kind="reset-link-sent" />;
}
