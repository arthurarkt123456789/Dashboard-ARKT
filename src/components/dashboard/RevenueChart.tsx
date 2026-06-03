'use client'

import { useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { MonthlyRevenue, FiscalYearSummary } from '@/types'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k€` : `${Math.round(n)}€`

type Mode = 'cumulative' | 'monthly'

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{String(label)}</div>
      {(payload as Array<{ name: string; value: number; color: string }>).map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', color: p.color }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueChart({
  monthly,
  fiscal,
}: {
  monthly: MonthlyRevenue[]
  fiscal: FiscalYearSummary
}) {
  const [mode, setMode] = useState<Mode>('cumulative')

  const data = monthly.map((m) => {
    // EBE = gross margin - payroll - external
    const ebe = m.grossMargin - m.payroll - m.externalCosts
    const prevEbe = m.prevYearGrossMargin - m.prevYearPayroll - m.prevYearExternalCosts

    const cumEbe = m.cumGrossMargin - m.cumPayroll - m.cumExternalCosts
    const prevCumEbe = m.prevYearCumGrossMargin - m.prevYearCumPayroll
    // Note: cumulative N-1 EBE is approximate (we only have cumPayroll for N-1)

    return mode === 'cumulative'
      ? {
          name: m.label,
          'CA': m.cumRevenue,
          'CA N-1': m.prevYearCumRevenue,
          'Marge': m.cumGrossMargin,
          'Marge N-1': m.prevYearCumGrossMargin,
          'Masse salariale': m.cumPayroll,
          'Masse sal. N-1': m.prevYearCumPayroll,
          'EBE': Math.max(0, cumEbe),
          'Perte': Math.min(0, cumEbe),
          'EBE N-1': Math.max(0, prevCumEbe),
        }
      : {
          name: m.label,
          'CA': m.revenue,
          'CA N-1': m.prevYearRevenue,
          'Marge': m.grossMargin,
          'Marge N-1': m.prevYearGrossMargin,
          'Masse salariale': m.payroll,
          'Masse sal. N-1': m.prevYearPayroll,
          'EBE': Math.max(0, ebe),
          'Perte': Math.min(0, ebe),
          'EBE N-1': Math.max(0, prevEbe),
        }
  })

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">CA · Marge · Masse salariale · EBE — Exercice {fiscal.year}</h2>
        <div className="toggle-group">
          <button className={`toggle-btn ${mode === 'cumulative' ? 'active' : ''}`} onClick={() => setMode('cumulative')}>
            Cumulé
          </button>
          <button className={`toggle-btn ${mode === 'monthly' ? 'active' : ''}`} onClick={() => setMode('monthly')}>
            Mensuel
          </button>
        </div>
      </div>

      <div style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => fmt(v)}
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              width={65}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)', paddingTop: 8 }}
              iconType="line"
            />

            {/* Bars — behind lines */}
            <Bar dataKey="Masse salariale" fill="var(--orange)" opacity={0.75} barSize={14} />
            <Bar dataKey="Masse sal. N-1" fill="var(--orange)" opacity={0.35} barSize={14} />
            <Bar dataKey="EBE" fill="var(--green)" opacity={0.75} barSize={14} />
            <Bar dataKey="Perte" fill="var(--red)" opacity={0.75} barSize={14} />
            <Bar dataKey="EBE N-1" fill="var(--green)" opacity={0.35} barSize={14} />

            {/* Lines — on top */}
            <Line type="monotone" dataKey="CA" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="CA N-1" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="Marge" stroke="#06b6d4" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Marge N-1" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
