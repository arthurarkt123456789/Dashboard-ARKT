'use client'

import { useState } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { MonthlyRevenue, FiscalYearSummary } from '@/types'
import KPICard from '@/components/ui/KPICard'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${n.toFixed(0)}€`

const fmtPct = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`)

type Mode = 'cumulative' | 'monthly'

export default function RevenueChart({
  monthly,
  fiscal,
}: {
  monthly: MonthlyRevenue[]
  fiscal: FiscalYearSummary
}) {
  const [mode, setMode] = useState<Mode>('cumulative')

  const data = monthly.map((m) =>
    mode === 'cumulative'
      ? {
          name: m.label,
          'CA cumulé N': m.cumRevenue,
          'CA cumulé N-1': m.prevYearCumRevenue,
          'Marge brute N': m.cumGrossMargin,
          'Marge brute N-1': m.prevYearCumGrossMargin,
          'Bart & Pucci': m.cumBartPucci,
        }
      : {
          name: m.label,
          'CA N': m.revenue,
          'CA N-1': m.prevYearRevenue,
          'Marge brute N': m.grossMargin,
          'Marge brute N-1': m.prevYearGrossMargin,
          'Bart & Pucci': m.bartPucci,
        }
  )

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !payload) return null
    const items = payload as Array<{ name: string; value: number; color: string }>
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{label as string}</div>
        {items.map((item) => (
          <div key={item.name} style={{ color: item.color, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{item.name}</span>
            <span style={{ fontWeight: 600 }}>{fmt(item.value)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">CA & Marge brute — Exercice {fiscal.year}</h2>
        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'cumulative' ? 'active' : ''}`} onClick={() => setMode('cumulative')}>
            Cumulé
          </button>
          <button className={`toggle-btn ${mode === 'monthly' ? 'active' : ''}`} onClick={() => setMode('monthly')}>
            Mensuel
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <KPICard
          label="CA encaissé YTD"
          value={fmt(fiscal.totalRevenue)}
          trend={fiscal.revenueGrowthPct}
          sub={`vs ${fmt(fiscal.prevYearRevenue)} N-1`}
          size="lg"
        />
        <KPICard
          label="CA théorique (+ facturé)"
          value={fmt(fiscal.theoreticalRevenue)}
          sub={`dont ${fmt(fiscal.theoreticalRevenue - fiscal.totalRevenue)} non encaissé`}
          color="orange"
          size="lg"
        />
        <KPICard
          label="Marge brute encaissée"
          value={fmt(fiscal.totalGrossMargin)}
          sub={`${fiscal.grossMarginPct.toFixed(1)}%`}
          trend={fiscal.marginGrowthPct}
          color={fiscal.grossMarginPct > 50 ? 'green' : fiscal.grossMarginPct > 25 ? 'default' : 'red'}
          size="md"
        />
        <KPICard
          label="Marge brute théorique"
          value={fmt(fiscal.theoreticalGrossMargin)}
          sub={`${fiscal.theoreticalGrossMarginPct.toFixed(1)}%`}
          color={fiscal.theoreticalGrossMarginPct > 50 ? 'green' : 'default'}
          size="md"
        />
        <KPICard
          label="Bart & Pucci N"
          value={`${fiscal.bartPucciPct.toFixed(1)}%`}
          sub={fmt(fiscal.totalBartPucci)}
          color="purple"
          size="sm"
        />
        <KPICard
          label="Bart & Pucci N-1"
          value={`${fiscal.prevYearBartPucciPct.toFixed(1)}%`}
          sub={fmt(fiscal.prevYearBartPucci)}
          color={fiscal.bartPucciPct < fiscal.prevYearBartPucciPct ? 'green' : 'purple'}
          size="sm"
        />
      </div>

      <div style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
            <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey={mode === 'cumulative' ? 'CA cumulé N' : 'CA N'}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={mode === 'cumulative' ? 'CA cumulé N-1' : 'CA N-1'}
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={mode === 'cumulative' ? 'Marge brute N' : 'Marge brute N'}
              stroke="var(--green)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={mode === 'cumulative' ? 'Marge brute N-1' : 'Marge brute N-1'}
              stroke="var(--green)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Bar dataKey="Bart & Pucci" fill="var(--purple)" opacity={0.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
