import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Layers } from 'lucide-react'
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
  const [search, setSearch]               = useState('')
  const [anio, setAnio]                   = useState(CURRENT_YEAR)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [vistaGlobal, setVistaGlobal]     = useState(false)
  const [estadoFilter, setEstadoFilter]   = useState(null) // null = todos

  const proyAnio = proyectos.filter(p => p.anio === anio)

  function facturacionId(id) {
    return entradas.filter(e => e.proyecto_id === id && e.categoria === 'facturacion').reduce((a, b) => a + Number(b.importe), 0)
  }

  function facturacionIds(ids) {
    return entradas.filter(e => ids.includes(e.proyecto_id) && e.categoria === 'facturacion').reduce((a, b) => a + Number(b.importe), 0)
  }

  // Vista por año (normal)
  const rows = useMemo(() =>
    proyAnio
      .filter(p => !search || p.nombre_contrato.toLowerCase().includes(search.toLowerCase()) || p.cliente.toLowerCase().includes(search.toLowerCase()) || p.codigo_proyecto.includes(search))
      .filter(p => !estadoFilter || p.estado === estadoFilter)
      .sort((a, b) => a.codigo_proyecto.localeCompare(b.codigo_proyecto)),
  [proyAnio, search, estadoFilter])

  // Vista global: agrupa todos los años por código de proyecto
  const rowsGlobal = useMemo(() => {
    const groups = {}
    proyectos.forEach(p => {
      const key = p.codigo_proyecto
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return Object.values(groups)
      .map(all => {
        const latest  = [...all].sort((a, b) => b.anio - a.anio)[0]
        const ids     = all.map(p => p.id)
        const pres    = all.reduce((s, p) => s + Number(p.presupuesto_base || 0) + Number(p.ampliaciones || 0), 0)
        const fact    = facturacionIds(ids)
        const anios   = [...new Set(all.map(p => p.anio))].sort()
        const periodoLabel = anios.length > 1 ? `${anios[0]}–${anios[anios.length - 1]}` : String(anios[0])
        return { ...latest, _pres: pres, _fact: fact, periodoLabel, multiYear: anios.length > 1, latestId: latest.id }
      })
      .filter(p => !search || p.nombre_contrato.toLowerCase().includes(search.toLowerCase()) || p.cliente.toLowerCase().includes(search.toLowerCase()) || p.codigo_proyecto.includes(search))
      .filter(p => !estadoFilter || p.estado === estadoFilter)
      .sort((a, b) => a.codigo_proyecto.localeCompare(b.codigo_proyecto))
  }, [proyectos, entradas, search, estadoFilter]) // eslint-disable-line

  const activeRows = vistaGlobal ? rowsGlobal : rows

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
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>
            {activeRows.length} proyecto{activeRows.length !== 1 ? 's' : ''}
            {vistaGlobal ? ' · todos los años' : ` · ${anio}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setVistaGlobal(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: vistaGlobal ? '#7C4DFF18' : 'var(--c-bg-surface)', color: vistaGlobal ? '#7C4DFF' : 'var(--c-text-2)', border: `1.5px solid ${vistaGlobal ? '#7C4DFF50' : 'var(--c-border)'}`, cursor: 'pointer', boxShadow: vistaGlobal ? '0 2px 8px rgba(124,77,255,0.2)' : 'none', transition: 'all 0.15s' }}>
            <Layers size={14} /> Vista global
          </button>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} disabled={vistaGlobal}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--c-border)', background: vistaGlobal ? 'var(--c-bg-muted)' : 'var(--c-bg-surface)', color: vistaGlobal ? 'var(--c-text-4)' : 'var(--c-text-1)', cursor: vistaGlobal ? 'default' : 'pointer', opacity: vistaGlobal ? 0.5 : 1 }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => navigate('/proyectos/nuevo')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
            <Plus size={14} /> Nuevo proyecto
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
            style={{ width: 260, padding: '8px 12px 8px 32px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[null, 'activo', 'preparado', 'cerrado'].map(est => {
            const badge = est ? ESTADO_BADGE[est] : null
            const active = estadoFilter === est
            return (
              <button key={est ?? 'todos'} onClick={() => setEstadoFilter(est)}
                style={{ padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? (badge?.color ?? 'var(--c-text-1)') : 'var(--c-border)'}`, background: active ? (badge ? badge.bg : 'var(--c-bg-muted)') : 'var(--c-bg-surface)', color: active ? (badge?.color ?? 'var(--c-text-1)') : 'var(--c-text-3)', transition: 'all 0.15s' }}>
                {est ? badge.label : 'Todos'}
              </button>
            )
          })}
        </div>
      </div>

      {/* Banner vista global */}
      {vistaGlobal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#7C4DFF0C', border: '1px solid #7C4DFF25', borderRadius: 10, marginBottom: 20 }}>
          <Layers size={13} style={{ color: '#7C4DFF', flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: '#7C4DFF', fontWeight: 600 }}>Vista global activa — proyectos agrupados por código, sumando todos los años</p>
        </div>
      )}

      {activeRows.length === 0 && (
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
        {activeRows.map(p => {
          // En vista global usamos los valores pre-calculados _pres y _fact
          const fact     = vistaGlobal ? p._fact : facturacionId(p.id)
          const pres     = vistaGlobal ? p._pres : Number(p.presupuesto_base) + Number(p.ampliaciones || 0)
          const ejec     = pres > 0 ? fact / pres : 0
          const badge    = ESTADO_BADGE[p.estado] || ESTADO_BADGE.activo
          const deleting = confirmDelete === p.id
          const navId    = vistaGlobal ? p.latestId : p.id

          return (
            <div key={p.codigo_proyecto + (vistaGlobal ? '_g' : p.id)}
              onClick={() => navigate(`/proyectos/${navId}`)}
              style={{ background: 'var(--c-bg-surface)', border: `1px solid ${deleting ? '#EF444460' : vistaGlobal && p.multiYear ? '#7C4DFF30' : 'var(--c-border)'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
              onMouseEnter={e => { if (!deleting) { e.currentTarget.style.borderColor = vistaGlobal && p.multiYear ? '#7C4DFF80' : '#F59E0B80'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = vistaGlobal && p.multiYear ? '0 4px 16px rgba(124,77,255,0.12)' : '0 4px 16px rgba(245,158,11,0.1)' }}}
              onMouseLeave={e => { if (!deleting) { e.currentTarget.style.borderColor = vistaGlobal && p.multiYear ? '#7C4DFF30' : 'var(--c-border)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{p.codigo_proyecto}</span>
                  {vistaGlobal && p.multiYear && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#7C4DFF', background: '#7C4DFF15', padding: '1px 6px', borderRadius: 4 }}>MULTI</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {vistaGlobal ? (
                    <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: p.multiYear ? '#7C4DFF' : 'var(--c-text-3)', background: p.multiYear ? '#7C4DFF12' : 'var(--c-bg-muted)', padding: '2px 8px', borderRadius: 6 }}>{p.periodoLabel}</span>
                  ) : (
                    <>
                      <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                      <button onClick={e => handleDelete(e, p.id)} title={deleting ? 'Confirmar borrado' : 'Eliminar proyecto'}
                        style={{ background: deleting ? '#EF444420' : 'none', border: 'none', cursor: 'pointer', color: deleting ? '#EF4444' : 'var(--c-text-4)', padding: '3px 5px', borderRadius: 5, display: 'flex', alignItems: 'center', fontSize: 11, gap: 3, fontWeight: deleting ? 700 : 400 }}
                        onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#EF4444' }}
                        onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.color = deleting ? '#EF4444' : 'var(--c-text-4)' }}
                      >
                        <Trash2 size={12} /> {deleting && 'Confirmar'}
                      </button>
                    </>
                  )}
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
                <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Previsión anual</span>
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
