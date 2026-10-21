import { AccountArea } from '@/components/screen-components/Projects/AccountArea';
import { getAccountContext } from '@/server/account-context';
export default async function Page() {
  const context = await getAccountContext();
  return <AccountArea area="plan" {...context} />;
}
