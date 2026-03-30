import { AppShell } from "@/components/layout"
import { getAuthedClient } from "@/lib/api-helpers"
import { toDomainUnit, toUnitDisplayInfo } from "@/lib/capital-mappers"
import {
  buildTotalAssetsByCurrency,
  buildTotalAssetsAll,
  buildDeploymentRate,
  buildIdleUnits,
  buildCurrencyDistribution,
  buildStatusDistribution,
  buildMaturityDistribution,
} from "@/domain/assets/capital-dashboard"
import { CapitalDashboardClient } from "./capital-dashboard-client"

export default async function CapitalDashboardPage() {
  let units: ReturnType<typeof toUnitDisplayInfo>[] = []

  try {
    const { userId, client } = await getAuthedClient()
    const result = await client.listUnits(userId, { with_products: true })
    units = result.units
      .map((raw) => toDomainUnit(raw as Record<string, unknown>))
      .map(toUnitDisplayInfo)
  } catch {
    // Not authenticated or Worker unavailable
  }

  const totalsByCurrency = buildTotalAssetsByCurrency(units)
  const totalAll = buildTotalAssetsAll(totalsByCurrency)
  const deploymentRate = buildDeploymentRate()
  const idleUnits = buildIdleUnits(units)
  const currencyDist = buildCurrencyDistribution(units, totalAll)
  const statusDist = buildStatusDistribution(units, totalAll)
  const maturityDist = buildMaturityDistribution(units, totalAll)

  return (
    <AppShell>
      <CapitalDashboardClient
        totalsByCurrency={totalsByCurrency}
        totalAll={totalAll}
        deploymentRate={deploymentRate}
        idleUnitsCount={idleUnits.length}
        idleFunds={idleUnits.reduce((sum, u) => sum + u.amount, 0)}
        currencyDistribution={currencyDist.map((d) => ({ name: d.currency, value: d.amount, percentage: d.percentage }))}
        statusDistribution={statusDist.map((d) => ({ name: d.status, value: d.amount, percentage: d.percentage }))}
        maturityDistribution={maturityDist.map((d) => ({ name: d.period, value: d.amount, percentage: d.percentage }))}
      />
    </AppShell>
  )
}
