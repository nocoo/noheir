import { AppShell } from "@/components/layout"
import { ImportClient } from "./import-client"

export default async function ImportPage() {
  return (
    <AppShell>
      <ImportClient />
    </AppShell>
  )
}
