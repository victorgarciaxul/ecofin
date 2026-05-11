import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronUp, ChevronDown, Plus, AlertCircle, Download, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useData } from '../context/DataContext'

const ESTADO_BADGE = {
  activo:    { label: 'Activo',    bg: '#10B98118', color: '#10B981' },
  preparado: { label: 'Preparado', bg: '#F59E0B18', color: '#F59E0B' },
  cerrado:   { label: 'Cerrado',   bg: '#6B728018', color: '#6B7280' },
}

// 2 decimales; muestra 0,00 € en lugar de —
function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// Ganancia: rojo <0, amarillo ≤29,5%, verde ≥29,6%
// Costes (invert): rojo >60%, amarillo >30%, verde ≤30%
function PctPill({ num, den, invert = false }) {
  if (!den || den === 0) return <span style={{ color: 'var(--c-text-4)', fontSize: 11 }}>—</span>
  const v = num / den
  let color
  if (invert) {
    color = v > 0.6 ? '#EF4444' : v > 0.3 ? '#F59E0B' : '#10B981'
  } else {
    color = v < 0 ? '#EF4444' : v >= 0.296 ? '#10B981' : '#F59E0B'
  }
  return <span className="font-numeric" style={{ fontSize: 11, fontWeight: 600, color }}>{(v * 100).toFixed(1)}%</span>
}

