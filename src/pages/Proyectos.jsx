import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useData } from '../context/DataContext'

const ESTADO_BADGE = {
  activo:    { label: 'Activo',    bg: '#10B98118', color: '#10B981' },
  preparado: { label: 'Preparado', bg: '#F59E0B18', color: '#F59E0B' },
  cerrado:   { label: 'Cerrado',   bg: '#6B728018', color: '#6B7280' },
}

function fmt(n) {
  if (!n || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function Proyectos() {
  const { proyectos, entradas, deleteProyecto } = useData()
  const navigate = useNavigate()
  const [search, setSearch]         = useState('')
  const [anio, setAnio]             = useState(CURRENT_YEAR)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const proyAnio = proyectos.filter(p => p.anio === anio)

  function facturacion(id) {
    return entradas.filter(e => e.proyecto_id === id && e.categoria === 'facturacion').reduce((a, b) => a + Number(b.importe), 0)
  }

  const rows = proyAnio
    .filter(p => !search || p.nombre_contrato.toLowerCase().includes(search.toLowerCase()) || p.cliente.toLowerCase().includes(search.toLowerCase()) || p.codigo_proyecto.includes(search))
    .sort((a, b) => a.codigo_proyecto.localeCompare(b.codigo_proyecto))

  async function handleDelete(e, id) {
    e.stopPropagation()
    if (confirmDelete === id) {
      await deleteProyecto(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.4px' }}>Proyectos</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>{rows.length} proyecto{rows.length !== 1 ? 's' : ''} · {anio}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', cursor: 'pointer' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => navigate('/proyectos/nuevo')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
            <Plus size={14} /> Nuevo proyecto
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 300 }}>
        <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
          style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14 }}>
          {search ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 6 }}>Sin resultados para "{search}"</p>
              <p style={{ fontSize: 13, color: 'var(--c-text-4)' }}>Prueba con otro término de búsqueda</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 6 }}>No hay proyectos en {anio}</p>
              <p style={{ fontSize: 13, color: 'var(--c-text-4)', marginBottom: 20 }}>Crea el primero o cambia el año del filtro</p>
              <button onClick={() => navigate('/proyectos/nuevo')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
                <Plus size={14} /> Nuevo proyecto
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {rows.map(p => {
          const fact = facturacion(p.id)
          const pres = Number(p.presupuesto_base) + Number(p.ampliaciones || 0)
          const ejec = pres > 0 ? fact / pres : 0
          const badge = ESTADO_BADGE[p.estado] || ESTADO_BADGE.activo
          const deleting = confirmDelete === p.id
          return (
            <div key={p.id} onClick={() => navigate(`/proyectos/${p.id}`)}
              style={{ background: 'var(--c-bg-surface)', border: `1px solid ${deleting ? '#EF444460' : 'var(--c-border)'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
              onMouseEnter={e => { if (!deleting) { e.currentTarget.style.borderColor = '#F59E0B80'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,158,11,0.1)' }}}
              onMouseLeave={e => { if (!deleting) { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{p.codigo_proyecto}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  <button onClick={e => handleDelete(e, p.id)} title={deleting ? 'Confirmar borrado' : 'Eliminar proyecto'}
                    style={{ background: deleting ? '#EF444420' : 'none', border: 'none', cursor: 'pointer', color: deleting ? '#EF4444' : 'var(--c-text-4)', padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center', fontSize: 11, gap: 3, fontWeight: deleting ? 700 : 400 }}
                    onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#EF4444' }}
                    onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = deleting ? '#EF4444' : 'var(--c-text-4)' }}
                  >
                    <Trash2 size={12} /> {deleting && 'Confirmar'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 3, lineHeight: 1.3 }}>{p.nombre_contrato}</p>
              <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginBottom: (p.responsable_contrato || p.gestor_proyecto) ? 8 : 14 }}>{p.cliente}</p>
              {(p.responsable_contrato || p.gestor_proyecto) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {p.responsable_contrato && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--c-text-2)', background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '2px 8px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--c-text-3)', flexShrink: 0 }}>Resp.</span> {p.responsable_contrato}
                    </span>
                  )}
                  {p.gestor_proyecto && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--c-text-2)', background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '2px 8px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--c-text-3)', flexShrink: 0 }}>Gestor</span> {p.gestor_proyecto}
                    </span>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Presupuesto</span>
                <span className="font-numeric" style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)' }}>{fmt(pres)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: pres > 0 ? 10 : 0 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Facturado</span>
                <span className="font-numeric" style={{ fontSize: 12, fontWeight: 600, color: '#10B981' }}>{fact > 0 ? fmt(fact) : '—'}</span>
              </div>
              {pres > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Ejecutado</span>
                    <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: ejec < 0.3 ? '#F59E0B' : ejec < 0.85 ? '#7C4DFF' : '#10B981' }}>{(ejec * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--c-border)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(ejec * 100, 100)}%`, height: '100%', background: ejec < 0.3 ? '#F59E0B' : ejec < 0.85 ? '#7C4DFF' : '#10B981', borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
