import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { SettingsClient } from "./settings-client"

export default async function SettingsPage() {
  let siteName = ""
  let settingsJson: Record<string, unknown> = {}

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.getSettings(userId)
    const row = (result.settings as Record<string, unknown>) ?? {}
    siteName = String(row.siteName ?? "")
    const rawJson = typeof row.settings === "string" ? row.settings : "{}"
    settingsJson = JSON.parse(rawJson) as Record<string, unknown>
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <SettingsClient siteName={siteName} settingsJson={settingsJson} />
    </AppShell>
  )
}
