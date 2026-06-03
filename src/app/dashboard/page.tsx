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

          <PLSection fiscal={data.fiscal} expenses={data.expenses} />

          <CashFlowSection cashFlow={data.cashFlow} />

          <SettingsPanel settings={data.settings} allSuppliers={data.allSuppliers} onSave={load} />
        </>
      )}
    </div>
  )
}

type SupplierCategory = 'external' | 'cogs' | 'payroll'

const CATEGORY_LABELS: Record<SupplierCategory, string> = {
  external: 'Frais externes',
  cogs: '📦 Charges directes (COGS)',
  payroll: '👤 Masse salariale',
}

function SettingsPanel({
  settings,
  allSuppliers,
  onSave,
}: {
  settings: DashboardData['settings']
  allSuppliers: string[]
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const [payrollMonthly, setPayrollMonthly] = useState(String(settings.payrollMonthly))
  const [currentBankBalance, setCurrentBankBalance] = useState(String(settings.currentBankBalance))
  const [bartPucciNames, setBartPucciNames] = useState(settings.bartPucciNames.join(', '))
  const [supplierMap, setSupplierMap] = useState<Record<string, SupplierCategory>>(() => {
    const map: Record<string, SupplierCategory> = {}
    for (const s of settings.cogsSuppliers) map[s] = 'cogs'
    for (const s of settings.payrollSuppliers) map[s] = 'payroll'
    return map
  })
  const [saving, setSaving] = useState(false)

  const setCategory = (supplier: string, cat: SupplierCategory) => {
    setSupplierMap((prev) => ({ ...prev, [supplier]: cat }))
  }

  const handleSave = async () => {
    setSaving(true)
    const cogsSuppliers = Object.entries(supplierMap).filter(([, v]) => v === 'cogs').map(([k]) => k)
    const payrollSuppliers = Object.entries(supplierMap).filter(([, v]) => v === 'payroll').map(([k]) => k)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollMonthly,
        currentBankBalance,
        bartPucciNames: JSON.stringify(bartPucciNames.split(',').map((v: string) => v.trim()).filter(Boolean)),
        cogsSuppliers: JSON.stringify(cogsSuppliers),
        payrollSuppliers: JSON.stringify(payrollSuppliers),
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

      <div className="settings-grid" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label>Masse salariale mensuelle (€ HT)</label>
          <input className="form-input" type="number" value={payrollMonthly}
            onChange={(e) => setPayrollMonthly(e.target.value)} placeholder="Ex: 8000" />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>Utilisé si non détecté via Pennylane</span>
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
      </div>

      <h3 className="section-subtitle" style={{ marginBottom: 12 }}>
        Catégorisation des fournisseurs
      </h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Classez chaque fournisseur pour calculer la marge brute. Par défaut = Frais externes.
      </p>

      {allSuppliers.length === 0 ? (
        <p className="empty-state">Aucun fournisseur détecté dans Pennylane.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Catégorie</th>
              </tr>
            </thead>
            <tbody>
              {allSuppliers.map((supplier) => {
                const cat: SupplierCategory = supplierMap[supplier] ?? 'external'
                return (
                  <tr key={supplier}>
                    <td style={{ fontWeight: 600 }}>{supplier}</td>
                    <td>
                      <select
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={cat}
                        onChange={(e) => setCategory(supplier, e.target.value as SupplierCategory)}
                      >
                        {(Object.entries(CATEGORY_LABELS) as [SupplierCategory, string][]).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}
