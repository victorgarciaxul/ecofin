import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Pre-computed bars (deterministic, no Math.random on each render)
const BARS = Array.from({ length: 72 }, (_, i) => ({
  h:     15 + ((i * 41 + 7)  % 78),
  dur:   1.3 + ((i * 3) % 5) * 0.28,
  delay: ((i * 7) % 13) * 0.18,
}))

// Floating financial labels
const FLOATS = [
  { text: '+4.2%',  color: '#10B981', x: 6,  y: 14, dur: 4.2, delay: 0    },
  { text: '€1.4M',  color: '#F59E0B', x: 18, y: 68, dur: 5.1, delay: 0.8  },
  { text: '-1.8%',  color: '#EF4444', x: 74, y: 22, dur: 3.8, delay: 1.4  },
  { text: '+8.5%',  color: '#10B981', x: 86, y: 71, dur: 4.7, delay: 0.3  },
  { text: '€840K',  color: '#F59E0B', x: 9,  y: 42, dur: 5.5, delay: 2.1  },
  { text: '+2.1%',  color: '#10B981', x: 91, y: 45, dur: 4.0, delay: 1.7  },
  { text: '€2.6M',  color: '#F59E0B', x: 42, y: 8,  dur: 3.6, delay: 0.6  },
  { text: '-0.4%',  color: '#EF4444', x: 58, y: 86, dur: 5.8, delay: 2.5  },
  { text: '+12.3%', color: '#10B981', x: 28, y: 82, dur: 4.3, delay: 1.1  },
  { text: '€320K',  color: '#F59E0B', x: 70, y: 8,  dur: 3.9, delay: 1.9  },
]

export default function Login() {
  const { signIn, isDemo } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) { setError(error.message); setLoading(false) }
    else navigate('/dashboard', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#07070f', position: 'relative', overflow: 'hidden',
      fontFamily: 'Poppins, sans-serif',
    }}>

      {/* ── Animated background ─────────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

        {/* Radial glow behind card */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '55vmin', height: '55vmin',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)',
        }} />

        {/* Big circle ring */}
        <svg style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '72vmin', height: '72vmin', animation: 'pulseRing 4s ease-in-out infinite' }}
          viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="97" stroke="#F59E0B" strokeWidth="0.6" />
          <circle cx="100" cy="100" r="80" stroke="rgba(245,158,11,0.3)" strokeWidth="0.3" strokeDasharray="4 8" />
        </svg>

        {/* Tick marks on the ring */}
        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i * 15 - 90) * (Math.PI / 180)
          const r1 = 96, r2 = 90
          const x1 = 100 + r1 * Math.cos(angle), y1 = 100 + r1 * Math.sin(angle)
          const x2 = 100 + r2 * Math.cos(angle), y2 = 100 + r2 * Math.sin(angle)
          return (
            <svg key={i} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '72vmin', height: '72vmin', opacity: 0.25 }}
              viewBox="0 0 200 200" fill="none">
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F59E0B" strokeWidth={i % 6 === 0 ? '1' : '0.4'} />
            </svg>
          )
        })}

        {/* Bottom bar chart */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
          display: 'flex', alignItems: 'flex-end', paddingBottom: 0,
          gap: 2, padding: '0 24px',
        }}>
          {BARS.map((bar, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${bar.h}%`,
              background: i % 3 === 0
                ? 'linear-gradient(to top, #F59E0B80, #EF444440)'
                : i % 3 === 1
                  ? 'linear-gradient(to top, #10B98160, #06B6D430)'
                  : 'linear-gradient(to top, #F59E0B40, #F59E0B10)',
              borderRadius: '2px 2px 0 0',
              transformOrigin: 'bottom',
              animation: `barPulse ${bar.dur}s ease-in-out infinite`,
              animationDelay: `${bar.delay}s`,
              opacity: 0.7,
            }} />
          ))}
        </div>

        {/* Floating financial labels */}
        {FLOATS.map((f, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${f.x}%`, top: `${f.y}%`,
            fontSize: 11, fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            color: f.color,
            animation: `floatFade ${f.dur}s ease-in-out infinite`,
            animationDelay: `${f.delay}s`,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}>{f.text}</div>
        ))}

        {/* Horizontal grid lines (subtle) */}
        {[25, 45, 65].map(pct => (
          <div key={pct} style={{
            position: 'absolute', left: 0, right: 0,
            top: `${pct}%`, height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(245,158,11,0.06), rgba(245,158,11,0.06), transparent)',
          }} />
        ))}
      </div>

      {/* ── Login card ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: 360,
        background: 'rgba(19,19,31,0.92)',
        backdropFilter: 'blur(16px)',
        borderRadius: 16,
        padding: '36px 32px 28px',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(245,158,11,0.5), 0 4px 14px rgba(245,158,11,0.3)',
          }}>
            <TrendingUp size={24} color="white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.4px', marginBottom: 4 }}>
            EcoFin
          </h1>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Análisis Financiero&nbsp;·&nbsp;XUL
          </p>
        </div>

        {/* Tagline */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24, lineHeight: 1.4 }}>
          Bienvenido/a. Introduce tus credenciales.
        </p>

        {/* Form */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>
              Usuario
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="correo@empresa.com"
              style={{
                width: '100%', padding: '10px 13px', borderRadius: 9,
                border: 'none', outline: 'none', boxSizing: 'border-box',
                background: '#ffffff', color: '#0f0f1a',
                fontSize: 13, fontFamily: 'Poppins, sans-serif',
              }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.6)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>
              Contraseña
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••••••"
              style={{
                width: '100%', padding: '10px 13px', borderRadius: 9,
                border: 'none', outline: 'none', boxSizing: 'border-box',
                background: '#ffffff', color: '#0f0f1a',
                fontSize: 13, fontFamily: 'Poppins, sans-serif',
              }}
              onFocus={e => e.target.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.6)'}
              onBlur={e => e.target.style.boxShadow = 'none'}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: '#EF4444', padding: '8px 12px', background: 'rgba(239,68,68,0.12)', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)' }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 6, padding: '12px', borderRadius: 9, border: 'none',
              background: loading ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg,#F59E0B,#EF4444)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 18px rgba(245,158,11,0.45)',
              letterSpacing: '0.02em', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => e.target.style.transform = 'none'}
          >
            {loading ? 'Accediendo…' : 'Acceder al Panel'}
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 24, letterSpacing: '0.06em' }}>
          XUL &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
