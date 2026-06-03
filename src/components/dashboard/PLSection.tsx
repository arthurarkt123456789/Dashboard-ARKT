'use client'

import { FiscalYearSummary, ExpenseSummary } from '@/types'

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

export default function PLSection({
  fiscal,
  expenses,
}: {
  fiscal: FiscalYearSummary
  expenses: ExpenseSummary
}) {
  const ebitda = fiscal.totalGrossMargin - expenses.totalPayroll - expenses.totalExternalCosts
  const ebitdaPct = fiscal.totalRevenue > 0 ? (ebitda / fiscal.totalRevenue) * 100 : 0

  const theoreticalEbitda = fiscal.theoreticalGrossMargin - expenses.totalPayroll - expenses.totalExternalCosts
  const theoreticalEbitdaPct = fiscal.theoreticalRevenue > 0 ? (theoreticalEbitda / fiscal.theoreticalRevenue) * 100 : 0

  const rows: PLRow[] = [
    { label: 'CA encaissé HT', value: fiscal.totalRevenue, bold: true, positive: true },
    { label: '+ Facturé non encaissé', value: fiscal.theoreticalRevenue - fiscal.totalRevenue, indent: true },
    { label: '= CA théorique HT', value: fiscal.theoreticalRevenue, bold: true, separator: true, positive: true },
    { label: '— Charges directes (refacturables)', value: -fiscal.totalDirectCosts, indent: true },
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
      <p className="section-note">Exercice {fiscal.year} — données YTD extrapolées</p>

      <div className="pl-table">
        {rows.map((row, i) => (
          <div
            key={i}
            className={[
              'pl-row',
              row.bold ? 'pl-row-bold' : '',
              row.separator ? 'pl-row-separator' : '',
              row.indent ? 'pl-row-indent' : '',
            ].join(' ')}
          >
            <span className="pl-label">{row.label}</span>
            <span
              className="pl-value"
              style={{
                color: row.bold && row.value !== undefined
                  ? row.positive !== undefined
                    ? row.positive ? 'var(--green)' : 'var(--red)'
                    : 'var(--text-primary)'
                  : row.value < 0 ? 'var(--red)' : 'var(--text-primary)',
              }}
            >
              {fmt(row.value)}
              {row.pct !== undefined && (
                <span className="pl-pct"> ({fmtPct(row.pct)})</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="pl-note">
        Les charges directes correspondent aux refacturations client.
        La masse salariale inclut charges patronales.
        Les frais externes couvrent les prestataires, abonnements et autres.
      </div>
    </section>
  )
}
