'use client'

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
import type { MonthlyPoint } from '@/lib/pnl'

interface Props {
  monthly: MonthlyPoint[]
  prevMonthly: MonthlyPoint[]
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + ' k€'
  return n.toFixed(0) + ' €'
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: p.color }}>
          <span>{p.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardChart({ monthly, prevMonthly }: Props) {
  // Merge current and prev into a single dataset by label index
  const chartData = monthly.map((m, i) => {
    const prev = prevMonthly[i]
    return {
      label: m.label,
      'CA cumulé N': m.cumRevenue,
      'CA cumulé N-1': prev?.cumRevenue ?? 0,
      'Marge cumulée N': m.cumGrossMargin,
      'Marge cumulée N-1': prev?.cumGrossMargin ?? 0,
      EBE: m.ebe,
    }
  })

  return (
    <section className="section" style={{ marginBottom: 16 }}>
      <div className="section-header">
        <h2 className="section-title">Evolution</h2>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => fmtK(v)}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)', paddingTop: 8 }}
          />
          {/* EBE bars in background */}
          <Bar dataKey="EBE" fill="rgba(168,85,247,0.25)" radius={[3, 3, 0, 0]} />
          {/* Revenue cumulated lines */}
          <Line
            type="monotone"
            dataKey="CA cumulé N"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="CA cumulé N-1"
            stroke="var(--accent)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
          {/* Gross margin cumulated lines */}
          <Line
            type="monotone"
            dataKey="Marge cumulée N"
            stroke="var(--green)"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Marge cumulée N-1"
            stroke="var(--green)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  )
}
