'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, PipelineEntryUI, AppSettings } from '@/types'

// Recharts loaded client-side only
const DashboardChart = dynamic(() => import('./DashboardChart'), { ssr: false })

// --- Formatters ---
function fmt(n: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000) return fmt(n / 1000, 0) + ' k€'
  return fmt(n, 0) + ' €'
}

function fmtPct(n: number): string {
  return fmt(n, 1) + ' %'
}

// --- Spinner / Error ---
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
      <div style={{ color: 'var(--red)', fontSize: '1.5rem' }}>!</div>
      <span style={{ color: 'var(--text-secondary)' }}>{message}</span>
      <button className="btn btn-ghost" onClick={onRetry}>
        Réessayer
      </button>
    </div>
  )
}

// --- KPI block ---
function KPI({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ fontSize: '1.35rem', color: color ?? 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

// --- P&L table ---
function PLTable({ data }: { data: DashboardData }) {
  const { current, prevYtd, prevFull } = data

  const rows: { label: string; indent?: boolean; bold?: boolean; values: [number, number, number]; pct?: [number, number, number] }[] = [
    {
      label: 'CA Facturé HT',
      bold: true,
      values: [current.revenue, prevYtd.revenue, prevFull.revenue],
    },
    {
      label: 'CA Encaissé HT',
      values: [
        current.revenue - current.invoicedUnpaid,
        prevYtd.revenue - prevYtd.invoicedUnpaid,
        prevFull.revenue - prevFull.invoicedUnpaid,
      ],
    },
    {
      label: 'Coût direct (COGS)',
      indent: true,
      values: [current.cogs, prevYtd.cogs, prevFull.cogs],
    },
    {
      label: 'Marge Brute',
      bold: true,
      values: [current.grossMargin, prevYtd.grossMargin, prevFull.grossMargin],
      pct: [current.grossMarginPct, prevYtd.grossMarginPct, prevFull.grossMarginPct],
    },
    {
      label: 'Masse Salariale',
      indent: true,
      values: [current.payroll, prevYtd.payroll, prevFull.payroll],
    },
    {
      label: 'Frais Externes',
      indent: true,
      values: [current.externalCosts, prevYtd.externalCosts, prevFull.externalCosts],
    },
    {
      label: 'EBE',
      bold: true,
      values: [current.ebitda, prevYtd.ebitda, prevFull.ebitda],
      pct: [current.ebitdaPct, prevYtd.ebitdaPct, prevFull.ebitdaPct],
    },
  ]

  const colHeaders = ['N — YTD', 'N-1 — YTD', 'N-1 — Exercice complet']

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Compte de Résultat</h2>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '35%' }}>Ligne</th>
              {colHeaders.map((h) => (
                <th key={h} style={{ textAlign: 'right' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td
                  style={{
                    paddingLeft: row.indent ? 28 : undefined,
                    fontWeight: row.bold ? 700 : undefined,
                    color: row.indent ? 'var(--text-secondary)' : undefined,
                  }}
                >
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td key={i} style={{ textAlign: 'right', fontWeight: row.bold ? 700 : undefined }}>
                    {fmtK(v)}
                    {row.pct && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>
                        {fmtPct(row.pct[i])}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// --- Run-rate widget ---
function RunRate({ runRate, prevFullRevenue }: { runRate: DashboardData['runRate']; prevFullRevenue: number }) {
  const total = runRate.total
  const prev = runRate.prevFullRevenue || prevFullRevenue
  const items = [
    { label: 'CA encaissé YTD', value: runRate.ytd, color: 'var(--accent)' },
    { label: 'Facturé non encaissé', value: runRate.unpaid, color: 'var(--green)' },
    { label: 'Pipeline', value: runRate.pipeline, color: 'var(--orange)' },
  ]

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Run-Rate</h2>
      </div>
      <div className="runrate-total">{fmtK(total)}</div>
      {prev > 0 && (
        <div className="runrate-vs" style={{ color: total >= prev ? 'var(--green)' : 'var(--red)' }}>
          {total >= prev ? '+' : ''}
          {fmtPct(prev > 0 ? ((total - prev) / prev) * 100 : 0)} vs N-1 complet ({fmtK(prev)})
        </div>
      )}
      <div className="runrate-stacked" style={{ marginTop: 20 }}>
        {items.map((item) => (
          <div key={item.label} className="runrate-bar-row">
            <div className="runrate-bar-label">{item.label}</div>
            <div className="runrate-bar-track">
              <div
                className="runrate-bar-fill"
                style={{
                  width: total > 0 ? `${Math.min(100, (item.value / total) * 100)}%` : '0%',
                  background: item.color,
                }}
              />
            </div>
            <div className="runrate-bar-value">{fmtK(item.value)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// --- Pipeline table ---
function PipelineTable({
  pipeline,
  onRefresh,
}: {
  pipeline: PipelineEntryUI[]
  onRefresh: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<PipelineEntryUI | null>(null)
  const [form, setForm] = useState({ clientName: '', description: '', amount: '', expectedDate: '', isRecurring: false })
  const [saving, setSaving] = useState(false)

  const openAdd = () => {
    setEditEntry(null)
    setForm({ clientName: '', description: '', amount: '', expectedDate: '', isRecurring: false })
    setShowModal(true)
  }

  const openEdit = (p: PipelineEntryUI) => {
    setEditEntry(p)
    setForm({
      clientName: p.clientName,
      description: p.description ?? '',
      amount: String(p.amount),
      expectedDate: p.expectedDate ?? '',
      isRecurring: p.isRecurring,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const body = {
      clientName: form.clientName,
      description: form.description || null,
      amount: parseFloat(form.amount) || 0,
      expectedDate: form.expectedDate || null,
      isRecurring: form.isRecurring,
    }
    if (editEntry) {
      await fetch(`/api/pipeline/${editEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    setShowModal(false)
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette entrée ?')) return
    await fetch(`/api/pipeline/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const total = pipeline.reduce((s, p) => s + p.amount, 0)

  return (
    <section className="section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pipeline commercial</h2>
          {pipeline.length > 0 && (
            <div className="pipeline-total">Total : {fmtK(total)}</div>
          )}
        </div>
        <button className="btn btn-ghost" onClick={openAdd} style={{ fontSize: '0.83rem' }}>
          + Ajouter
        </button>
      </div>

      {pipeline.length === 0 ? (
        <div className="empty-state">Aucune opportunité dans le pipeline</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th>Date prévue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.clientName}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.description ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtK(p.amount)}</td>
                  <td>{p.expectedDate ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-icon" onClick={() => openEdit(p)} title="Modifier">
                      ✎
                    </button>
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleDelete(p.id)}
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {editEntry ? 'Modifier une opportunité' : 'Ajouter une opportunité'}
            </div>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Client</label>
                <input
                  className="form-input"
                  value={form.clientName}
                  onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
                  placeholder="Nom du client"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Objet de la mission"
                />
              </div>
              <div className="form-group">
                <label>Montant HT (€)</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex : 15000"
                />
              </div>
              <div className="form-group">
                <label>Date prévue</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDate: e.target.value }))}
                />
              </div>
              <div className="form-group form-check">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                  />
                  Récurrent
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// --- Settings panel ---
function SettingsPanel({
  settings,
  onSave,
}: {
  settings: AppSettings
  onSave: () => void
}) {
  const [open, setOpen] = useState(false)
  const [payrollMonthly, setPayrollMonthly] = useState(String(settings.payrollMonthly))
  const [currentBankBalance, setCurrentBankBalance] = useState(String(settings.currentBankBalance))
  const [bartPucciNames, setBartPucciNames] = useState(settings.bartPucciNames.join(', '))
  const [cogsPrefixes, setCogsPrefixes] = useState(settings.cogsAccountPrefixes.join(', '))
  const [payrollPrefixes, setPayrollPrefixes] = useState(settings.payrollAccountPrefixes.join(', '))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payrollMonthly,
        currentBankBalance,
        bartPucciNames: JSON.stringify(
          bartPucciNames
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        ),
        cogsAccountPrefixes: JSON.stringify(
          cogsPrefixes
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        ),
        payrollAccountPrefixes: JSON.stringify(
          payrollPrefixes
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        ),
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
          Parametres du dashboard
        </button>
      </div>
    )
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Parametres</h2>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
      <div className="settings-grid">
        <div className="form-group">
          <label>Masse salariale mensuelle (€ HT)</label>
          <input
            className="form-input"
            type="number"
            value={payrollMonthly}
            onChange={(e) => setPayrollMonthly(e.target.value)}
            placeholder="Ex: 8000"
          />
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Fallback si non détecté via codes 641/645
          </span>
        </div>
        <div className="form-group">
          <label>Solde bancaire actuel (€)</label>
          <input
            className="form-input"
            type="number"
            value={currentBankBalance}
            onChange={(e) => setCurrentBankBalance(e.target.value)}
            placeholder="Ex: 45000"
          />
        </div>
        <div className="form-group">
          <label>Noms Bart &amp; Pucci</label>
          <input
            className="form-input"
            value={bartPucciNames}
            onChange={(e) => setBartPucciNames(e.target.value)}
            placeholder="bart, pucci"
          />
        </div>
        <div className="form-group">
          <label>Codes COGS (charges directes)</label>
          <input
            className="form-input"
            value={cogsPrefixes}
            onChange={(e) => setCogsPrefixes(e.target.value)}
            placeholder="60, 611, 621"
          />
        </div>
        <div className="form-group">
          <label>Codes masse salariale</label>
          <input
            className="form-input"
            value={payrollPrefixes}
            onChange={(e) => setPayrollPrefixes(e.target.value)}
            placeholder="641, 642, 644, 645, 646"
          />
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}

// --- Main page ---
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
      const json: DashboardData = await res.json()
      setData(json)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="page-wrapper">
      {/* Topbar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">ARKT Conseil</div>
          {lastUpdate && (
            <div className="topbar-subtitle">
              Mis à jour{' '}
              {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? 'Actualisation...' : 'Actualiser'}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </div>

      {loading && !data && <Spinner />}
      {error && !data && <ErrorState message={error} onRetry={load} />}

      {data && (
        <>
          {/* 1. KPI Strip */}
          <div className="kpi-row">
            <KPI
              label="CA Facturé YTD"
              value={fmtK(data.current.revenue)}
              sub={`N-1 : ${fmtK(data.prevYtd.revenue)}`}
            />
            <KPI
              label="CA Encaissé YTD"
              value={fmtK(data.current.revenue - data.current.invoicedUnpaid)}
              sub={`En attente : ${fmtK(data.current.invoicedUnpaid)}`}
            />
            <KPI
              label="CA Run-Rate"
              value={fmtK(data.runRate.total)}
              sub={`N-1 complet : ${fmtK(data.runRate.prevFullRevenue)}`}
              color={
                data.runRate.total >= data.runRate.prevFullRevenue
                  ? 'var(--green)'
                  : 'var(--orange)'
              }
            />
            <KPI
              label="Marge Brute YTD"
              value={fmtK(data.current.grossMargin)}
              sub={`N-1 : ${fmtK(data.prevYtd.grossMargin)}`}
            />
            <KPI
              label="Marge Brute %"
              value={fmtPct(data.current.grossMarginPct)}
              sub={`N-1 : ${fmtPct(data.prevYtd.grossMarginPct)}`}
              color={
                data.current.grossMarginPct >= 50
                  ? 'var(--green)'
                  : data.current.grossMarginPct >= 25
                  ? 'var(--orange)'
                  : 'var(--red)'
              }
            />
          </div>

          {/* 2. Chart */}
          <DashboardChart monthly={data.monthly} prevMonthly={data.prevMonthly} />

          {/* 3. P&L table */}
          <PLTable data={data} />

          {/* 4. Run-rate + Pipeline */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: '0 0 40%', minWidth: 0 }}>
              <RunRate runRate={data.runRate} prevFullRevenue={data.prevFull.revenue} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PipelineTable pipeline={data.pipeline} onRefresh={load} />
            </div>
          </div>

          {/* 5. Settings */}
          <SettingsPanel settings={data.settings} onSave={load} />
        </>
      )}
    </div>
  )
}
