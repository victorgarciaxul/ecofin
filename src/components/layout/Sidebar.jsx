import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { TrendingUp, LayoutDashboard, FolderOpen, Users, Plus, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  {
    section: 'Gestión',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'          },
      { to: '/proyectos',  icon: FolderOpen,      label: 'Proyectos'          },
      { to: '/carga',      icon: Users,           label: 'Análisis de trabajo'},
    ],
  },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate  = useNavigate()
  const userName  = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside style={{
      width: 224,
      flexShrink: 0,
      height: '100%',
      background: 'var(--c-sidebar-bg)',
      borderRadius: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Poppins, sans-serif',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
          }}>
            <TrendingUp size={16} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', display: 'block', lineHeight: 1.2 }}>EcoFin</span>
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Control Económico</span>
          </div>
        </div>
        <img
          src="/logo-xul.png" alt="XUL"
          style={{ width: '100%', maxWidth: 120, display: 'block', filter: 'invert(1)', mixBlendMode: 'screen', opacity: 0.7 }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.section} style={{ marginBottom: 6 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.22)',
              padding: '8px 8px 5px',
            }}>{group.section}</p>

            {group.items.map(item => {
              const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} style={{ textDecoration: 'none', display: 'block', marginBottom: 1 }}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 10px', borderRadius: 9,
                      background: isActive ? 'rgba(245,158,11,0.18)' : 'transparent',
                      color: isActive ? '#F5A623' : 'rgba(255,255,255,0.58)',
                      fontSize: 13, fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 27, height: 27, borderRadius: 7, flexShrink: 0,
                      background: isActive ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                    }}>
                      <Icon size={13} style={{ color: isActive ? '#F5A623' : 'rgba(255,255,255,0.38)' }} />
                    </div>
                    {item.label}
                  </div>
                </NavLink>
              )
            })}
          </div>
        ))}

        {/* Nuevo proyecto */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => navigate('/proyectos/nuevo')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 9,
              border: '1px dashed rgba(245,158,11,0.35)',
              background: 'transparent', cursor: 'pointer',
              color: 'rgba(245,158,11,0.75)',
              fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)'; e.currentTarget.style.color = '#F5A623' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(245,158,11,0.75)' }}
          >
            <Plus size={13} /> Nuevo proyecto
          </button>
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: '10px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,0.05)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#F59E0B,#EF4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{userName}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Manager</p>
          </div>
          <button
            onClick={signOut}
            title="Cerrar sesión"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: 3, display: 'flex', borderRadius: 5, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
