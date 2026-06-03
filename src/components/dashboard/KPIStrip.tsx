'use client'

import { FiscalYearSummary, RunRateProjection } from '@/types'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${Math.round(n)}€`

const fmtPct = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`)

function TrendArrow({ pct }: { pct: number }) {
  const color = pct >= 0 ? 'var(--green)' : 'var(--red)'
  return (
    <span style={{ color, fontWeight: 700, fontSize: '0.85rem', marginLeft: 4 }}>
      {pct >= 0 ? '▲' : '▼'} {fmtPct(pct)}
    </span>
  )
}

function KPIBlock({ label, value, sub, trend, highlight }: {
  label: string
  value: string
  sub: string
  trend?: number
  highlight?: boolean
}) {
  return (
    <div style={{
      flex: 1,
      background: highlight ? 'var(--accent-dim)' : 'var(--bg-card)',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10,
      padding: '16px 20px',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
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
  fiscal,
  runRate,
}: {
  fiscal: FiscalYearSummary
  runRate: RunRateProjection
}) {
  const nowYM = new Date().toISOString().slice(0, 7)

  // N-1 YTD values (from fiscal summary)
  const prevYtdRevenue = fiscal.prevYearRevenue  // already YTD-filtered in computeFiscalSummary
  const prevYtdMargin = fiscal.prevYearGrossMargin

  // Trends
  const caFactureTrend = prevYtdRevenue > 0 ? ((fiscal.theoreticalRevenue - prevYtdRevenue) / prevYtdRevenue) * 100 : 0
  const caEncaisseTrend = prevYtdRevenue > 0 ? ((fiscal.totalRevenue - prevYtdRevenue) / prevYtdRevenue) * 100 : 0
  const runRateTrend = fiscal.prevFullRevenue > 0 ? ((runRate.total - fiscal.prevFullRevenue) / fiscal.prevFullRevenue) * 100 : 0
  const margeTrend = prevYtdMargin > 0 ? ((fiscal.theoreticalGrossMargin - prevYtdMargin) / prevYtdMargin) * 100 : 0

  // Marge brute runrate = gross margin rate × projected full-year revenue
  const marginRate = fiscal.theoreticalRevenue > 0 ? fiscal.theoreticalGrossMargin / fiscal.theoreticalRevenue : 0
  const margeRunrate = marginRate * runRate.total
  const prevFullMargin = fiscal.prevFullGrossMargin
  const margeRunrateTrend = prevFullMargin > 0 ? ((margeRunrate - prevFullMargin) / prevFullMargin) * 100 : 0

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      <KPIBlock
        label="CA Facturé YTD"
        value={fmt(fiscal.theoreticalRevenue)}
        sub={`vs ${fmt(prevYtdRevenue)} N-1 YTD`}
        trend={caFactureTrend}
      />
      <KPIBlock
        label="CA Encaissé YTD"
        value={fmt(fiscal.totalRevenue)}
        sub={`vs ${fmt(prevYtdRevenue)} N-1 YTD`}
        trend={caEncaisseTrend}
      />
      <KPIBlock
        label="CA Run-Rate"
        value={fmt(runRate.total)}
        sub={`vs ${fmt(fiscal.prevFullRevenue)} exercice N-1 complet`}
        trend={runRateTrend}
        highlight
      />
      <KPIBlock
        label="Marge Brute Théo. YTD"
        value={fmt(fiscal.theoreticalGrossMargin)}
        sub={`${fiscal.theoreticalGrossMarginPct.toFixed(1)}% — vs ${fmt(prevYtdMargin)} N-1`}
        trend={margeTrend}
      />
      <KPIBlock
        label="Marge Brute Run-Rate"
        value={fmt(margeRunrate)}
        sub={`${(marginRate * 100).toFixed(1)}% × run-rate — vs ${fmt(prevFullMargin)} N-1`}
        trend={margeRunrateTrend}
        highlight
      />
    </div>
  )
}
