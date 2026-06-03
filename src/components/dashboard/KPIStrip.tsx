'use client'

import { MonthlyRevenue, FiscalYearSummary, RunRateProjection } from '@/types'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${n.toFixed(0)}€`

const fmtPct = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`)

function TrendArrow({ pct }: { pct: number }) {
  const color = pct >= 0 ? 'var(--green)' : 'var(--red)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: '0.85rem', marginLeft: 4 }}>
      {pct >= 0 ? '▲' : '▼'} {fmtPct(pct)}
    </span>
  )
}

interface KPIBlockProps {
  label: string
  value: string
  sub: string
  trend?: number
  accent?: string
}

function KPIBlock({ label, value, sub, trend }: KPIBlockProps) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 20px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
        {sub}
        {trend !== undefined && <TrendArrow pct={trend} />}
      </div>
    </div>
  )
}

export default function KPIStrip({
  monthly,
  fiscal,
  runRate,
}: {
  monthly: MonthlyRevenue[]
  fiscal: FiscalYearSummary
  runRate: RunRateProjection
}) {
  // CA Facturé YTD vs prev year same period
  const theoreticalGrowth = fiscal.prevYearRevenue > 0
    ? ((fiscal.theoreticalRevenue - fiscal.prevYearRevenue) / fiscal.prevYearRevenue) * 100
    : 0

  // CA Encaissé YTD vs prev year same period
  const revenueGrowth = fiscal.revenueGrowthPct

  // Marge Brute Théorique YTD vs prev year
  const prevMargin = fiscal.prevYearGrossMargin
  const marginGrowth = prevMargin > 0
    ? ((fiscal.theoreticalGrossMargin - prevMargin) / prevMargin) * 100
    : 0

  // RunRate vs Last Year Full
  const runRateGrowth = fiscal.prevFullRevenue > 0
    ? ((runRate.total - fiscal.prevFullRevenue) / fiscal.prevFullRevenue) * 100
    : 0

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
      <KPIBlock
        label="CA Facturé YTD"
        value={fmt(fiscal.theoreticalRevenue)}
        sub={`vs ${fmt(fiscal.prevYearRevenue)} N-1`}
        trend={theoreticalGrowth}
      />
      <KPIBlock
        label="CA Encaissé YTD"
        value={fmt(fiscal.totalRevenue)}
        sub={`vs ${fmt(fiscal.prevYearRevenue)} N-1`}
        trend={revenueGrowth}
      />
      <KPIBlock
        label="Marge Brute Théo. YTD"
        value={fmt(fiscal.theoreticalGrossMargin)}
        sub={`${fiscal.theoreticalGrossMarginPct.toFixed(1)}% — vs ${fmt(prevMargin)} N-1`}
        trend={marginGrowth}
      />
      <KPIBlock
        label="Run-Rate vs N-1 Exercice"
        value={fmt(runRate.total)}
        sub={`vs ${fmt(fiscal.prevFullRevenue)} exercice N-1 complet`}
        trend={runRateGrowth}
      />
    </div>
  )
}
