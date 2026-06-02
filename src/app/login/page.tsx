'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/dashboard')
    } else {
      setError('Mot de passe incorrect')
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-title">ARKT Conseil</div>
        <div className="login-sub">Dashboard de pilotage</div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="form-input"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{ marginBottom: 12 }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Connexion...' : 'Accéder'}
          </button>
        </form>
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  )
}
