import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  let settings: Record<string, unknown> = {}

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.getSettings(userId)
    settings = (result.settings as Record<string, unknown>) ?? {}
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <SettingsClient settings={settings} />
    </AppShell>
  )
}
