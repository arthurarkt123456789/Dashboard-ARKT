'use client'

import { HealthStatus } from '@/types'
import { StatusBadge } from '@/components/ui/Badge'

const fmt = (n: number) => n.toFixed(1)

export default function HealthBar({ health }: { health: HealthStatus }) {
  return (
    <div className="health-bar">
      <div className="health-item">
        <div className="health-item-title">Santé commerciale</div>
        <StatusBadge status={health.commercial} />
        <div className="health-item-sub">
          Croissance CA : {health.revenueGrowthPct >= 0 ? '+' : ''}{fmt(health.revenueGrowthPct)}% vs N-1
        </div>
      </div>
      <div className="health-divider" />
      <div className="health-item">
        <div className="health-item-title">Santé financière</div>
        <StatusBadge status={health.financial} />
        <div className="health-item-sub">
          Marge brute : {fmt(health.grossMarginPct)}%
        </div>
      </div>
      <div className="health-divider" />
      <div className="health-item">
        <div className="health-item-title">Indicateur de risque</div>
        <StatusBadge status={health.danger} />
        <div className="health-item-sub">
          Runway : <strong>{health.runwayMonths} mois</strong> confirmés
          {health.runwayWithSigned > 0 && ` · ${fmt(health.runwayWithSigned)}m avec facturé`}
          {health.runwayWithPipeline > 0 && ` · ${fmt(health.runwayWithPipeline)}m avec pipeline`}
        </div>
      </div>
    </div>
  )
}
