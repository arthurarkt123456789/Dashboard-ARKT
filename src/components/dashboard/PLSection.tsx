'use client'

import { useState } from 'react'
import { FiscalYearSummary, ExpenseSummary, DashboardData } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

interface PLRow {
  label: string
  value: number
  pct?: number
  indent?: boolean
  bold?: boolean
  positive?: boolean
  separator?: boolean
}

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

export default function PLSection({
  fiscal,
  expenses,
  cogsDetail,
  payrollDetail,
}: {
  fiscal: FiscalYearSummary
  expenses: ExpenseSummary
  cogsDetail: DetailLine[]
  payrollDetail: DetailLine[]
}) {
  const ebitda = fiscal.totalGrossMargin - expenses.totalPayroll - expenses.totalExternalCosts
  const ebitdaPct = fiscal.totalRevenue > 0 ? (ebitda / fiscal.totalRevenue) * 100 : 0
  const theoreticalEbitda = fiscal.theoreticalGrossMargin - expenses.totalPayroll - expenses.totalExternalCosts
  const theoreticalEbitdaPct = fiscal.theoreticalRevenue > 0 ? (theoreticalEbitda / fiscal.theoreticalRevenue) * 100 : 0

  const rows: PLRow[] = [
    { label: 'CA encaissé HT', value: fiscal.totalRevenue, bold: true, positive: true },
    { label: '+ Facturé non encaissé', value: fiscal.theoreticalRevenue - fiscal.totalRevenue, indent: true },
    { label: '= CA théorique HT', value: fiscal.theoreticalRevenue, bold: true, separator: true, positive: true },
    { label: '— Charges directes (COGS)', value: -fiscal.totalDirectCosts, indent: true },
    { label: '= Marge brute encaissée', value: fiscal.totalGrossMargin, pct: fiscal.grossMarginPct, bold: false },
    { label: '= Marge brute théorique', value: fiscal.theoreticalGrossMargin, pct: fiscal.theoreticalGrossMarginPct, bold: true, separator: true },
    { label: '— Masse salariale', value: -expenses.totalPayroll, indent: true },
    { label: '— Frais externes', value: -expenses.totalExternalCosts, indent: true },
    { label: '= Résultat encaissé', value: ebitda, pct: ebitdaPct, bold: false, positive: ebitda >= 0 },
    { label: '= Résultat théorique', value: theoreticalEbitda, pct: theoreticalEbitdaPct, bold: true, separator: true, positive: theoreticalEbitda >= 0 },
  ]

  return (
    <section className="section">
      <h2 className="section-title">Compte de résultat prévisionnel</h2>
      <p className="section-note">Exercice {fiscal.year} — YTD</p>

      <div className="pl-table">
        {rows.map((row, i) => (
          <div
            key={i}
            className={['pl-row', row.bold ? 'pl-row-bold' : '', row.separator ? 'pl-row-separator' : '', row.indent ? 'pl-row-indent' : ''].join(' ')}
          >
            <span className="pl-label">{row.label}</span>
            <span
              className="pl-value"
              style={{
                color: row.bold
                  ? row.positive !== undefined ? (row.positive ? 'var(--green)' : 'var(--red)') : 'var(--text-primary)'
                  : row.value < 0 ? 'var(--red)' : 'var(--text-primary)',
              }}
            >
              {fmt(row.value)}
              {row.pct !== undefined && <span className="pl-pct"> ({fmtPct(row.pct)})</span>}
            </span>
          </div>
        ))}
      </div>

      <DetailTable lines={cogsDetail} title="Détail charges directes (COGS)" />
      <DetailTable lines={payrollDetail} title="Détail masse salariale" />
    </section>
  )
}
