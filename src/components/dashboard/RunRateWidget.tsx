'use client'

import { RunRateProjection } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => (n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`)

export default function RunRateWidget({ runRate }: { runRate: RunRateProjection }) {
  const bars: { label: string; value: number; color: string; tooltip: string }[] = [
    { label: 'CA encaissé', value: runRate.ytdRevenue, color: 'var(--accent)', tooltip: 'Factures payées sur l\'exercice' },
    { label: 'Facturé non encaissé', value: runRate.invoicedUnpaid, color: 'var(--orange)', tooltip: 'Factures émises mais pas encore payées' },
    { label: 'Récurrent confirmé', value: runRate.confirmedRecurring, color: 'var(--green)', tooltip: `Clients récurrents × ${runRate.monthsRemaining} mois restants` },
    { label: 'Pipeline', value: runRate.pipeline, color: 'var(--purple)', tooltip: 'Prestations prévues non encore facturées' },
  ]

  const maxVal = Math.max(runRate.total, runRate.prevYearTotal) * 1.05

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Run-rate fin d&apos;exercice</h2>
        <div style={{ textAlign: 'right' }}>
          <div className="runrate-total">{fmt(runRate.total)}</div>
          <div
            className="runrate-vs"
            style={{ color: runRate.variancePct >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {fmtPct(runRate.variancePct)} vs N-1 ({fmt(runRate.prevYearTotal)})
          </div>
        </div>
      </div>

      <div className="runrate-stacked">
        {bars.map((bar) => (
          <div key={bar.label} className="runrate-bar-row" title={bar.tooltip}>
            <div className="runrate-bar-label">{bar.label}</div>
            <div className="runrate-bar-track">
              <div
                className="runrate-bar-fill"
                style={{
                  width: `${(bar.value / maxVal) * 100}%`,
                  background: bar.color,
                }}
              />
            </div>
            <div className="runrate-bar-value">{fmt(bar.value)}</div>
          </div>
        ))}
        <div className="runrate-bar-row runrate-prevyear-row" title="CA total exercice précédent">
          <div className="runrate-bar-label text-secondary">N-1 total</div>
          <div className="runrate-bar-track">
            <div
              className="runrate-bar-fill"
              style={{
                width: `${(runRate.prevYearTotal / maxVal) * 100}%`,
                background: 'transparent',
                border: '2px dashed var(--text-muted)',
              }}
            />
          </div>
          <div className="runrate-bar-value text-secondary">{fmt(runRate.prevYearTotal)}</div>
        </div>
      </div>

      <p className="runrate-note">
        {runRate.monthsRemaining} mois restants dans l&apos;exercice — Le run-rate exclut les doublons pipeline détectés.
      </p>
    </section>
  )
}
