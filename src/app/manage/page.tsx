import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { ManageClient } from "./manage-client"

export default async function ManagePage() {
  let stats = { transactionCount: 0, transferCount: 0, years: [] as number[] }

  try {
    const { userId, client } = await getAuthedClient()
    const metadata = await client.getMetadata(userId)
    stats = {
      transactionCount: metadata.transaction_count,
      transferCount: metadata.transfer_count,
      years: metadata.years,
    }
  } catch {
    // Not authenticated or Worker unavailable
  }

  return (
    <AppShell>
      <ManageClient stats={stats} />
    </AppShell>
  )
}
