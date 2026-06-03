'use client'

import { useState } from 'react'
import { FiscalYearSummary, ExpenseSummary, DashboardData } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

type DetailLine = DashboardData['cogsDetail'][number]

function DetailTable({ lines, title }: { lines: DetailLine[]; title: string }) {
  const [open, setOpen] = useState(false)
  if (lines.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn btn-ghost"
        style={{ fontSize: '0.78rem', padding: '4px 10px' }}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} {title} ({lines.length} lignes · {fmt(lines.reduce((s, l) => s + l.amount, 0))})
      </button>
      {open && (
        <div className="table-wrapper" style={{ marginTop: 8 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Code</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="text-secondary">{l.date}</td>
                  <td style={{ fontWeight: 600 }}>{l.supplier}</td>
                  <td>
                    <span style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {l.accountCode}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface Col {
  label: string
  revenue: number
  unpaid: number
  theoreticalRevenue: number
  directCosts: number
  grossMarginEnc: number
  grossMarginTheo: number
  grossMarginEncPct: number
  grossMarginTheoPct: number
  payroll: number
  externalCosts: number
  resultEnc: number
  resultTheo: number
  resultEncPct: number
  resultTheoPct: number
}

function PLTable({ cols }: { cols: Col[] }) {
  const rows: Array<{
    label: string
    key: keyof Col
    pctKey?: keyof Col
    indent?: boolean
    bold?: boolean
    separator?: boolean
    sign?: 1 | -1
  }> = [
    { label: 'CA Encaissé HT', key: 'revenue', bold: true },
    { label: '+ CA non encaissé', key: 'unpaid', indent: true },
    { label: '= CA Théorique', key: 'theoreticalRevenue', bold: true, separator: true },
    { label: '— Charges directes', key: 'directCosts', indent: true, sign: -1 },
    { label: '= Marge Brute enc.', key: 'grossMarginEnc', pctKey: 'grossMarginEncPct' },
    { label: '= Marge Brute théo.', key: 'grossMarginTheo', pctKey: 'grossMarginTheoPct', bold: true, separator: true },
    { label: '— Masse salariale', key: 'payroll', indent: true, sign: -1 },
    { label: '— Frais externes', key: 'externalCosts', indent: true, sign: -1 },
    { label: '= Résultat enc.', key: 'resultEnc', pctKey: 'resultEncPct' },
    { label: '= Résultat théo.', key: 'resultTheo', pctKey: 'resultTheoPct', bold: true, separator: true },
  ]

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border)' }}>Poste</th>
            {cols.map((col, i) => (
              <th key={i} style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              style={{
                borderBottom: row.separator ? '2px solid var(--border)' : '1px solid var(--border)',
                background: row.bold && row.separator ? 'var(--bg-section, rgba(255,255,255,0.02))' : undefined,
              }}
            >
              <td style={{
                padding: '7px 12px',
                fontWeight: row.bold ? 700 : 400,
                paddingLeft: row.indent ? 28 : 12,
                color: row.indent ? 'var(--text-secondary)' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}>
                {row.label}
              </td>
              {cols.map((col, ci) => {
                const raw = col[row.key] as number
                const pct = row.pctKey ? col[row.pctKey] as number : undefined
                const display = row.sign === -1 ? -raw : raw
                const isNeg = display < 0
                const isPos = display > 0 && row.bold
                const color = isNeg ? 'var(--red)' : isPos && row.bold ? 'var(--green)' : 'var(--text-primary)'
                return (
                  <td key={ci} style={{
                    textAlign: 'right',
                    padding: '7px 12px',
                    fontWeight: row.bold ? 700 : 400,
                    fontVariantNumeric: 'tabular-nums',
                    color: row.sign === -1 ? 'var(--text-secondary)' : color,
                    whiteSpace: 'nowrap',
                  }}>
                    {fmt(display)}
                    {pct !== undefined && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                        ({fmtPct(pct)})
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function PLSection({
  fiscal,
  expenses,
  monthly,
  prevYearFullExpenses,
  cogsDetail,
  payrollDetail,
}: {
  fiscal: FiscalYearSummary
  expenses: ExpenseSummary
  monthly: import('@/types').MonthlyRevenue[]
  prevYearFullExpenses?: {
    totalPayroll: number
    totalDirectCosts: number
    totalExternalCosts: number
  }
  cogsDetail: DetailLine[]
  payrollDetail: DetailLine[]
}) {
  const totalCharges = expenses.totalPayroll + expenses.totalDirectCosts + expenses.totalExternalCosts
  const ebitda = fiscal.totalRevenue - totalCharges
  const ebitdaPct = fiscal.totalRevenue > 0 ? (ebitda / fiscal.totalRevenue) * 100 : 0
  const theoreticalEbitda = fiscal.theoreticalRevenue - totalCharges
  const theoreticalEbitdaPct = fiscal.theoreticalRevenue > 0 ? (theoreticalEbitda / fiscal.theoreticalRevenue) * 100 : 0

  // N YTD column
  const nYtd: Col = {
    label: `N YTD (${fiscal.year.split('-')[1]})`,
    revenue: fiscal.totalRevenue,
    unpaid: fiscal.theoreticalRevenue - fiscal.totalRevenue,
    theoreticalRevenue: fiscal.theoreticalRevenue,
    directCosts: fiscal.totalDirectCosts,
    grossMarginEnc: fiscal.totalGrossMargin,
    grossMarginTheo: fiscal.theoreticalGrossMargin,
    grossMarginEncPct: fiscal.grossMarginPct,
    grossMarginTheoPct: fiscal.theoreticalGrossMarginPct,
    payroll: expenses.totalPayroll,
    externalCosts: expenses.totalExternalCosts,
    resultEnc: ebitda,
    resultTheo: theoreticalEbitda,
    resultEncPct: ebitdaPct,
    resultTheoPct: theoreticalEbitdaPct,
  }

  // N-1 YTD column — only elapsed months (same period as current YTD)
  const nowYM = new Date().toISOString().slice(0, 7)
  const ytdMonthly = monthly.filter((m) => m.month <= nowYM)
  const prevGmEnc = ytdMonthly.reduce((s, m) => s + m.prevYearGrossMargin, 0)
  const prevYtdPayroll = ytdMonthly.reduce((s, m) => s + m.prevYearPayroll, 0)
  const prevYtdExternal = ytdMonthly.reduce((s, m) => s + m.prevYearExternalCosts, 0)
  const prevYtdRevenue = ytdMonthly.reduce((s, m) => s + m.prevYearRevenue, 0)
  const prevYtdDirectCosts = ytdMonthly.reduce((s, m) => s + (m.prevYearRevenue - m.prevYearGrossMargin), 0)
  const prevYtdResult = prevGmEnc - prevYtdPayroll - prevYtdExternal

  const n1Ytd: Col = {
    label: `N-1 YTD`,
    revenue: prevYtdRevenue,
    unpaid: 0,
    theoreticalRevenue: prevYtdRevenue,
    directCosts: prevYtdDirectCosts,
    grossMarginEnc: prevGmEnc,
    grossMarginTheo: prevGmEnc,
    grossMarginEncPct: prevYtdRevenue > 0 ? (prevGmEnc / prevYtdRevenue) * 100 : 0,
    grossMarginTheoPct: prevYtdRevenue > 0 ? (prevGmEnc / prevYtdRevenue) * 100 : 0,
    payroll: prevYtdPayroll,
    externalCosts: prevYtdExternal,
    resultEnc: prevYtdResult,
    resultTheo: prevYtdResult,
    resultEncPct: prevYtdRevenue > 0 ? (prevYtdResult / prevYtdRevenue) * 100 : 0,
    resultTheoPct: prevYtdRevenue > 0 ? (prevYtdResult / prevYtdRevenue) * 100 : 0,
  }

  // N-1 Exercice complet column
  const prevFull = prevYearFullExpenses
  const prevFullRevenue = fiscal.prevFullRevenue
  const prevFullDirectCosts = fiscal.prevFullDirectCosts
  const prevFullGm = fiscal.prevFullGrossMargin
  const prevFullResult = prevFullRevenue - prevFullDirectCosts - (prevFull ? (prevFull.totalPayroll + prevFull.totalExternalCosts) : 0)

  const n1Full: Col = {
    label: `N-1 Exercice complet`,
    revenue: prevFullRevenue,
    unpaid: 0,
    theoreticalRevenue: prevFullRevenue,
    directCosts: prevFullDirectCosts,
    grossMarginEnc: prevFullGm,
    grossMarginTheo: prevFullGm,
    grossMarginEncPct: prevFullRevenue > 0 ? (prevFullGm / prevFullRevenue) * 100 : 0,
    grossMarginTheoPct: prevFullRevenue > 0 ? (prevFullGm / prevFullRevenue) * 100 : 0,
    payroll: prevFull?.totalPayroll ?? 0,
    externalCosts: prevFull?.totalExternalCosts ?? 0,
    resultEnc: prevFullResult,
    resultTheo: prevFullResult,
    resultEncPct: prevFullRevenue > 0 ? (prevFullResult / prevFullRevenue) * 100 : 0,
    resultTheoPct: prevFullRevenue > 0 ? (prevFullResult / prevFullRevenue) * 100 : 0,
  }

  return (
    <section className="section">
      <h2 className="section-title">Compte de résultat prévisionnel</h2>
      <p className="section-note">Exercice {fiscal.year} — 3 colonnes comparatives</p>

      <PLTable cols={[nYtd, n1Ytd, n1Full]} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        <DetailTable lines={cogsDetail} title="Détail COGS" />
        <DetailTable lines={payrollDetail} title="Détail masse salariale" />
      </div>
    </section>
  )
}