function BarEjec({ value }) {
  if (value == null || isNaN(value)) return <span style={{ color: 'var(--c-text-4)', fontSize: 11 }}>—</span>
  const pct = Math.min(1, Math.max(0, value))
  const color = pct < 0.3 ? '#F59E0B' : pct < 0.85 ? '#7C4DFF' : '#10B981'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <div style={{ width: 56, height: 5, borderRadius: 3, background: 'var(--c-border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span className="font-numeric" style={{ fontSize: 11, fontWeight: 600, color, minWidth: 38, textAlign: 'right' }}>
        {(pct * 100).toFixed(1)}%
      </span>
    </div>
  )
}

function fmtK(n) {
  if (!n || isNaN(n)) return '0'
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(Math.round(n))
}

function exportCSV(rows, anio) {
  const headers = ['Código','Contrato','Cliente','Estado','Presupuesto','Facturado','% Ejec.','Coste Personal','% CP','Gastos Personal','Producción','% Prod.','Plan Medios','% PM','Beneficio','% Beneficio']
  const pct = (num, den) => den ? ((num / den) * 100).toFixed(2) + '%' : '—'
  const lines = rows.map(p => [
    p.codigo_proyecto, `"${p.nombre_contrato}"`, `"${p.cliente}"`, p.estado,
    p.presupuesto.toFixed(2), p.facturacion.toFixed(2),
    pct(p.facturacion, p.presupuesto),
    p.coste_personal.toFixed(2), pct(p.coste_personal, p.facturacion),
    p.gastos_personal.toFixed(2),
    p.produccion.toFixed(2), pct(p.produccion, p.facturacion),
    p.plan_medios.toFixed(2), pct(p.plan_medios, p.facturacion),
    p.beneficio.toFixed(2), pct(p.beneficio, p.facturacion),
  ].join(';'))
  const csv = [headers.join(';'), ...lines].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ecofin_${anio}.csv`
  a.click()
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function Dashboard() {
  const { proyectos, entradas } = useData()
  const navigate = useNavigate()
  const [search, setSearch]             = useState('')
  const [anio, setAnio]                 = useState(CURRENT_YEAR)
  const [sort, setSort]                 = useState({ col: 'codigo_proyecto', dir: 'asc' })
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [showChart, setShowChart]       = useState(true)

  const proyAnio = proyectos.filter(p => p.anio === anio)

  function kpis(id) {
    const e = entradas.filter(x => x.proyecto_id === id)
    const sum = cat => e.filter(x => x.categoria === cat).reduce((a, b) => a + Number(b.importe), 0)
    const facturacion     = sum('facturacion')
    const coste_personal  = sum('coste_personal')
    const gastos_personal = sum('gastos_personal')
    const produccion      = sum('produccion')
    const plan_medios     = sum('plan_medios')
    const beneficio       = facturacion - coste_personal - gastos_personal - produccion - plan_medios
    return { facturacion, coste_personal, gastos_personal, produccion, plan_medios, beneficio }
  }

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return proyAnio
      .filter(p => {
        const matchQ = !q || p.nombre_contrato.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q) || p.codigo_proyecto.toLowerCase().includes(q)
        const matchE = estadoFilter === 'todos' || p.estado === estadoFilter
        return matchQ && matchE
      })
      .map(p => {
        const presupuesto = Number(p.presupuesto_base) + Number(p.ampliaciones || 0)
        const k = kpis(p.id)
        const ejec = presupuesto > 0 ? k.facturacion / presupuesto : 0
        const pct_gan = k.facturacion > 0 ? k.beneficio / k.facturacion : 0
        return { ...p, presupuesto, ...k, ejec, pct_gan }
      })
      .sort((a, b) => {
        const va = a[sort.col], vb = b[sort.col]
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : (Number(va) || 0) - (Number(vb) || 0)
        return sort.dir === 'asc' ? cmp : -cmp
      })
  }, [proyAnio, entradas, search, sort, estadoFilter]) // eslint-disable-line

  const totales = rows.reduce((acc, r) => ({
    presupuesto:     acc.presupuesto     + r.presupuesto,
    facturacion:     acc.facturacion     + r.facturacion,
    coste_personal:  acc.coste_personal  + r.coste_personal,
    gastos_personal: acc.gastos_personal + r.gastos_personal,
    produccion:      acc.produccion      + r.produccion,
    plan_medios:     acc.plan_medios     + r.plan_medios,
    beneficio:       acc.beneficio       + r.beneficio,
  }), { presupuesto: 0, facturacion: 0, coste_personal: 0, gastos_personal: 0, produccion: 0, plan_medios: 0, beneficio: 0 })

  function toggleSort(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  const TH = ({ label, col, align = 'right', minW = 90 }) => (
    <th onClick={col ? () => toggleSort(col) : undefined} style={{
      padding: '10px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--c-text-3)', textAlign: align,
      borderBottom: '2px solid var(--c-border)', whiteSpace: 'nowrap',
      cursor: col ? 'pointer' : 'default', userSelect: 'none', minWidth: minW,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {label}
        {col && (sort.col === col
          ? (sort.dir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
          : <ChevronUp size={10} style={{ opacity: 0.25 }} />)}
      </span>
    </th>
  )

  const kpiCards = [
    { label: 'Presupuesto total', value: fmt(totales.presupuesto),    color: '#7C4DFF' },
    { label: 'Facturación',       value: fmt(totales.facturacion),    sub: totales.presupuesto ? `${((totales.facturacion / totales.presupuesto) * 100).toFixed(1)}% ejecutado` : null, color: '#10B981' },
    { label: 'Coste personal',    value: fmt(totales.coste_personal), sub: totales.facturacion ? `${((totales.coste_personal / totales.facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#6366F1' },
    { label: 'Plan de medios',    value: fmt(totales.plan_medios),    color: '#EF4444' },
    { label: 'Beneficio',         value: fmt(totales.beneficio),      sub: totales.facturacion ? `${((totales.beneficio / totales.facturacion) * 100).toFixed(1)}% ganancia` : null, color: totales.beneficio >= 0 ? '#10B981' : '#EF4444' },
  ]

  const chartRows = [...rows].filter(r => r.facturacion > 0).sort((a, b) => b.facturacion - a.facturacion).slice(0, 15)

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.4px' }}>Dashboard · {anio}</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>{rows.length} de {proyAnio.length} proyecto{proyAnio.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', cursor: 'pointer' }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => setShowChart(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: showChart ? '#F59E0B18' : 'var(--c-bg-surface)', color: showChart ? '#F59E0B' : 'var(--c-text-2)', border: `1.5px solid ${showChart ? '#F59E0B50' : 'var(--c-border)'}`, cursor: 'pointer' }}>
            <BarChart2 size={14} /> Gráfico
          </button>
          <button onClick={() => exportCSV(rows, anio)} title="Exportar CSV" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--c-bg-surface)', color: 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: 'pointer' }}>
            <Download size={14} /> CSV
          </button>
          <button onClick={() => navigate('/proyectos/nuevo')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
            <Plus size={14} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {kpiCards.map(c => (
          <div key={c.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)', marginBottom: 6 }}>{c.label}</p>
            <p className="font-numeric" style={{ fontSize: 20, fontWeight: 700, color: c.color, letterSpacing: '-0.5px', marginBottom: c.sub ? 4 : 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Overview chart */}
      {showChart && chartRows.length > 0 && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)', marginBottom: 4 }}>Rentabilidad por proyecto</p>
          <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 16 }}>Facturación y beneficio · {anio}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartRows.map(r => ({ name: r.codigo_proyecto, facturacion: r.facturacion, beneficio: r.beneficio }))}
              barCategoryGap="25%" barGap={4}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
              <Tooltip
                formatter={(v, name) => [
                  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
                  name,
                ]}
                labelStyle={{ fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 4 }}
                contentStyle={{ borderRadius: 10, border: '1px solid var(--c-border)', fontSize: 12, fontFamily: 'Space Grotesk', background: 'var(--c-bg-surface)' }}
              />
              <ReferenceLine y={0} stroke="var(--c-border)" />
              <Bar dataKey="facturacion" name="Facturación" fill="#10B981" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar dataKey="beneficio"   name="Beneficio"   radius={[3,3,0,0]} maxBarSize={28}>
                {chartRows.map((r, i) => <Cell key={i} fill={r.beneficio >= 0 ? '#06B6D4' : '#EF4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyecto, cliente…"
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {['todos', 'activo', 'preparado', 'cerrado'].map(e => (
          <button key={e} onClick={() => setEstadoFilter(e)} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            background: estadoFilter === e ? '#F59E0B' : 'var(--c-bg-surface)',
            color: estadoFilter === e ? '#fff' : 'var(--c-text-3)',
            border: `1.5px solid ${estadoFilter === e ? '#F59E0B' : 'var(--c-border)'}`,
            boxShadow: estadoFilter === e ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
          }}>
            {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <AlertCircle size={30} style={{ color: 'var(--c-text-4)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text-3)' }}>No hay proyectos para este filtro</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--c-bg-muted)' }}>
                  <TH label="ID"          col="codigo_proyecto" align="left" minW={90} />
                  <TH label="Contrato"    col="nombre_contrato" align="left" minW={180} />
                  <TH label="Cliente"     col="cliente"         align="left" minW={130} />
                  <TH label="Estado"      col={null}            align="center" minW={90} />
                  <TH label="Presupuesto" col="presupuesto"     minW={120} />
                  <TH label="Facturado"   col="facturacion"     minW={120} />
                  <TH label="% Ejec."     col="ejec"            minW={110} />
                  <TH label="Coste Pers." col="coste_personal"  minW={120} />
                  <TH label="% CP"        col={null}            minW={70} />
                  <TH label="Producción"  col="produccion"      minW={120} />
                  <TH label="% Prod."     col={null}            minW={70} />
                  <TH label="P. Medios"   col="plan_medios"     minW={120} />
                  <TH label="% PM"        col={null}            minW={70} />
                  <TH label="Beneficio"   col="beneficio"       minW={120} />
                  <TH label="% Gan."      col="pct_gan"         minW={70} />
                </tr>
              </thead>
              <tbody>
                {rows.map((p, i) => {
                  const badge = ESTADO_BADGE[p.estado] || ESTADO_BADGE.activo
                  return (
                    <tr key={p.id} onClick={() => navigate(`/proyectos/${p.id}`)}
                      style={{ borderBottom: '1px solid var(--c-border-light)', cursor: 'pointer', background: i % 2 !== 0 ? 'var(--c-bg-muted)' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F59E0B08'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 !== 0 ? 'var(--c-bg-muted)' : 'transparent'}
                    >
                      <td style={{ padding: '11px 12px' }}><span className="font-numeric" style={{ fontWeight: 700, color: '#F59E0B', fontSize: 12 }}>{p.codigo_proyecto}</span></td>
                      <td style={{ padding: '11px 12px', fontWeight: 500, color: 'var(--c-text-1)', maxWidth: 220 }}><span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.nombre_contrato}</span></td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{p.cliente}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'center' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 500 }}>{fmt(p.presupuesto)}</td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 500 }}>{fmt(p.facturacion)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><BarEjec value={p.ejec} /></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.coste_personal)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctPill num={p.coste_personal} den={p.facturacion} invert /></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.produccion)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctPill num={p.produccion} den={p.facturacion} invert /></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', color: 'var(--c-text-2)' }}>{fmt(p.plan_medios)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctPill num={p.plan_medios} den={p.facturacion} invert /></td>
                      <td className="font-numeric" style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: p.beneficio < 0 ? '#EF4444' : '#10B981' }}>{fmt(p.beneficio)}</td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }}><PctPill num={p.beneficio} den={p.facturacion} /></td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--c-bg-muted)', borderTop: '2px solid var(--c-border)' }}>
                  <td colSpan={4} style={{ padding: '12px 12px', fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TOTALES · {rows.length} proyectos</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#7C4DFF' }}>{fmt(totales.presupuesto)}</td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmt(totales.facturacion)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctPill num={totales.facturacion} den={totales.presupuesto} /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(totales.coste_personal)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctPill num={totales.coste_personal} den={totales.facturacion} invert /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(totales.produccion)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctPill num={totales.produccion} den={totales.facturacion} invert /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(totales.plan_medios)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctPill num={totales.plan_medios} den={totales.facturacion} invert /></td>
                  <td className="font-numeric" style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: totales.beneficio >= 0 ? '#10B981' : '#EF4444' }}>{fmt(totales.beneficio)}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }}><PctPill num={totales.beneficio} den={totales.facturacion} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
