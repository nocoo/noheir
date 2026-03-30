import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { AiSettingsClient } from "./ai-settings-client"

export default async function AiSettingsPage() {
  let aiConfig: Record<string, unknown> = {}

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.getSettings(userId)
    const settings = (result.settings as Record<string, unknown>) ?? {}
    aiConfig = (settings.ai_config as Record<string, unknown>) ?? {}
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <AiSettingsClient aiConfig={aiConfig} />
    </AppShell>
  )
}
