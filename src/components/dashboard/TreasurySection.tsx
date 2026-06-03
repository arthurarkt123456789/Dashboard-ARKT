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

function addMonthStr(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function avg(values: number[]): number {
  const nonZero = values.filter((v) => v > 0)
  return nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0
}

function Cell({ value, color }: { value: number; color?: string }) {
  if (value === 0) return <td style={{ textAlign: 'right', padding: '5px 10px', color: 'var(--text-muted)' }}>—</td>
  return (
    <td style={{ textAlign: 'right', padding: '5px 10px', color: color ?? 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
      {fmtCur(value)}
    </td>
  )
}

export default function TreasurySection({
  monthly,
  pipelineGrid,
  settings,
  onRefresh,
}: {
  monthly: MonthlyRevenue[]
  pipelineGrid: PipelineGrid
  settings: AppSettings
  onRefresh?: () => void
}) {
  const nowYM = getCurrentYearMonth()
  const today = new Date().getDate()

  // Build display columns: past 2 months in FY + current + future
  const allFYMonths = monthly.map((m) => m.month)
  const past2 = [addMonthStr(nowYM, -2), addMonthStr(nowYM, -1)].filter((m) => allFYMonths.includes(m))
  const futureMonths = allFYMonths.filter((m) => m >= nowYM)
  const displayMonths = [...past2, ...futureMonths.filter((m) => !past2.includes(m))]

  // Monthly data lookup
  const ml: Record<string, MonthlyRevenue> = {}
  for (const m of monthly) ml[m.month] = m

  // Pipeline lookup by month
  const pipelineLookup: Record<string, number> = {}
  for (const e of pipelineGrid.entries) {
    pipelineLookup[e.month] = (pipelineLookup[e.month] ?? 0) + e.amount
  }

  // Compute averages from past months (non-zero values)
  const pastMonths = monthly.filter((m) => m.month < nowYM)
  const avgPayroll = avg(pastMonths.map((m) => m.payroll))
  const avgExternal = avg(pastMonths.map((m) => m.externalCosts))
  const avgDirector = avg(pastMonths.map((m) => m.directorCharges))
  const avgMeulery = avg(pastMonths.map((m) => m.meuleryCharges))
  const avgRevenue = avg(pastMonths.map((m) => m.revenue))

  // Non-salary treasury items (skip salary items — those come from Pennylane)
  const fixedItems = (settings.treasuryItems ?? []).filter(
    (ti) => !ti.name.toLowerCase().includes('salaire') && !ti.name.toLowerCase().includes('salary')
  )
  const directorSalaryItem = (settings.treasuryItems ?? []).find(
    (ti) => ti.name.toLowerCase().includes('dirigeant')
  )
  const directorSalaryAmount = directorSalaryItem?.monthlyAmount ?? 0

  // Build month blocks
  type MonthBlock = {
    month: string
    isPast: boolean
    isCurrent: boolean
    // Entrées
    caFacture: number
    caEncaisse: number
    pipeline: number
    // Sorties
    salairesAutres: number  // payroll - dirigeant salary (from Pennylane for past)
    salaireDirigeant: number
    fixedItems: number[]
    externalCosts: number
    directorCharges: number
    meuleryCharges: number
    // Solde
    soldeDebut: number
    soldeFin: number
  }

  let runningBalance = settings.currentBankBalance
  const blocks: MonthBlock[] = []

  for (const m of displayMonths) {
    const md = ml[m]
    const isPast = m < nowYM
    const isCurrent = m === nowYM

    const caFacture = md?.revenue ?? (isPast ? 0 : avgRevenue)
    const caEncaisse = isPast ? (md?.revenue ?? 0) : 0
    const pipeline = pipelineLookup[m] ?? 0

    // Payroll from Pennylane for past/current, average for future
    const totalPayroll = isPast || isCurrent ? (md?.payroll ?? 0) : avgPayroll
    const salaireDirigeant = directorSalaryAmount
    const salairesAutres = Math.max(0, totalPayroll - salaireDirigeant)

    // Fixed items from settings (emprunt, voiture, loyer, etc.)
    const itemAmounts = fixedItems.map((ti) => ti.monthlyAmount)

    // External costs from Pennylane for past, average for future
    const externalCosts = isPast || isCurrent ? (md?.externalCosts ?? 0) : avgExternal
    const directorCharges = isPast || isCurrent ? (md?.directorCharges ?? 0) : avgDirector
    const meuleryCharges = isPast || isCurrent ? (md?.meuleryCharges ?? 0) : avgMeulery

    const totalIn = isPast ? caEncaisse : caFacture + pipeline
    const totalOut = salairesAutres + salaireDirigeant + itemAmounts.reduce((s, v) => s + v, 0) + externalCosts + directorCharges + meuleryCharges

    const soldeDebut = runningBalance
    runningBalance += totalIn - totalOut

    blocks.push({
      month: m, isPast, isCurrent,
      caFacture, caEncaisse, pipeline,
      salairesAutres, salaireDirigeant,
      fixedItems: itemAmounts,
      externalCosts, directorCharges, meuleryCharges,
      soldeDebut, soldeFin: runningBalance,
    })
  }

  // Summary for current / next month
  const currentBlock = blocks.find((b) => b.isCurrent)
  const nextBlock = blocks.find((b) => b.month === addMonthStr(nowYM, 1))

  const upcomingThisMonth = (settings.treasuryItems ?? [])
    .filter((ti) => ti.dayOfMonth > today && ti.monthlyAmount > 0)
    .reduce((s, ti) => s + ti.monthlyAmount, 0)

  const upcomingNextMonthTotal = (settings.treasuryItems ?? [])
    .filter((ti) => ti.monthlyAmount > 0)
    .reduce((s, ti) => s + ti.monthlyAmount, 0)

  const soldeDebutProchain = currentBlock?.soldeFin ?? settings.currentBankBalance

  const TH = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => (
    <th style={{ textAlign: 'right', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: accent ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', minWidth: 90 }}>
      {children}
    </th>
  )

  const SectionRow = ({ label, color }: { label: string; color: string }) => (
    <tr>
      <td colSpan={displayMonths.length + 1} style={{ padding: '6px 10px', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color, borderBottom: '1px solid var(--border)', background: color === 'var(--green)' ? 'var(--green-dim)' : color === 'var(--red)' ? 'rgba(231,76,60,0.04)' : 'rgba(255,255,255,0.02)' }}>
        {label}
      </td>
    </tr>
  )

  const DataRow = ({ label, values, color, bold }: { label: string; values: number[]; color?: string; bold?: boolean }) => (
    <tr style={{ borderBottom: bold ? '2px solid var(--border)' : undefined }}>
      <td style={{ padding: '5px 10px 5px 20px', color: bold ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</td>
      {values.map((v, i) => <Cell key={i} value={v} color={color} />)}
    </tr>
  )

  return (
    <section className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Plan de trésorerie</h2>
        {onRefresh && (
          <button className="btn btn-ghost" onClick={onRefresh} style={{ fontSize: '0.78rem' }}>
            ↻ Actualiser (pipeline)
          </button>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Salaires & charges externes : données Pennylane pour les mois passés, moyenne des mois passés pour les prévisions.
        Autres postes (emprunt, voiture, loyer) : configurer dans ⚙ Paramètres.
      </p>

      <div style={{ overflowX: 'auto', marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 600, minWidth: 180 }}>Poste</th>
              {displayMonths.map((m) => (
                <TH key={m} accent={m === nowYM}>
                  {formatMonthLabel(m)}
                  {m === nowYM && <span style={{ fontSize: '0.7rem', display: 'block' }}>en cours</span>}
                  {m > nowYM && <span style={{ fontSize: '0.65rem', display: 'block', color: 'var(--text-muted)' }}>prev.</span>}
                </TH>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionRow label="ENTRÉES" color="var(--green)" />
            <DataRow label="CA facturé HT" values={blocks.map((b) => b.caFacture)} color="var(--green)" />
            <DataRow label="CA encaissé" values={blocks.map((b) => b.caEncaisse)} color="var(--green)" />
            <DataRow label="Pipeline prévu" values={blocks.map((b) => b.pipeline)} color="var(--accent)" />

            <SectionRow label="SORTIES" color="var(--red)" />
            <DataRow label="Salaires (hors dirigeant)" values={blocks.map((b) => b.salairesAutres)} color="var(--red)" />
            <DataRow label="Salaire dirigeant" values={blocks.map((b) => b.salaireDirigeant)} color="var(--red)" />
            {fixedItems.map((ti, idx) => (
              <tr key={idx}>
                <td style={{ padding: '5px 10px 5px 20px', color: 'var(--text-secondary)' }}>
                  {ti.name}
                  {ti.dayOfMonth > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>j.{ti.dayOfMonth}</span>}
                </td>
                {blocks.map((b, i) => <Cell key={i} value={b.fixedItems[idx] ?? 0} color="var(--red)" />)}
              </tr>
            ))}
            <DataRow label="Charges dirigeant" values={blocks.map((b) => b.directorCharges)} color="var(--orange)" />
            <DataRow label="Charges Meuleries" values={blocks.map((b) => b.meuleryCharges)} color="var(--text-secondary)" />
            <DataRow label="Frais externes" values={blocks.map((b) => b.externalCosts)} color="var(--text-secondary)" />

            <SectionRow label="SOLDE" color="var(--text-secondary)" />
            <DataRow label="Solde début de mois" values={blocks.map((b) => b.soldeDebut)} />
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '7px 10px', fontWeight: 700 }}>Solde fin de mois</td>
              {blocks.map((b, i) => (
                <td key={i} style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: b.soldeFin >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {fmtCur(b.soldeFin)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {[
          { label: 'Solde actuel', value: settings.currentBankBalance },
          { label: `Charges à venir ce mois (j.>${today})`, value: -upcomingThisMonth, note: 'charges fixes non encore débitées' },
          { label: 'Solde début mois prochain', value: soldeDebutProchain },
          { label: 'Charges à venir mois prochain', value: -upcomingNextMonthTotal },
          { label: 'Solde fin mois prochain', value: nextBlock?.soldeFin ?? soldeDebutProchain },
        ].map((item, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: item.value >= 0 ? (i === 0 ? 'var(--accent)' : 'var(--green)') : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtCur(item.value)}
            </div>
            {'note' in item && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.note}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}
