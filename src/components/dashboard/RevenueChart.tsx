'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { MonthlyRevenue, FiscalYearSummary } from '@/types'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${n.toFixed(0)}€`

type Mode = 'margin' | 'revenue'

export default function RevenueChart({
  monthly,
  fiscal,
}: {
  monthly: MonthlyRevenue[]
  fiscal: FiscalYearSummary
}) {
  const [mode, setMode] = useState<Mode>('margin')

  // Stacked area data: cumulative breakdown of gross margin components
  const marginData = monthly.map((m) => ({
    name: m.label,
    payroll: m.cumPayroll,
    external: m.cumExternalCosts,
    director: m.cumDirectorCharges,
    meulery: m.cumMeuleryCharges,
    ebe: Math.max(0, m.cumGrossMargin - m.cumPayroll - m.cumExternalCosts - m.cumDirectorCharges - m.cumMeuleryCharges),
    marginLine: m.cumGrossMargin,
    prevMarginLine: m.prevYearCumGrossMargin,
  }))

  const revenueData = monthly.map((m) => ({
    name: m.label,
    'CA cumulé N': m.cumRevenue,
    'CA cumulé N-1': m.prevYearCumRevenue,
    'Marge brute N': m.cumGrossMargin,
    'Marge brute N-1': m.prevYearCumGrossMargin,
  }))

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !payload) return null
    const items = payload as Array<{ name: string; value: number; color: string; fill?: string }>
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">{label as string}</div>
        {items.map((item) => (
          <div key={item.name} style={{ color: item.color || item.fill, display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
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
        <h2 className="section-title">Marge &amp; Résultat — Exercice {fiscal.year}</h2>
        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'margin' ? 'active' : ''}`} onClick={() => setMode('margin')}>
            Décomposition marge
          </button>
          <button className={`toggle-btn ${mode === 'revenue' ? 'active' : ''}`} onClick={() => setMode('revenue')}>
            CA & Marge
          </button>
        </div>
      </div>

      {mode === 'margin' ? (
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={marginData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="payroll"
                name="Masse salariale"
                stackId="1"
                stroke="#e07b54"
                fill="#e07b54"
                fillOpacity={0.85}
              />
              <Area
                type="monotone"
                dataKey="external"
                name="Frais externes"
                stackId="1"
                stroke="#8c8c8c"
                fill="#8c8c8c"
                fillOpacity={0.75}
              />
              <Area
                type="monotone"
                dataKey="director"
                name="Charges dirigeant"
                stackId="1"
                stroke="#9b59b6"
                fill="#9b59b6"
                fillOpacity={0.75}
              />
              <Area
                type="monotone"
                dataKey="meulery"
                name="Charges Meuleries"
                stackId="1"
                stroke="#1abc9c"
                fill="#1abc9c"
                fillOpacity={0.75}
              />
              <Area
                type="monotone"
                dataKey="ebe"
                name="EBE"
                stackId="1"
                stroke="var(--green)"
                fill="var(--green)"
                fillOpacity={0.8}
              />
              <Line
                type="monotone"
                dataKey="marginLine"
                name="Marge brute N"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="prevMarginLine"
                name="Marge brute N-1"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="CA cumulé N"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="CA cumulé N-1"
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Marge brute N"
                stroke="var(--green)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Marge brute N-1"
                stroke="var(--green)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
        Les zones empilées représentent la décomposition cumulée de la marge brute (charges + EBE).
      </div>
    </section>
  )
}
