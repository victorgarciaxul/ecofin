import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, isDemo } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  if (isDemo) {
    navigate('/dashboard', { replace: true })
    return null
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard', { replace: true })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-sidebar-bg)' }}>
      <div style={{ width: 380, background: 'var(--c-bg-surface)', borderRadius: 18, padding: '40px 36px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(245,158,11,0.4)' }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>EcoFin</h1>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)', margin: 0 }}>Control Económico-Financiero</p>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', fontSize: 13, color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ fontSize: 12, color: '#EF4444', padding: '8px 12px', background: '#EF444410', borderRadius: 7 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '11px', borderRadius: 9, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', marginTop: 4, boxShadow: '0 4px 14px rgba(245,158,11,0.35)' }}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
