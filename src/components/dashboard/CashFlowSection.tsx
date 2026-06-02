'use client'

import { CashFlowMonth } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

function Check({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        color: ok ? 'var(--green)' : 'var(--red)',
        fontWeight: 700,
        fontSize: '1.1rem',
      }}
      title={ok ? 'OK' : 'Insuffisant'}
    >
      {ok ? '✓' : '✗'}
    </span>
  )
}

export default function CashFlowSection({ cashFlow }: { cashFlow: CashFlowMonth[] }) {
  const currentMonth = cashFlow.find((m) => !m.isHistorical)

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Plan de trésorerie</h2>
        {currentMonth && (
          <div className="cf-current-status">
            <span>Ce mois :</span>
            <span title="Peut-on payer les charges fixes en début de mois ?">
              SOM <Check ok={currentMonth.canPayStartOfMonth} />
            </span>
            <span title="Sera-t-on positif en fin de mois ?">
              EOM <Check ok={currentMonth.canPayEndOfMonth} />
            </span>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table className="data-table cf-table">
          <thead>
            <tr>
              <th>Mois</th>
              <th style={{ textAlign: 'right' }}>Entrées</th>
              <th style={{ textAlign: 'right' }}>Salaires</th>
              <th style={{ textAlign: 'right' }}>Ch. directes</th>
              <th style={{ textAlign: 'right' }}>Frais ext.</th>
              <th style={{ textAlign: 'right' }}>Net</th>
              <th style={{ textAlign: 'right' }}>Cumul</th>
              <th style={{ textAlign: 'center' }}>SOM</th>
              <th style={{ textAlign: 'center' }}>EOM</th>
            </tr>
          </thead>
          <tbody>
            {cashFlow.map((m) => (
              <tr
                key={m.month}
                className={[
                  m.isHistorical ? 'row-historical' : 'row-forecast',
                  !m.isHistorical && !m.canPayEndOfMonth ? 'row-danger' : '',
                ].join(' ')}
              >
                <td style={{ fontWeight: 600 }}>
                  {m.label}
                  {!m.isHistorical && <span className="forecast-tag">prev.</span>}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                  {fmt(m.isHistorical ? m.revenue : m.collected)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--red)' }}>
                  {m.payroll > 0 ? fmt(-m.payroll) : '—'}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {m.directCosts > 0 ? fmt(-m.directCosts) : '—'}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {m.externalCosts > 0 ? fmt(-m.externalCosts) : '—'}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: m.netFlow >= 0 ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {m.netFlow >= 0 ? '+' : ''}{fmt(m.netFlow)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 600,
                    color: m.cumulativeCash >= 0 ? 'var(--text-primary)' : 'var(--red)',
                  }}
                >
                  {fmt(m.cumulativeCash)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {!m.isHistorical ? <Check ok={m.canPayStartOfMonth} /> : '—'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {!m.isHistorical ? <Check ok={m.canPayEndOfMonth} /> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cf-legend">
        <span><strong>SOM</strong> = Début de mois : solde suffit pour payer les salaires avant les rentrées</span>
        <span><strong>EOM</strong> = Fin de mois : solde positif en incluant toutes les transactions</span>
        <span>Les lignes <em>prev.</em> sont des prévisions basées sur les factures émises, le pipeline et les charges récurrentes</span>
      </div>
    </section>
  )
}
