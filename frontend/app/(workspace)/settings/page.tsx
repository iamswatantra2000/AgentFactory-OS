import { AccountArea } from '@/components/screen-components/Projects/AccountArea';
import { getAccountContext } from '@/server/account-context';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const context = await getAccountContext();
  return <AccountArea area="settings" notice={(await searchParams).notice} {...context} />;
}
