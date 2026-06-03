'use client'

import { MonthlyRevenue, PipelineGrid, AppSettings } from '@/types'

const fmtCur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`
}

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function TreasurySection({
  monthly,
  pipelineGrid,
  settings,
}: {
  monthly: MonthlyRevenue[]
  pipelineGrid: PipelineGrid
  settings: AppSettings
}) {
  const nowYM = getCurrentYearMonth()
  const today = new Date().getDate()

  // Build columns: last 2 months + current + future until FY end
  const allMonths = monthly.map((m) => m.month)
  // Past 2 months (may not be in FY monthly if before start)
  const past2 = [addMonth(nowYM, -2), addMonth(nowYM, -1)].filter((m) => allMonths.includes(m))
  const futureMonths = allMonths.filter((m) => m >= nowYM)
  const displayMonths = [...past2, ...futureMonths.filter((m) => !past2.includes(m))]

  // Build pipeline grid lookup
  const pipelineLookup: { [month: string]: number } = {}
  for (const entry of pipelineGrid.entries) {
    pipelineLookup[entry.month] = (pipelineLookup[entry.month] || 0) + entry.amount
  }

  // Build monthly data lookup from `monthly`
  const monthLookup: { [month: string]: MonthlyRevenue } = {}
  for (const m of monthly) monthLookup[m.month] = m

  // Treasury items
  const treasuryItems = settings.treasuryItems ?? []

  // Compute solde evolution
  let soldeDebut = settings.currentBankBalance
  type MonthBlock = {
    month: string
    isPast: boolean
    isCurrent: boolean
    revenue: number
    collected: number
    pipeline: number
    items: number[]
    autresCharges: number
    totalIn: number
    totalOut: number
    net: number
    soldeFin: number
    soldeDebut: number
  }

  const blocks: MonthBlock[] = []
  let runningBalance = settings.currentBankBalance

  for (const m of displayMonths) {
    const md = monthLookup[m]
    const isPast = m < nowYM
    const isCurrent = m === nowYM

    const revenue = md?.revenue ?? 0
    const collected = md ? (isPast ? md.revenue : revenue) : 0
    const pipeline = pipelineLookup[m] ?? 0

    const totalIn = isPast ? revenue : collected + pipeline

    // Fixed charges per treasury item
    const itemAmounts = treasuryItems.map((ti) => ti.monthlyAmount)
    const totalFixedCharges = itemAmounts.reduce((s, v) => s + v, 0)

    // "Autres charges" = remaining external costs not covered by fixed items
    // We use externalCosts from monthly as a proxy
    const externalCosts = md?.externalCosts ?? 0
    const directCosts = md?.directCosts ?? 0
    const autresCharges = Math.max(0, externalCosts + directCosts - totalFixedCharges)

    const totalOut = totalFixedCharges + autresCharges
    const net = totalIn - totalOut
    const thisDebut = runningBalance
    runningBalance += net

    blocks.push({
      month: m,
      isPast,
      isCurrent,
      revenue,
      collected,
      pipeline,
      items: itemAmounts,
      autresCharges,
      totalIn,
      totalOut,
      net,
      soldeFin: runningBalance,
      soldeDebut: thisDebut,
    })
  }

  // Summary section
  const currentBlock = blocks.find((b) => b.isCurrent)
  const nextMonthBlock = blocks.find((b) => b.month === addMonth(nowYM, 1))

  // Dépenses à venir ce mois = items where dayOfMonth > today
  const upcomingThisMonth = treasuryItems
    .filter((ti) => ti.dayOfMonth > today && ti.monthlyAmount > 0)
    .reduce((s, ti) => s + ti.monthlyAmount, 0)

  const upcomingNextMonth = treasuryItems
    .filter((ti) => ti.monthlyAmount > 0)
    .reduce((s, ti) => s + ti.monthlyAmount, 0)

  const soldeDebutProchain = currentBlock?.soldeFin ?? settings.currentBankBalance
  const soldeFinProchain = (nextMonthBlock?.soldeFin) ?? (soldeDebutProchain + (nextMonthBlock?.net ?? 0))

  return (
    <section className="section">
      <h2 className="section-title">Plan de trésorerie</h2>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 160 }}>
                Poste
              </th>
              {displayMonths.map((m) => (
                <th key={m} style={{
                  textAlign: 'right',
                  padding: '8px 10px',
                  borderBottom: '2px solid var(--border)',
                  color: m === nowYM ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  minWidth: 90,
                }}>
                  {formatMonthLabel(m)}
                  {m === nowYM && <span style={{ fontSize: '0.7rem', display: 'block', color: 'var(--accent)' }}>en cours</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ENTRÉES */}
            <tr>
              <td colSpan={displayMonths.length + 1} style={{ padding: '6px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--green)', borderBottom: '1px solid var(--border)', background: 'var(--green-dim, rgba(39,174,96,0.05))' }}>
                ENTRÉES
              </td>
            </tr>
            <tr>
              <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>CA facturé</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                  {b.revenue > 0 ? fmtCur(b.revenue) : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>CA encaissé</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                  {b.collected > 0 ? fmtCur(b.collected) : '—'}
                </td>
              ))}
            </tr>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>Pipeline prévu</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {b.pipeline > 0 ? fmtCur(b.pipeline) : '—'}
                </td>
              ))}
            </tr>

            {/* SORTIES */}
            <tr>
              <td colSpan={displayMonths.length + 1} style={{ padding: '6px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--red)', borderBottom: '1px solid var(--border)', background: 'rgba(231,76,60,0.04)' }}>
                SORTIES
              </td>
            </tr>
            {treasuryItems.map((ti, idx) => (
              <tr key={idx}>
                <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>
                  {ti.name}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>j.{ti.dayOfMonth}</span>
                </td>
                {blocks.map((b) => (
                  <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', color: ti.monthlyAmount > 0 ? 'var(--red)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {ti.monthlyAmount > 0 ? fmtCur(-ti.monthlyAmount) : '—'}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>Autres charges</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', color: b.autresCharges > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {b.autresCharges > 0 ? fmtCur(-b.autresCharges) : '—'}
                </td>
              ))}
            </tr>

            {/* SOLDE */}
            <tr>
              <td colSpan={displayMonths.length + 1} style={{ padding: '6px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', background: 'var(--bg-section, rgba(255,255,255,0.02))' }}>
                SOLDE
              </td>
            </tr>
            <tr>
              <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>Solde début de mois</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '5px 10px', fontVariantNumeric: 'tabular-nums', color: b.soldeDebut >= 0 ? 'var(--text-primary)' : 'var(--red)' }}>
                  {fmtCur(b.soldeDebut)}
                </td>
              ))}
            </tr>
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-section, rgba(255,255,255,0.02))' }}>
              <td style={{ padding: '7px 10px', fontWeight: 700 }}>Solde fin de mois</td>
              {blocks.map((b) => (
                <td key={b.month} style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: b.soldeFin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtCur(b.soldeFin)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {[
          { label: 'Solde actuel', value: settings.currentBankBalance, color: settings.currentBankBalance >= 0 ? 'var(--green)' : 'var(--red)' },
          { label: 'Dépenses à venir ce mois', value: -upcomingThisMonth, color: upcomingThisMonth > 0 ? 'var(--red)' : 'var(--text-muted)', note: `charges non encore débitées (j. > ${today})` },
          { label: 'Solde début mois prochain', value: soldeDebutProchain, color: soldeDebutProchain >= 0 ? 'var(--text-primary)' : 'var(--red)' },
          { label: 'Dépenses à venir mois prochain', value: -upcomingNextMonth, color: upcomingNextMonth > 0 ? 'var(--red)' : 'var(--text-muted)' },
          { label: 'Solde fin mois prochain', value: soldeFinProchain, color: soldeFinProchain >= 0 ? 'var(--green)' : 'var(--red)' },
        ].map((item, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{fmtCur(item.value)}</div>
            {'note' in item && item.note && (
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.note}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
