import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronUp, ChevronDown, Plus, AlertCircle, Download, BarChart2, Layers } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useData } from '../context/DataContext'
import { getProjects, getSummaryByProject, getUserGroups } from '../lib/clockify'

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

function fmtH(seconds) {
  if (!seconds) return '0h'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function grpColor(name = '') {
  const n = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return `hsl(${(n * 83 + 41) % 360}, 52%, 54%)`
}

function fmtK(n) {
  if (!n || isNaN(n)) return '0'
  if (Math.abs(n) >= 100000) return `${(n / 1000).toFixed(0)}k`
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function exportCSV(rows, anio) {
  const headers = ['Código','Contrato','Cliente','Responsable','Gestor','Estado','Previsión anual','Facturado','% Ejec.','Coste Personal','% CP','Gastos Personal','Producción','% Prod.','Plan Medios','% PM','Beneficio','% Beneficio']
  const pct = (num, den) => den ? ((num / den) * 100).toFixed(2) + '%' : '—'
  const lines = rows.map(p => [
    p.codigo_proyecto, `"${p.nombre_contrato}"`, `"${p.cliente}"`,
    `"${p.responsable_contrato || ''}"`, `"${p.gestor_proyecto || ''}"`, p.estado,
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
  const [estadoFilter, setEstadoFilter]         = useState(new Set()) // vacío = todos
  const [responsableFilter, setResponsableFilter] = useState('')
  const [gestorFilter, setGestorFilter]           = useState('')
  const [showChart, setShowChart]                 = useState(true)
  const [vistaGlobal, setVistaGlobal]             = useState(false)
  const [clockifyGroups, setClockifyGroups]       = useState([])

  // Fetch Clockify groups totals
  useEffect(() => {
    const wsId = localStorage.getItem('clockify_ws')
    if (!wsId) return
    ;(async () => {
      try {
        const start = new Date(anio, 0, 1).toISOString()
        const end   = new Date(anio, 11, 31, 23, 59, 59, 999).toISOString()
        const [clockifyProjs, byProj, userGroupsData] = await Promise.all([
          getProjects(wsId),
          getSummaryByProject(wsId, start, end),
          getUserGroups(wsId).catch(() => []),
        ])
        const userGroupMap = {}
        for (const g of (userGroupsData || []))
          for (const uid of (g.userIds || []))
            if (!userGroupMap[uid]) userGroupMap[uid] = g.name

        // Only count EcoFin projects + Estructura XUL + Producción y eventos
        const ecofinCodes = new Set(proyectos.map(p => p.codigo_proyecto))
        const extraNames = ['estructura xul', 'producción y eventos']
        const clockifyNameMap = {}
        for (const cp of clockifyProjs) clockifyNameMap[cp.id] = cp.name

        // Debug: log matching
        const allProjNames = (byProj?.groupOne || []).map(p => clockifyNameMap[p._id] || p.name || p._id)
        const matched = allProjNames.filter(n => ecofinCodes.has(n) || extraNames.includes(n.toLowerCase()))
        const skipped = allProjNames.filter(n => !ecofinCodes.has(n) && !extraNames.includes(n.toLowerCase()))
        console.log('[EcoFin Groups] EcoFin codes:', [...ecofinCodes].join(' | '))
        console.log('[EcoFin Groups] Clockify projects:', allProjNames.join(' | '))
        console.log('[EcoFin Groups] Matched:', matched.join(' | '))
        console.log('[EcoFin Groups] Skipped:', skipped.join(' | '))

        const acc = {}; let total = 0
        for (const proj of (byProj?.groupOne || [])) {
          const projName = clockifyNameMap[proj._id] || ''
          const isEcofin = ecofinCodes.has(projName)
          const isExtra  = extraNames.includes(projName.toLowerCase())
          if (!isEcofin && !isExtra) continue
          for (const user of (proj.children || [])) {
            const grp = userGroupMap[user._id]
            if (!grp || grp.toLowerCase().includes('fundación')) continue
            acc[grp] = (acc[grp] || 0) + (user.duration || 0)
            total += user.duration || 0
          }
        }
        const groups = Object.entries(acc)
          .map(([name, duration]) => ({ name, duration, pct: total > 0 ? (duration / total) * 100 : 0 }))
          .sort((a, b) => b.duration - a.duration)
        setClockifyGroups(groups)
      } catch (e) { console.warn('Clockify groups error:', e) }
    })()
  }, [anio, proyectos])

  const proyAnio = proyectos.filter(p => p.anio === anio)

  // Dedup case-insensitive + trim para evitar duplicados por acentos/espacios
  const responsables = useMemo(() => {
    const seen = new Set()
    return (vistaGlobal ? proyectos : proyAnio)
      .map(p => p.responsable_contrato?.trim()).filter(Boolean)
      .filter(r => { const k = r.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true) })
      .sort()
  }, [vistaGlobal, proyectos, proyAnio]) // eslint-disable-line
  const gestores = useMemo(() => {
    const seen = new Set()
    return (vistaGlobal ? proyectos : proyAnio)
      .map(p => p.gestor_proyecto?.trim()).filter(Boolean)
      .filter(r => { const k = r.toLowerCase(); return seen.has(k) ? false : (seen.add(k), true) })
      .sort()
  }, [vistaGlobal, proyectos, proyAnio]) // eslint-disable-line

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

  function kpisForIds(ids) {
    const e = entradas.filter(x => ids.includes(x.proyecto_id))
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
        const matchE = estadoFilter.size === 0 || estadoFilter.has(p.estado)
        const matchR = !responsableFilter || p.responsable_contrato?.trim().toLowerCase() === responsableFilter.toLowerCase()
        const matchG = !gestorFilter      || p.gestor_proyecto?.trim().toLowerCase()      === gestorFilter.toLowerCase()
        return matchQ && matchE && matchR && matchG
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
  }, [proyAnio, entradas, search, sort, estadoFilter, responsableFilter, gestorFilter]) // eslint-disable-line

  // ── Vista global: agrupa todos los años por código de proyecto ────────────────
  const rowsGlobal = useMemo(() => {
    const q = search.toLowerCase()
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
        const presupuesto = all.reduce((s, p) => s + Number(p.presupuesto_base || 0) + Number(p.ampliaciones || 0), 0)
        const k       = kpisForIds(ids)
        const ejec    = presupuesto > 0 ? k.facturacion / presupuesto : 0
        const pct_gan = k.facturacion > 0 ? k.beneficio / k.facturacion : 0
        const anios   = [...new Set(all.map(p => p.anio))].sort()
        const periodoLabel = anios.length > 1 ? `${anios[0]}–${anios[anios.length - 1]}` : String(anios[0])
        return { ...latest, presupuesto, ...k, ejec, pct_gan, periodoLabel, multiYear: anios.length > 1, latestId: latest.id }
      })
      .filter(p => {
        const matchQ = !q || p.nombre_contrato.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q) || p.codigo_proyecto.toLowerCase().includes(q)
        const matchE = estadoFilter.size === 0 || estadoFilter.has(p.estado)
        const matchR = !responsableFilter || p.responsable_contrato?.trim().toLowerCase() === responsableFilter.toLowerCase()
        const matchG = !gestorFilter      || p.gestor_proyecto?.trim().toLowerCase()      === gestorFilter.toLowerCase()
        return matchQ && matchE && matchR && matchG
      })
      .sort((a, b) => {
        const va = a[sort.col], vb = b[sort.col]
        const cmp = typeof va === 'string' ? (va || '').localeCompare(vb || '') : (Number(va) || 0) - (Number(vb) || 0)
        return sort.dir === 'asc' ? cmp : -cmp
      })
  }, [proyectos, entradas, search, sort, estadoFilter, responsableFilter, gestorFilter]) // eslint-disable-line

  const activeRows = vistaGlobal ? rowsGlobal : rows

  const totales = activeRows.reduce((acc, r) => ({
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
    { label: 'Previsión anual',   value: fmt(totales.presupuesto),    color: '#7C4DFF' },
    { label: 'Facturación',       value: fmt(totales.facturacion),    sub: totales.presupuesto ? `${((totales.facturacion / totales.presupuesto) * 100).toFixed(1)}% ejecutado` : null, color: '#10B981' },
    { label: 'Coste personal',    value: fmt(totales.coste_personal), sub: totales.facturacion ? `${((totales.coste_personal / totales.facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#6366F1' },
    { label: 'Producción',        value: fmt(totales.produccion),     sub: totales.facturacion ? `${((totales.produccion    / totales.facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#F59E0B' },
    { label: 'Beneficio',         value: fmt(totales.beneficio),      sub: totales.facturacion ? `${((totales.beneficio     / totales.facturacion) * 100).toFixed(1)}% ganancia`  : null, color: totales.beneficio >= 0 ? '#10B981' : '#EF4444' },
  ]

  const subPills = [
    { label: 'Plan de Medios',     value: totales.plan_medios,     color: '#EF4444',  real: true  },
    { label: 'Gastos Personal',    value: totales.gastos_personal, color: '#8B5CF6',  real: true  },
    { label: 'Campañas Digitales', value: null,                    color: '#06B6D4',  real: false },
    { label: 'Audiovisual',        value: null,                    color: '#F97316',  real: false },
  ]

  const chartRows = [...activeRows].sort((a, b) => b.facturacion - a.facturacion)

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.4px' }}>Dashboard · {anio}</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>{rows.length} de {proyAnio.length} proyecto{proyAnio.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setVistaGlobal(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: vistaGlobal ? '#7C4DFF18' : 'var(--c-bg-surface)', color: vistaGlobal ? '#7C4DFF' : 'var(--c-text-2)', border: `1.5px solid ${vistaGlobal ? '#7C4DFF50' : 'var(--c-border)'}`, cursor: 'pointer', boxShadow: vistaGlobal ? '0 2px 8px rgba(124,77,255,0.2)' : 'none' }}>
            <Layers size={14} /> Vista global
          </button>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} disabled={vistaGlobal}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--c-border)', background: vistaGlobal ? 'var(--c-bg-muted)' : 'var(--c-bg-surface)', color: vistaGlobal ? 'var(--c-text-4)' : 'var(--c-text-1)', cursor: vistaGlobal ? 'default' : 'pointer', opacity: vistaGlobal ? 0.5 : 1 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 12 }}>
        {kpiCards.map(c => (
          <div key={c.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-3)', marginBottom: 6 }}>{c.label}</p>
            <p className="font-numeric" style={{ fontSize: 20, fontWeight: 700, color: c.color, letterSpacing: '-0.5px', marginBottom: c.sub ? 4 : 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Sub-pills desglose producción */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', marginRight: 2 }}>Desglose</span>
        {subPills.map(p => {
          const pct = p.real && totales.facturacion ? ((p.value / totales.facturacion) * 100).toFixed(1) : null
          return (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--c-bg-surface)', border: `1px solid ${p.real ? 'var(--c-border)' : 'var(--c-border-light)'}`, borderRadius: 20, padding: '4px 12px', opacity: p.real ? 1 : 0.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--c-text-3)', fontWeight: 500 }}>{p.label}</span>
              {p.real
                ? <>
                    <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: p.color }}>{fmt(p.value)}</span>
                    {pct && <span className="font-numeric" style={{ fontSize: 10, fontWeight: 600, color: p.color, opacity: 0.7 }}>({pct}%)</span>}
                  </>
                : <span style={{ fontSize: 10, color: 'var(--c-text-4)', fontStyle: 'italic' }}>próximamente</span>
              }
            </div>
          )
        })}
      </div>

      {/* Clockify group pills */}
      {clockifyGroups.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', marginRight: 2 }}>Grupos</span>
          {clockifyGroups.map(g => {
            const gc = grpColor(g.name)
            return (
              <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--c-bg-surface)', border: `1px solid var(--c-border)`, borderRadius: 20, padding: '4px 12px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: gc, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'var(--c-text-3)', fontWeight: 500 }}>{g.name}</span>
                <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: gc }}>{fmtH(g.duration)}</span>
                <span className="font-numeric" style={{ fontSize: 10, fontWeight: 600, color: gc, opacity: 0.7 }}>({g.pct.toFixed(1)}%)</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Overview chart — horizontal bars, two columns */}
      {showChart && chartRows.length > 0 && (() => {
        const chartDataAll = chartRows.map(r => ({
          name: r.nombre_contrato.length > 22 ? r.nombre_contrato.slice(0, 20) + '…' : r.nombre_contrato,
          fullName: r.nombre_contrato,
          facturacion: r.facturacion,
          beneficio: r.beneficio,
        }))
        const mid = Math.ceil(chartDataAll.length / 2)
        const col1 = chartDataAll.slice(0, mid)
        const col2 = chartDataAll.slice(mid)
        const rowH = 36
        const chartH = (h) => Math.max(180, h.length * rowH + 40)

        const renderChart = (data) => (
          <ResponsiveContainer width="100%" height={chartH(data)}>
            <BarChart
              data={data} layout="vertical"
              barCategoryGap="20%" barGap={2}
              margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" horizontal={false} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10, fill: 'var(--c-text-2)', fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
              <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
              <Tooltip
                formatter={(v, label) => [
                  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
                  label,
                ]}
                labelFormatter={(label) => { const d = data.find(x => x.name === label); return d?.fullName || label }}
                labelStyle={{ fontWeight: 700, color: '#fff', marginBottom: 4 }}
                itemStyle={{ color: '#fff' }}
                contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12, fontFamily: 'Poppins, sans-serif', background: '#3B82F6', color: '#fff', boxShadow: '0 4px 16px rgba(59,130,246,0.35)' }}
              />
              <ReferenceLine x={0} stroke="var(--c-border)" />
              <Bar dataKey="facturacion" name="Facturación" fill="#10B981" radius={[0,3,3,0]} maxBarSize={16} />
              <Bar dataKey="beneficio" name="Beneficio" radius={[0,3,3,0]} maxBarSize={16}>
                {data.map((r, i) => <Cell key={i} fill={r.beneficio >= 0 ? '#06B6D4' : '#EF4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )

        return (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)' }}>Rentabilidad por proyecto</p>
              <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Facturación y beneficio · {chartRows.length} proyectos · {vistaGlobal ? 'global' : anio}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: col2.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>
              <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '16px 12px' }}>
                {renderChart(col1)}
              </div>
              {col2.length > 0 && (
                <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '16px 12px' }}>
                  {renderChart(col2)}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 260px' }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--c-text-4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proyecto, cliente…"
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {responsables.length > 0 && (
          <select value={responsableFilter} onChange={e => setResponsableFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${responsableFilter ? '#7C4DFF' : 'var(--c-border)'}`, background: responsableFilter ? '#7C4DFF12' : 'var(--c-bg-surface)', color: responsableFilter ? '#7C4DFF' : 'var(--c-text-3)', cursor: 'pointer', outline: 'none' }}>
            <option value="">Responsable</option>
            {responsables.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {gestores.length > 0 && (
          <select value={gestorFilter} onChange={e => setGestorFilter(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${gestorFilter ? '#06B6D4' : 'var(--c-border)'}`, background: gestorFilter ? '#06B6D412' : 'var(--c-bg-surface)', color: gestorFilter ? '#06B6D4' : 'var(--c-text-3)', cursor: 'pointer', outline: 'none' }}>
            <option value="">Gestor</option>
            {gestores.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {(responsableFilter || gestorFilter) && (
          <button onClick={() => { setResponsableFilter(''); setGestorFilter('') }}
            style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'none', border: '1.5px solid var(--c-border)', color: 'var(--c-text-4)', cursor: 'pointer' }}>
            Limpiar ×
          </button>
        )}
        <button onClick={() => setEstadoFilter(new Set())} style={{
          padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
          background: estadoFilter.size === 0 ? '#F59E0B' : 'var(--c-bg-surface)',
          color: estadoFilter.size === 0 ? '#fff' : 'var(--c-text-3)',
          border: `1.5px solid ${estadoFilter.size === 0 ? '#F59E0B' : 'var(--c-border)'}`,
          boxShadow: estadoFilter.size === 0 ? '0 2px 8px rgba(245,158,11,0.3)' : 'none',
        }}>Todos</button>
        {['activo', 'preparado', 'cerrado'].map(e => {
          const active = estadoFilter.has(e)
          const { color } = ESTADO_BADGE[e]
          return (
            <button key={e} onClick={() => setEstadoFilter(prev => {
              const next = new Set(prev)
              next.has(e) ? next.delete(e) : next.add(e)
              return next
            })} style={{
              padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              background: active ? color + '22' : 'var(--c-bg-surface)',
              color: active ? color : 'var(--c-text-3)',
              border: `1.5px solid ${active ? color : 'var(--c-border)'}`,
              boxShadow: active ? `0 2px 8px ${color}44` : 'none',
            }}>
              {e.charAt(0).toUpperCase() + e.slice(1)}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--c-bg-surface)', border: `1px solid ${vistaGlobal ? '#7C4DFF40' : 'var(--c-border)'}`, borderRadius: 14, overflow: 'hidden' }}>
        {vistaGlobal && (
          <div style={{ padding: '10px 16px', background: '#7C4DFF0C', borderBottom: '1px solid #7C4DFF20', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={13} style={{ color: '#7C4DFF' }} />
            <p style={{ fontSize: 12, color: '#7C4DFF', fontWeight: 600 }}>Vista global activa — proyectos agrupados por código, sumando todos los años</p>
          </div>
        )}
        {activeRows.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center' }}>
            <AlertCircle size={30} style={{ color: 'var(--c-text-4)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text-3)' }}>No hay proyectos para este filtro</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--c-bg-muted)' }}>
                  <TH label="ID"           col="codigo_proyecto"      align="left" minW={90} />
                  {vistaGlobal && <TH label="Período" col={null} align="left" minW={90} />}
                  <TH label="Contrato"     col="nombre_contrato"      align="left" minW={180} />
                  <TH label="Cliente"      col="cliente"              align="left" minW={130} />
                  <TH label="Responsable"  col="responsable_contrato" align="left" minW={120} />
                  <TH label="Gestor"       col="gestor_proyecto"      align="left" minW={120} />
                  <TH label="Estado"       col={null}                 align="center" minW={90} />
                  <TH label="Previsión"   col="presupuesto"     minW={120} />
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
                {activeRows.map((p, i) => {
                  const badge = ESTADO_BADGE[p.estado] || ESTADO_BADGE.activo
                  return (
                    <tr key={p.id} onClick={() => navigate(`/proyectos/${p.latestId || p.id}`)}
                      style={{ borderBottom: '1px solid var(--c-border-light)', cursor: 'pointer', background: i % 2 !== 0 ? 'var(--c-bg-muted)' : 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = vistaGlobal ? '#7C4DFF08' : '#F59E0B08'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 !== 0 ? 'var(--c-bg-muted)' : 'transparent'}
                    >
                      <td style={{ padding: '11px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span className="font-numeric" style={{ fontWeight: 700, color: '#F59E0B', fontSize: 12 }}>{p.codigo_proyecto}</span>
                          {vistaGlobal && p.multiYear && <span style={{ fontSize: 9, fontWeight: 700, color: '#7C4DFF', background: '#7C4DFF15', padding: '1px 5px', borderRadius: 4 }}>MULTI</span>}
                        </div>
                      </td>
                      {vistaGlobal && (
                        <td style={{ padding: '11px 12px' }}>
                          <span className="font-numeric" style={{ fontSize: 12, fontWeight: 600, color: p.multiYear ? '#7C4DFF' : 'var(--c-text-3)', background: p.multiYear ? '#7C4DFF12' : 'transparent', padding: p.multiYear ? '2px 7px' : '0', borderRadius: 6 }}>{p.periodoLabel}</span>
                        </td>
                      )}
                      <td style={{ padding: '11px 12px', fontWeight: 500, color: 'var(--c-text-1)', maxWidth: 220 }}><span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.nombre_contrato}</span></td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{p.cliente}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{p.responsable_contrato || <span style={{ color: 'var(--c-text-4)' }}>—</span>}</td>
                      <td style={{ padding: '11px 12px', color: 'var(--c-text-2)', whiteSpace: 'nowrap', fontSize: 12 }}>{p.gestor_proyecto || <span style={{ color: 'var(--c-text-4)' }}>—</span>}</td>
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
                  <td colSpan={vistaGlobal ? 7 : 6} style={{ padding: '12px 12px', fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TOTALES · {activeRows.length} proyecto{activeRows.length !== 1 ? 's' : ''}{vistaGlobal ? ' (vista global)' : ''}</td>
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
