import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { TrendingUp, LayoutDashboard, FolderOpen, Users, Plus, LogOut, RotateCcw } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/proyectos',  icon: FolderOpen,      label: 'Proyectos' },
  { to: '/carga',      icon: Users,           label: 'Carga de Trabajo' },
]

export default function Sidebar() {
  const { user, signOut, isDemo } = useAuth()
  const { resetToDemo } = useData()
  const location = useLocation()
  const navigate  = useNavigate()
  const userName  = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 230, flexShrink: 0,
      background: 'var(--c-sidebar-bg)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      fontFamily: 'Poppins, sans-serif',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
          }}>
            <TrendingUp size={17} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', display: 'block' }}>EcoFin</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Control Económico</span>
          </div>
        </div>
        <img src="/logo-xul.png" alt="XUL" style={{ width: '100%', maxWidth: 150, display: 'block', filter: 'invert(1) brightness(1.1)', opacity: 0.75 }} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', padding: '8px 8px 6px' }}>Menú</p>
        {NAV.map(item => {
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 9,
                background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: isActive ? '#F59E0B' : 'var(--c-sidebar-text)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: 'all 0.1s', cursor: 'pointer',
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: isActive ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={14} style={{ color: isActive ? '#F59E0B' : 'rgba(255,255,255,0.4)' }} />
                </div>
                {item.label}
              </div>
            </NavLink>
          )
        })}

        {/* Nuevo proyecto */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => navigate('/proyectos/nuevo')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 9, border: '1px dashed rgba(245,158,11,0.4)',
              background: 'transparent', cursor: 'pointer', color: '#F59E0B',
              fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Plus size={14} /> Nuevo proyecto
          </button>
        </div>

        {isDemo && (
          <div style={{ marginTop: 16, padding: '10px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginBottom: 2 }}>Modo demo</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, marginBottom: 8 }}>Datos del Excel importados. Conecta Supabase para guardar cambios.</p>
            <button
              onClick={() => { if (window.confirm('¿Restaurar todos los datos del Excel? Se perderán los cambios guardados.')) { resetToDemo(); navigate('/dashboard') } }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 8px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <RotateCcw size={10} /> Restaurar demo
            </button>
          </div>
        )}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{userName}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Manager</p>
          </div>
          <button onClick={signOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2, display: 'flex' }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
