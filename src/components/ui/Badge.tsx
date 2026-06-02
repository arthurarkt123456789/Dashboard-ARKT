'use client'

type Status = 'green' | 'yellow' | 'red'

const labels: Record<Status, string> = {
  green: '● Bon',
  yellow: '● Attention',
  red: '● Alerte',
}

const colors: Record<Status, string> = {
  green: 'var(--green)',
  yellow: 'var(--orange)',
  red: 'var(--red)',
}

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  return (
    <span style={{ color: colors[status], fontWeight: 600, fontSize: '0.85rem' }}>
      {label ?? labels[status]}
    </span>
  )
}
