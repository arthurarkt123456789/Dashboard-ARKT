'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PipelineGrid as PipelineGridType } from '@/types'

const fmt = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n > 0 ? String(n) : ''

function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`
}

interface LocalData {
  [clientName: string]: { [month: string]: number }
}

function buildLocalData(entries: PipelineGridType['entries']): LocalData {
  const map: LocalData = {}
  for (const e of entries) {
    if (!map[e.clientName]) map[e.clientName] = {}
    map[e.clientName][e.month] = e.amount
  }
  return map
}

export default function PipelineGrid({
  months,
  grid,
  onRefresh,
}: {
  months: string[]
  grid: PipelineGridType
  onRefresh: () => void
}) {
  const [localData, setLocalData] = useState<LocalData>(() => buildLocalData(grid.entries))
  const [clients, setClients] = useState<string[]>(grid.clients)
  const [newClientName, setNewClientName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const debounceRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({})

  // Sync when grid prop changes (on data refresh)
  useEffect(() => {
    setLocalData(buildLocalData(grid.entries))
    setClients(grid.clients)
  }, [grid])

  const saveCell = useCallback(async (clientName: string, month: string, amount: number) => {
    await fetch('/api/pipeline-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName, month, amount }),
    })
  }, [])

  const handleCellChange = (clientName: string, month: string, value: string) => {
    const amount = parseFloat(value) || 0
    setLocalData((prev) => ({
      ...prev,
      [clientName]: { ...(prev[clientName] || {}), [month]: amount },
    }))

    // Debounce save
    const key = `${clientName}|${month}`
    clearTimeout(debounceRefs.current[key])
    debounceRefs.current[key] = setTimeout(() => {
      saveCell(clientName, month, amount)
    }, 600)
  }

  const handleAddClient = async () => {
    const name = newClientName.trim()
    if (!name) return
    if (clients.includes(name)) {
      setNewClientName('')
      setAddingClient(false)
      return
    }
    await fetch('/api/pipeline-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_client', clientName: name }),
    })
    setClients((prev) => [...prev, name].sort())
    setLocalData((prev) => ({ ...prev, [name]: {} }))
    setNewClientName('')
    setAddingClient(false)
  }

  const handleDeleteClient = async (clientName: string) => {
    if (!confirm(`Supprimer ${clientName} du pipeline grille ?`)) return
    await fetch('/api/pipeline-grid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_client', clientName }),
    })
    setClients((prev) => prev.filter((c) => c !== clientName))
    setLocalData((prev) => {
      const next = { ...prev }
      delete next[clientName]
      return next
    })
  }

  // Totals per month
  const totals = months.map((m) =>
    clients.reduce((s, c) => s + (localData[c]?.[m] || 0), 0)
  )

  const grandTotal = totals.reduce((s, v) => s + v, 0)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Pipeline grille</h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Total : <strong>{grandTotal >= 1000 ? `${(grandTotal / 1000).toFixed(1)}k€` : `${grandTotal}€`}</strong>
          </div>
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
          onClick={() => setAddingClient(true)}
        >
          + Client
        </button>
      </div>

      {addingClient && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ flex: 1, fontSize: '0.85rem', padding: '5px 8px' }}
            placeholder="Nom du client"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
            autoFocus
          />
          <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={handleAddClient}>Ajouter</button>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => { setAddingClient(false); setNewClientName('') }}>Annuler</button>
        </div>
      )}

      {clients.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: 20 }}>
          Aucun client. Cliquez sur "+ Client" pour commencer.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 120 }}>
                  Client
                </th>
                {months.map((m) => (
                  <th key={m} style={{ textAlign: 'right', padding: '6px 6px', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 70 }}>
                    {formatMonthLabel(m)}
                  </th>
                ))}
                <th style={{ width: 28 }}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c} style={{ borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c}</td>
                  {months.map((m) => {
                    const val = localData[c]?.[m] || 0
                    return (
                      <td key={m} style={{ padding: '2px 4px' }}>
                        <input
                          type="number"
                          min="0"
                          style={{
                            width: '100%',
                            background: val > 0 ? 'var(--green-dim, rgba(39,174,96,0.1))' : 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            padding: '3px 6px',
                            textAlign: 'right',
                            fontSize: '0.82rem',
                            color: val > 0 ? 'var(--green)' : 'var(--text-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                          value={val || ''}
                          placeholder="0"
                          onChange={(e) => handleCellChange(c, m, e.target.value)}
                        />
                      </td>
                    )
                  })}
                  <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDeleteClient(c)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1 }}
                      title={`Supprimer ${c}`}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-section, var(--bg-card))' }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, fontSize: '0.85rem' }}>Total</td>
                {totals.map((t, i) => (
                  <td key={i} style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 700, color: t > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {t > 0 ? (t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(t)) : '—'}
                  </td>
                ))}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
