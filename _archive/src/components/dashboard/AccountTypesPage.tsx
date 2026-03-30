import { AccountTypeSettings } from '@/components/dashboard/AccountTypeSettings';
import { BalanceAnchorSettings } from '@/components/dashboard/BalanceAnchorSettings';

export function AccountTypesPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <AccountTypeSettings />
      <BalanceAnchorSettings />
    </div>
  );
}
