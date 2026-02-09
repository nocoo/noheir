import { AISettings } from '@/components/dashboard/AISettings';
import { McpSettings } from '@/components/dashboard/McpSettings';

export function AISettingsPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <AISettings />
      <McpSettings />
    </div>
  );
}
