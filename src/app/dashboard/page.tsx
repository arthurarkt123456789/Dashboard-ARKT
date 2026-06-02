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
      {error && <ErrorState message={error} onRetry={load} />}

      {data && (
        <>
          <HealthBar health={data.health} />

          <RevenueChart monthly={data.monthly} fiscal={data.fiscal} />

          <section className="section">
            <RunRateWidget runRate={data.runRate} />
            <PipelineTable pipeline={data.pipeline} onRefresh={load} />
          </section>

          <PLSection fiscal={data.fiscal} expenses={data.expenses} />

          <CashFlowSection cashFlow={data.cashFlow} />

          <SettingsPanel settings={data.settings} onSave={load} />
        </>
      )}
    </div>
  )
}

// Inline settings panel
function SettingsPanel({
  settings,
  onSave,
}: {
  settings: DashboardData['settings']
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    payrollMonthly: String(settings.payrollMonthly),
    currentBankBalance: String(settings.currentBankBalance),
    bartPucciNames: settings.bartPucciNames.join(', '),
    directCostKeywords: settings.directCostKeywords.join(', '),
    payrollKeywords: settings.payrollKeywords.join(', '),
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollMonthly: form.payrollMonthly,
        currentBankBalance: form.currentBankBalance,
        bartPucciNames: JSON.stringify(form.bartPucciNames.split(',').map((v: string) => v.trim()).filter(Boolean)),
        directCostKeywords: JSON.stringify(form.directCostKeywords.split(',').map((v: string) => v.trim()).filter(Boolean)),
        payrollKeywords: JSON.stringify(form.payrollKeywords.split(',').map((v: string) => v.trim()).filter(Boolean)),
      }),
    })
    setSaving(false)
    setOpen(false)
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
      <div className="settings-grid">
        <div className="form-group">
          <label>Masse salariale mensuelle (€ HT)</label>
          <input
            className="form-input"
            type="number"
            value={form.payrollMonthly}
            onChange={(e) => setForm({ ...form, payrollMonthly: e.target.value })}
            placeholder="Ex: 8000"
          />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Si non détectable automatiquement via Pennylane
          </span>
        </div>
        <div className="form-group">
          <label>Solde bancaire actuel (€)</label>
          <input
            className="form-input"
            type="number"
            value={form.currentBankBalance}
            onChange={(e) => setForm({ ...form, currentBankBalance: e.target.value })}
            placeholder="Ex: 45000"
          />
        </div>
        <div className="form-group">
          <label>Noms Bart & Pucci (séparés par virgule)</label>
          <input
            className="form-input"
            value={form.bartPucciNames}
            onChange={(e) => setForm({ ...form, bartPucciNames: e.target.value })}
            placeholder="bart, pucci, bart & pucci"
          />
        </div>
        <div className="form-group">
          <label>Mots-clés charges directes</label>
          <input
            className="form-input"
            value={form.directCostKeywords}
            onChange={(e) => setForm({ ...form, directCostKeywords: e.target.value })}
            placeholder="sous-traitance, prestation..."
          />
        </div>
        <div className="form-group">
          <label>Mots-clés masse salariale</label>
          <input
            className="form-input"
            value={form.payrollKeywords}
            onChange={(e) => setForm({ ...form, payrollKeywords: e.target.value })}
            placeholder="salaire, paie, bulletin..."
          />
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}
