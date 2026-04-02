import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import type { BalanceAnchor } from "@/domain/types"
import { BalanceAnchorsClient } from "./balance-anchors-client"

export default async function BalanceAnchorsPage() {
  let accounts: string[] = []
  let anchors: BalanceAnchor[] = []

  try {
    const { userId, client } = await getAuthedClient()

    const [metadata, settingsResult] = await Promise.all([
      client.getMetadata(userId),
      client.getSettings(userId),
    ])

    accounts = metadata.accounts.sort()

    // Get saved anchors
    const row = (settingsResult.settings as Record<string, unknown>) ?? {}
    const rawJson = typeof row.settings === "string" ? row.settings : "{}"
    const parsed = JSON.parse(rawJson) as Record<string, unknown>

    anchors = Array.isArray(parsed.balance_anchors) ? parsed.balance_anchors : []
  } catch {
    // Not authenticated or error
  }

  return (
    <AppShell>
      <BalanceAnchorsClient accounts={accounts} initialAnchors={anchors} />
    </AppShell>
  )
}
