'use client'

interface KPICardProps {
  label: string
  value: string
  sub?: string
  trend?: number | null
  color?: 'default' | 'green' | 'red' | 'orange' | 'purple'
  size?: 'sm' | 'md' | 'lg'
}

const colorMap = {
  default: 'var(--text-primary)',
  green: 'var(--green)',
  red: 'var(--red)',
  orange: 'var(--orange)',
  purple: 'var(--purple)',
}

export default function KPICard({ label, value, sub, trend, color = 'default', size = 'md' }: KPICardProps) {
  const fontSize = size === 'lg' ? '2rem' : size === 'sm' ? '1.1rem' : '1.5rem'
  const trendStr = trend != null ? (trend >= 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`) : null
  const trendColor = trend != null ? (trend >= 0 ? 'var(--green)' : 'var(--red)') : undefined

  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize, color: colorMap[color] }}>{value}</div>
      {(sub || trendStr) && (
        <div className="kpi-sub">
          {sub && <span>{sub}</span>}
          {trendStr && <span style={{ color: trendColor, fontWeight: 600 }}>{trendStr}</span>}
        </div>
      )}
    </div>
  )
}
