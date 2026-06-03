'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import HealthBar from '@/components/dashboard/HealthBar'
import PLSection from '@/components/dashboard/PLSection'
import RunRateWidget from '@/components/dashboard/RunRateWidget'
import PipelineTable from '@/components/dashboard/PipelineTable'
import KPIStrip from '@/components/dashboard/KPIStrip'
import { DashboardData, TreasuryItem } from '@/types'
import { getFiscalYear } from '@/lib/calculations'
import { format, addMonths } from 'date-fns'

const RevenueChart = dynamic(() => import('@/components/dashboard/RevenueChart'), { ssr: false })
const PipelineGrid = dynamic(() => import('@/components/dashboard/PipelineGrid'), { ssr: false })
const TreasurySection = dynamic(() => import('@/components/dashboard/TreasurySection'), { ssr: false })

function Spinner() {
  return (
    <div className="loading-wrapper">
      <div className="spinner" />
      <span>Chargement des données Pennylane...</span>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="loading-wrapper">
      <div style={{ color: 'var(--red)', fontSize: '1.5rem' }}>⚠</div>
      <span style={{ color: 'var(--text-secondary)' }}>{message}</span>
      <button className="btn btn-ghost" onClick={onRetry}>Réessayer</button>
    </div>
  )
}

function buildFiscalMonths(): string[] {
  const now = new Date()
  const fy = getFiscalYear(now)
  const currentMonth = format(now, 'yyyy-MM')
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const m = format(addMonths(fy.start, i), 'yyyy-MM')
    if (m >= currentMonth) months.push(m)
  }
  return months
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
      if (json.pennylaneError) setError(json.pennylaneError)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const fiscalMonths = buildFiscalMonths()

  return (
    <div className="page-wrapper">
      <div className="topbar">
        <div>
          <div className="topbar-title">ARKT Conseil</div>
          {lastUpdate && (
            <div className="topbar-subtitle">
              Mis à jour {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? '↻ Actualisation...' : '↻ Actualiser'}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      {loading && !data && <Spinner />}
      {error && !data && <ErrorState message={error} onRetry={load} />}
      {error && data && (
        <div style={{ background: 'var(--orange-dim)', border: '1px solid var(--orange)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--orange)', fontSize: '0.85rem' }}>
          ⚠ {error}
        </div>
      )}

      {data && (
        <>
          <HealthBar health={data.health} />

          {/* 1. KPI Strip */}
          <KPIStrip fiscal={data.fiscal} runRate={data.runRate} />

          {/* 2. Margin/Revenue Chart */}
          <RevenueChart monthly={data.monthly} fiscal={data.fiscal} />

          {/* 3. RunRate + PipelineGrid side by side */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ width: '40%', minWidth: 0 }}>
              <RunRateWidget runRate={data.runRate} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PipelineGrid
                months={fiscalMonths}
                grid={data.pipelineGrid}
                onRefresh={load}
              />
            </div>
          </div>

          {/* Legacy pipeline table (hidden if grid has data, kept for backwards compat) */}
          {data.pipeline.length > 0 && (
            <section className="section">
              <PipelineTable pipeline={data.pipeline} onRefresh={load} />
            </section>
          )}

          {/* 4. P&L 3 columns */}
          <PLSection
            fiscal={data.fiscal}
            expenses={data.expenses}
            monthly={data.monthly}
            prevYearFullExpenses={data.prevYearFullExpenses}
            cogsDetail={data.cogsDetail}
            payrollDetail={data.payrollDetail}
          />

          {/* 5. Treasury section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 8px' }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>TRÉSORERIE</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          </div>

          <TreasurySection
            monthly={data.monthly}
            pipelineGrid={data.pipelineGrid}
            settings={data.settings}
            onRefresh={load}
          />

          <SettingsPanel settings={data.settings} coverage={data.expenseCoverage} onSave={load} />
        </>
      )}
    </div>
  )
}

function SettingsPanel({
  settings,
  coverage,
  onSave,
}: {
  settings: DashboardData['settings']
  coverage: DashboardData['expenseCoverage']
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const [payrollMonthly, setPayrollMonthly] = useState(String(settings.payrollMonthly))
  const [currentBankBalance, setCurrentBankBalance] = useState(String(settings.currentBankBalance))
  const [bartPucciNames, setBartPucciNames] = useState(settings.bartPucciNames.join(', '))
  const [cogsPrefixes, setCogsPrefixes] = useState(settings.cogsAccountPrefixes.join(', '))
  const [payrollPrefixes, setPayrollPrefixes] = useState(settings.payrollAccountPrefixes.join(', '))
  const [treasuryItems, setTreasuryItems] = useState<TreasuryItem[]>(settings.treasuryItems ?? [])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollMonthly,
        currentBankBalance,
        bartPucciNames: JSON.stringify(bartPucciNames.split(',').map((v: string) => v.trim()).filter(Boolean)),
        cogsAccountPrefixes: JSON.stringify(cogsPrefixes.split(',').map((v: string) => v.trim()).filter(Boolean)),
        payrollAccountPrefixes: JSON.stringify(payrollPrefixes.split(',').map((v: string) => v.trim()).filter(Boolean)),
        treasuryItems: JSON.stringify(treasuryItems),
      }),
    })
    setSaving(false)
    setOpen(false)
    onSave()
  }

  const updateTreasuryItem = (idx: number, field: keyof TreasuryItem, value: string | number) => {
    setTreasuryItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const addTreasuryItem = () => {
    setTreasuryItems((prev) => [...prev, { name: '', monthlyAmount: 0, dayOfMonth: 1 }])
  }

  const removeTreasuryItem = (idx: number) => {
    setTreasuryItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const coveragePct = coverage.total > 0 ? Math.round((coverage.categorized / coverage.total) * 100) : 0
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState('')

  const forceRefreshCache = async () => {
    setRefreshing(true)
    setRefreshResult('')
    const r = await fetch('/api/admin/refresh-cache', { method: 'POST' })
    const data = await r.json()
    setRefreshResult(`${data.newly_fetched} nouvelles écritures chargées, ${data.errors} erreurs`)
    setRefreshing(false)
    onSave()
  }

  if (!open) {
    return (
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={() => setOpen(true)} style={{ fontSize: '0.78rem' }}>
          ⚙ Paramètres du dashboard
        </button>
      </div>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">⚙ Paramètres</h2>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
      </div>

      <div style={{ background: coveragePct === 100 ? 'var(--green-dim)' : 'var(--orange-dim)', border: `1px solid ${coveragePct === 100 ? 'var(--green)' : 'var(--orange)'}`, borderRadius: 6, padding: '10px 14px', marginBottom: 20, fontSize: '0.83rem', color: coveragePct === 100 ? 'var(--green)' : 'var(--orange)' }}>
        {coveragePct === 100
          ? `✓ 100% des factures fournisseurs catégorisées via Pennylane (codes comptables).`
          : `⚠ ${coveragePct}% des factures catégorisées (${coverage.categorized}/${coverage.total}). Les ${coverage.total - coverage.categorized} non catégorisées sont comptées en frais externes.`}
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={forceRefreshCache} disabled={refreshing} style={{ fontSize: '0.78rem' }}>
            {refreshing ? '↻ Chargement...' : '↻ Forcer le recalcul des codes comptables'}
          </button>
          {refreshResult && <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>{refreshResult}</span>}
        </div>
      </div>

      <div className="settings-grid">
        <div className="form-group">
          <label>Masse salariale mensuelle (€ HT)</label>
          <input className="form-input" type="number" value={payrollMonthly}
            onChange={(e) => setPayrollMonthly(e.target.value)} placeholder="Ex: 8000" />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Fallback si masse salariale non détectée via codes 641/645</span>
        </div>
        <div className="form-group">
          <label>Solde bancaire actuel (€)</label>
          <input className="form-input" type="number" value={currentBankBalance}
            onChange={(e) => setCurrentBankBalance(e.target.value)} placeholder="Ex: 45000" />
        </div>
        <div className="form-group">
          <label>Noms Bart &amp; Pucci (séparés par virgule)</label>
          <input className="form-input" value={bartPucciNames}
            onChange={(e) => setBartPucciNames(e.target.value)} placeholder="bart, pucci" />
        </div>
        <div className="form-group">
          <label>Codes COGS (charges directes)</label>
          <input className="form-input" value={cogsPrefixes}
            onChange={(e) => setCogsPrefixes(e.target.value)} placeholder="60, 611, 621" />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Préfixes du plan comptable → charges directes</span>
        </div>
        <div className="form-group">
          <label>Codes masse salariale</label>
          <input className="form-input" value={payrollPrefixes}
            onChange={(e) => setPayrollPrefixes(e.target.value)} placeholder="641, 642, 644, 645, 646" />
        </div>
      </div>

      {/* Treasury Items */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Postes de trésorerie fixes</h3>
          <button className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={addTreasuryItem}>+ Ajouter</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)' }}>Nom</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)' }}>Montant mensuel (€)</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-secondary)' }}>Jour du mois</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)' }}>Mot-clé (optionnel)</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {treasuryItems.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.83rem', padding: '4px 8px' }}
                      value={item.name}
                      onChange={(e) => updateTreasuryItem(idx, 'name', e.target.value)}
                      placeholder="Nom du poste"
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.83rem', padding: '4px 8px', textAlign: 'right' }}
                      type="number"
                      value={item.monthlyAmount}
                      onChange={(e) => updateTreasuryItem(idx, 'monthlyAmount', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.83rem', padding: '4px 8px', textAlign: 'right', width: 70 }}
                      type="number"
                      min={1}
                      max={31}
                      value={item.dayOfMonth}
                      onChange={(e) => updateTreasuryItem(idx, 'dayOfMonth', parseInt(e.target.value) || 1)}
                    />
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.83rem', padding: '4px 8px' }}
                      value={item.keyword ?? ''}
                      onChange={(e) => updateTreasuryItem(idx, 'keyword', e.target.value)}
                      placeholder="ex: crédit agricole"
                    />
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => removeTreasuryItem(idx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '1rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}
