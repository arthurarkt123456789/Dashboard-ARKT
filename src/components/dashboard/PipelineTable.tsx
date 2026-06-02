'use client'

import { useState } from 'react'
import { PipelineEntry } from '@/types'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

interface Props {
  pipeline: PipelineEntry[]
  onRefresh: () => void
}

type FormData = {
  clientName: string
  description: string
  amount: string
  expectedDate: string
  isRecurring: boolean
  frequency: string
}

const emptyForm: FormData = {
  clientName: '',
  description: '',
  amount: '',
  expectedDate: '',
  isRecurring: false,
  frequency: '',
}

export default function PipelineTable({ pipeline, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [loading, setLoading] = useState(false)

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (entry: PipelineEntry) => {
    setEditId(entry.id)
    setForm({
      clientName: entry.clientName,
      description: entry.description ?? '',
      amount: String(entry.amount),
      expectedDate: entry.expectedDate ?? '',
      isRecurring: entry.isRecurring,
      frequency: entry.frequency ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.clientName || !form.amount) return
    setLoading(true)
    const url = editId ? `/api/pipeline/${editId}` : '/api/pipeline'
    const method = editId ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setLoading(false)
    setShowForm(false)
    setForm(emptyForm)
    setEditId(null)
    onRefresh()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette ligne ?')) return
    await fetch(`/api/pipeline/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const totalPipeline = pipeline.filter((p) => !p.isDuplicate).reduce((s, p) => s + p.amount, 0)
  const dupCount = pipeline.filter((p) => p.isDuplicate).length

  return (
    <div className="pipeline-section">
      <div className="section-header">
        <div>
          <h3 className="section-subtitle">Pipeline à venir</h3>
          <div className="pipeline-total">
            Total pipeline : <strong>{fmt(totalPipeline)}</strong>
            {dupCount > 0 && (
              <span className="dup-warning"> · {dupCount} doublon{dupCount > 1 ? 's' : ''} détecté{dupCount > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Ajouter</button>
      </div>

      {pipeline.length === 0 ? (
        <p className="empty-state">Aucune prestation dans le pipeline. Cliquez sur "Ajouter" pour commencer.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th>Date prévue</th>
                <th>Récurrent</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((entry) => (
                <tr key={entry.id} className={entry.isDuplicate ? 'row-duplicate' : ''}>
                  <td style={{ fontWeight: 600 }}>{entry.clientName}</td>
                  <td className="text-secondary">{entry.description || '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(entry.amount)}</td>
                  <td className="text-secondary">
                    {entry.expectedDate
                      ? new Date(entry.expectedDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td>{entry.isRecurring ? <span className="badge-green">Oui{entry.frequency ? ` (${entry.frequency})` : ''}</span> : '—'}</td>
                  <td>
                    {entry.isDuplicate ? (
                      <span className="badge-red" title="Semble déjà avoir été facturé — vérifiez et retirez si c'est le cas">⚠ Déjà facturé ?</span>
                    ) : (
                      <span className="badge-neutral">En cours</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => openEdit(entry)} title="Modifier">✏</button>
                    <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(entry.id)} title="Supprimer">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editId ? 'Modifier' : 'Ajouter'} une prestation</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Client *</label>
                <input
                  className="form-input"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="Nom du client"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Mission, prestation..."
                />
              </div>
              <div className="form-group">
                <label>Montant HT (€) *</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Date prévue</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.expectedDate}
                  onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                />
              </div>
              <div className="form-group form-check">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                  />
                  Récurrent
                </label>
              </div>
              {form.isRecurring && (
                <div className="form-group">
                  <label>Fréquence</label>
                  <select
                    className="form-input"
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="monthly">Mensuel</option>
                    <option value="quarterly">Trimestriel</option>
                    <option value="annual">Annuel</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
