'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import HealthBar from '@/components/dashboard/HealthBar'
import PLSection from '@/components/dashboard/PLSection'
import CashFlowSection from '@/components/dashboard/CashFlowSection'
import RunRateWidget from '@/components/dashboard/RunRateWidget'
import PipelineTable from '@/components/dashboard/PipelineTable'
import { DashboardData } from '@/types'

const RevenueChart = dynamic(() => import('@/components/dashboard/RevenueChart'), { ssr: false })

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

          <RevenueChart monthly={data.monthly} fiscal={data.fiscal} />

          <section className="section">
            <RunRateWidget runRate={data.runRate} />
            <PipelineTable pipeline={data.pipeline} onRefresh={load} />
          </section>

          <PLSection fiscal={data.fiscal} expenses={data.expenses} cogsDetail={data.cogsDetail} payrollDetail={data.payrollDetail} directorDetail={data.directorDetail} meuleryDetail={data.meuleryDetail} />

          <CashFlowSection cashFlow={data.cashFlow} />

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
  const [directorSuppliers, setDirectorSuppliers] = useState(settings.directorChargeSuppliers.join(', '))
  const [meulerySuppliers, setMeulerySuppliers] = useState(settings.meuleryChargeSuppliers.join(', '))
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
        directorChargeSuppliers: JSON.stringify(directorSuppliers.split(',').map((v: string) => v.trim()).filter(Boolean)),
        meuleryChargeSuppliers: JSON.stringify(meulerySuppliers.split(',').map((v: string) => v.trim()).filter(Boolean)),
      }),
    })
    setSaving(false)
    setOpen(false)
    onSave()
  }

  const coveragePct = coverage.total > 0 ? Math.round((coverage.categorized / coverage.total) * 100) : 0

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
        <div className="form-group">
          <label>Charges dirigeant (noms fournisseurs)</label>
          <input className="form-input" value={directorSuppliers}
            onChange={(e) => setDirectorSuppliers(e.target.value)} placeholder="dmevent, enolane, amazon" />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Prioritaire sur les codes comptables</span>
        </div>
        <div className="form-group">
          <label>Charges Meuleries (noms fournisseurs)</label>
          <input className="form-input" value={meulerySuppliers}
            onChange={(e) => setMeulerySuppliers(e.target.value)} placeholder="carrelages lupi, little sea" />
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
