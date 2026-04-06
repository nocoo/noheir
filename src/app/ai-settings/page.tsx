import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { AiSettingsClient } from "./ai-settings-client"

export default async function AiSettingsPage() {
  let aiConfig: Record<string, unknown> = {}
  const mcpParams = {
    workerUrl: `${process.env.WORKER_URL ?? ""}/mcp`,
  }

  try {
    const { userId, client } = await getAuthedClient()

    const result = await client.getSettings(userId)
    const row = (result.settings as Record<string, unknown>) ?? {}
    const rawJson = typeof row.settings === "string" ? row.settings : "{}"
    const parsed = JSON.parse(rawJson) as Record<string, unknown>
    aiConfig = (parsed.ai_config as Record<string, unknown>) ?? {}
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <AiSettingsClient aiConfig={aiConfig} mcpParams={mcpParams} />
    </AppShell>
  )
}
