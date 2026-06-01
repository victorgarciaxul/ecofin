import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Edit2, Check, X, Trash2, RefreshCw } from 'lucide-react'

const MYTRACK_API = 'https://mytrack.xul.es/api/team-costs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { useData } from '../context/DataContext'
import { getProjects, getSummaryByProject, getUserGroups } from '../lib/clockify'

const MESES     = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
const MESES_SHORT = ['E','F','M','A','M','J','J','A','S','O','N','D']

const CATS = [
  { key: 'facturacion',     label: 'Facturación',     color: '#10B981' },
  { key: 'coste_personal',  label: 'Coste Personal',  color: '#7C4DFF' },
  { key: 'gastos_personal', label: 'Gastos Personal', color: '#6366F1' },
  { key: 'produccion',      label: 'Producción',      color: '#F59E0B' },
  { key: 'plan_medios',     label: 'Plan de Medios',  color: '#EF4444' },
]

const ESTADO_MAP = {
  activo:    { label: 'Activo',    bg: '#10B98118', color: '#10B981' },
  preparado: { label: 'Preparado', bg: '#F59E0B18', color: '#F59E0B' },
  cerrado:   { label: 'Cerrado',   bg: '#6B728018', color: '#6B7280' },
}

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtK(n) {
  if (!n || isNaN(n)) return '0'
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(Math.round(n))
}

export default function Proyecto() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { proyectos, getEntradasProyecto, updateProyecto, deleteProyecto, saveEntradas } = useData()

  const proyecto = proyectos.find(p => p.id === id)

  // Build grid from stored entradas
  const storedEntradas = getEntradasProyecto(id, proyecto?.anio)
  const initGrid = () => {
    const g = {}
    CATS.forEach(c => { for (let m = 1; m <= 12; m++) g[`${c.key}-${m}`] = 0 })
    storedEntradas.forEach(e => { g[`${e.categoria}-${e.mes}`] = Number(e.importe) })
    return g
  }

  const [grid, setGrid]           = useState(initGrid)
  const [dirty, setDirty]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editHeader, setEditHeader] = useState(false)
  const [headerForm, setHeaderForm] = useState(proyecto ? { ...proyecto } : {})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [chartView, setChartView]         = useState('mensual')
  const [syncingMytrack, setSyncingMytrack] = useState(false)
  const [syncMsg, setSyncMsg]               = useState('')   // "Sincronizado · X meses" | error

  async function syncFromMytrack() {
    setSyncingMytrack(true)
    setSyncMsg('')
    try {
      // Use codigo_proyecto as project filter; fall back to nombre_contrato
      const projectFilter = headerForm.codigo_proyecto || headerForm.nombre_contrato || ''
      const url = `${MYTRACK_API}?year=${proyecto.anio}&workspace=xul-ws-1`
        + (projectFilter ? `&project=${encodeURIComponent(projectFilter)}` : '')
      const res  = await fetch(url)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Error desconocido')

      const { costs } = data   // { "2026-01": 7445.50, ... }
      const updated = {}
      let count = 0
      for (let m = 1; m <= 12; m++) {
        const key  = `${proyecto.anio}-${String(m).padStart(2, '0')}`
        const cost = costs[key] ?? null
        if (cost !== null) {
          updated[`coste_personal-${m}`] = cost
          count++
        }
      }
      if (count === 0) {
        setSyncMsg('⚠️ Sin datos para este proyecto en MyTrack')
      } else {
        setGrid(g => ({ ...g, ...updated }))
        setDirty(true)
        setSyncMsg(`✓ Sincronizado · ${count} ${count === 1 ? 'mes' : 'meses'}`)
      }
    } catch (e) {
      setSyncMsg(`✗ Error: ${e.message}`)
    }
    setSyncingMytrack(false)
    setTimeout(() => setSyncMsg(''), 5000)
  }

  useEffect(() => {
    if (!proyecto) return
    const g = {}
    CATS.forEach(c => { for (let m = 1; m <= 12; m++) g[`${c.key}-${m}`] = 0 })
    getEntradasProyecto(id, proyecto.anio).forEach(e => { g[`${e.categoria}-${e.mes}`] = Number(e.importe) })
    setGrid(g)
    setDirty(false)
    setEditHeader(false)
    setHeaderForm({ ...proyecto })
    setConfirmDelete(false)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!proyecto) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <p style={{ color: 'var(--c-text-3)', marginBottom: 12 }}>Proyecto no encontrado</p>
      <button onClick={() => navigate('/proyectos')} style={{ padding: '8px 18px', borderRadius: 8, background: '#F59E0B', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Volver</button>
    </div>
  )

  function getVal(cat, mes) { return grid[`${cat}-${mes}`] || 0 }
  function setVal(cat, mes, raw) {
    const importe = parseFloat(String(raw).replace(',', '.')) || 0
    setGrid(g => ({ ...g, [`${cat}-${mes}`]: importe }))
    setDirty(true)
  }
  function rowTotal(cat) { return MESES.reduce((a, _, i) => a + getVal(cat, i + 1), 0) }

  const facturacion     = rowTotal('facturacion')
  const coste_personal  = rowTotal('coste_personal')
  const gastos_personal = rowTotal('gastos_personal')
  const produccion      = rowTotal('produccion')
  const plan_medios     = rowTotal('plan_medios')
  const beneficio       = facturacion - coste_personal - gastos_personal - produccion - plan_medios
  const presupuesto     = Number(headerForm.presupuesto_base || 0) + Number(headerForm.ampliaciones || 0)

  async function handleSave() {
    setSaving(true)
    await saveEntradas(id, proyecto.anio, grid)
    setSaving(false)
    setDirty(false)
  }

  async function handleSaveHeader() {
    const patch = {
      nombre_contrato:       headerForm.nombre_contrato,
      cliente:               headerForm.cliente,
      codigo_proyecto:       headerForm.codigo_proyecto,
      codigo_contrato:       headerForm.codigo_contrato || null,
      presupuesto_base:      Number(headerForm.presupuesto_base) || 0,
      ampliaciones:          Number(headerForm.ampliaciones) || 0,
      estado:                headerForm.estado,
      responsable_contrato:  headerForm.responsable_contrato || null,
      gestor_proyecto:       headerForm.gestor_proyecto || null,
    }
    await updateProyecto(id, patch)
    setEditHeader(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); return }
    await deleteProyecto(id)
    navigate('/proyectos')
  }

  // Chart data
  const chartData = useMemo(() => {
    let acFact = 0, acBen = 0
    return MESES.map((m, i) => {
      const mes  = i + 1
      const fact = getVal('facturacion', mes)
      const cp   = getVal('coste_personal', mes)
      const gp   = getVal('gastos_personal', mes)
      const prod = getVal('produccion', mes)
      const pm   = getVal('plan_medios', mes)
      const ben  = fact - cp - gp - prod - pm
      acFact += fact
      acBen  += ben
      return { mes: MESES_SHORT[i], facturacion: fact, coste: cp + gp, produccion: prod, plan_medios: pm, beneficio: ben, acFact, acBen }
    }).filter(d => d.facturacion > 0 || d.coste > 0 || d.produccion > 0 || d.plan_medios > 0)
  }, [grid])

  const badge = ESTADO_MAP[proyecto.estado] || ESTADO_MAP.activo

  const kpiCards = [
    { label: 'Previsión anual', value: fmt(presupuesto),    color: '#7C4DFF' },
    { label: 'Facturación',    value: fmt(facturacion),    sub: presupuesto ? `${((facturacion / presupuesto) * 100).toFixed(1)}% ejecutado` : null, color: '#10B981' },
    { label: 'Coste Personal', value: fmt(coste_personal), sub: facturacion ? `${((coste_personal / facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#7C4DFF' },
    { label: 'Producción',     value: fmt(produccion),     sub: facturacion ? `${((produccion / facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#F59E0B' },
    { label: 'Plan Medios',    value: fmt(plan_medios),    sub: facturacion ? `${((plan_medios / facturacion) * 100).toFixed(1)}% s/factura` : null, color: '#EF4444' },
    { label: 'Beneficio',      value: fmt(beneficio),      sub: facturacion ? `${((beneficio / facturacion) * 100).toFixed(1)}% ganancia` : null, color: beneficio >= 0 ? '#10B981' : '#EF4444' },
  ]

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Back */}
      <button onClick={() => navigate('/proyectos')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, padding: 0, marginBottom: 16 }}>
        <ArrowLeft size={14} /> Volver a proyectos
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        {!editHeader ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.3px' }}>{headerForm.nombre_contrato}</h1>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
              <button onClick={() => setEditHeader(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-4)', padding: 2 }}><Edit2 size={13} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--c-text-3)' }}>
              <span className="font-numeric" style={{ fontWeight: 700, color: '#F59E0B' }}>{headerForm.codigo_proyecto}</span>
              {headerForm.codigo_contrato && <span> · {headerForm.codigo_contrato}</span>}
              <span> · {headerForm.cliente} · {proyecto.anio}</span>
            </p>
            {(headerForm.responsable_contrato || headerForm.gestor_proyecto) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                {headerForm.responsable_contrato && (
                  <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--c-text-2)' }}>Responsable: </span>
                    {headerForm.responsable_contrato}
                  </span>
                )}
                {headerForm.gestor_proyecto && (
                  <span style={{ fontSize: 12, color: 'var(--c-text-3)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--c-text-2)' }}>Gestor: </span>
                    {headerForm.gestor_proyecto}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 20, flex: 1, maxWidth: 600 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-3)', marginBottom: 14 }}>Editar proyecto</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['Nombre contrato', 'nombre_contrato'], ['Cliente', 'cliente'], ['Código proyecto', 'codigo_proyecto'], ['Código contrato', 'codigo_contrato'], ['Responsable de contrato', 'responsable_contrato'], ['Gestor del proyecto', 'gestor_proyecto']].map(([label, key]) => (
                <label key={key} style={{ display: 'block' }}>
                  <span style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>{label}</span>
                  <input value={headerForm[key] || ''} onChange={e => setHeaderForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box' }} />
                </label>
              ))}
              <label>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>Previsión base (€)</span>
                <input type="number" value={headerForm.presupuesto_base || ''} onChange={e => setHeaderForm(f => ({ ...f, presupuesto_base: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif' }} />
              </label>
              <label>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 4 }}>Ampliaciones (€)</span>
                <input type="number" value={headerForm.ampliaciones || ''} onChange={e => setHeaderForm(f => ({ ...f, ampliaciones: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif' }} />
              </label>
              <div style={{ gridColumn: '1/-1' }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)', display: 'block', marginBottom: 6 }}>Estado</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['activo','Activo'],['preparado','Preparado'],['cerrado','Cerrado']].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setHeaderForm(f => ({ ...f, estado: v }))}
                      style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${headerForm.estado === v ? '#F59E0B' : 'var(--c-border)'}`, background: headerForm.estado === v ? '#F59E0B18' : 'transparent', color: headerForm.estado === v ? '#F59E0B' : 'var(--c-text-2)' }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={handleSaveHeader} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 7, background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><Check size={13} /> Guardar</button>
              <button onClick={() => { setHeaderForm({ ...proyecto }); setEditHeader(false) }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: 'pointer', fontSize: 13 }}><X size={13} /> Cancelar</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleDelete}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: confirmDelete ? '#EF444418' : 'var(--c-bg-muted)', color: confirmDelete ? '#EF4444' : 'var(--c-text-3)', border: `1.5px solid ${confirmDelete ? '#EF444450' : 'var(--c-border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
            <Trash2 size={14} /> {confirmDelete ? 'Confirmar' : 'Eliminar'}
          </button>
          <button onClick={handleSave} disabled={!dirty || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: dirty ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'var(--c-bg-muted)', color: dirty ? '#fff' : 'var(--c-text-4)', border: 'none', cursor: dirty ? 'pointer' : 'default', boxShadow: dirty ? '0 2px 10px rgba(245,158,11,0.35)' : 'none', transition: 'all 0.2s' }}>
            <Save size={15} /> {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 24 }}>
        {kpiCards.map(c => (
          <div key={c.label} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--c-text-3)', marginBottom: 5 }}>{c.label}</p>
            <p className="font-numeric" style={{ fontSize: 17, fontWeight: 700, color: c.color, letterSpacing: '-0.4px', marginBottom: c.sub ? 3 : 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)' }}>Evolución mensual</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['mensual','Mensual'],['acumulado','Acumulado']].map(([v, l]) => (
                <button key={v} onClick={() => setChartView(v)}
                  style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${chartView === v ? '#F59E0B' : 'var(--c-border)'}`, background: chartView === v ? '#F59E0B18' : 'transparent', color: chartView === v ? '#F59E0B' : 'var(--c-text-3)' }}>{l}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {chartView === 'mensual' ? (
              <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip formatter={(v, n) => [new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v), n]} labelStyle={{ fontWeight: 700, color: 'var(--c-text-1)' }} contentStyle={{ borderRadius: 10, border: '1px solid var(--c-border)', fontSize: 12, fontFamily: 'Space Grotesk' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="facturacion" name="Facturación" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="coste"       name="Coste Personal" fill="#7C4DFF" radius={[3, 3, 0, 0]} />
                <Bar dataKey="produccion"  name="Producción" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                <Bar dataKey="beneficio"   name="Beneficio" fill="#06B6D4" radius={[3, 3, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--c-text-3)', fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip formatter={(v, n) => [new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v), n]} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 10, border: '1px solid var(--c-border)', fontSize: 12, fontFamily: 'Space Grotesk' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="acFact" name="Facturación acum." fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="acBen"  name="Beneficio acum." fill="#06B6D4" radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Monthly grid */}
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)' }}>Datos mensuales · {proyecto.anio}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {syncMsg && (
              <span style={{ fontSize: 12, fontWeight: 600, color: syncMsg.startsWith('✓') ? '#10B981' : '#EF4444' }}>
                {syncMsg}
              </span>
            )}
            <button
              onClick={syncFromMytrack}
              disabled={syncingMytrack}
              title="Sincronizar Coste Personal desde MyTrack"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: syncingMytrack ? 'wait' : 'pointer',
                border: '1.5px solid #6366F133',
                background: '#6366F110', color: '#6366F1',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!syncingMytrack) { e.currentTarget.style.background = '#6366F120'; e.currentTarget.style.borderColor = '#6366F155' }}}
              onMouseLeave={e => { e.currentTarget.style.background = '#6366F110'; e.currentTarget.style.borderColor = '#6366F133' }}
            >
              <RefreshCw size={13} style={{ animation: syncingMytrack ? 'spin 0.8s linear infinite' : 'none' }} />
              {syncingMytrack ? 'Sincronizando…' : '↓ MyTrack'}
            </button>
            {dirty && <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>● Sin guardar</span>}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--c-bg-muted)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)', borderBottom: '2px solid var(--c-border)', minWidth: 130, position: 'sticky', left: 0, background: 'var(--c-bg-muted)', zIndex: 2 }}>Categoría</th>
                {MESES.map(m => <th key={m} style={{ padding: '9px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', borderBottom: '2px solid var(--c-border)', minWidth: 78 }}>{m}</th>)}
                <th style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-3)', borderBottom: '2px solid var(--c-border)', minWidth: 100, borderLeft: '1px solid var(--c-border)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {CATS.map((cat, ci) => {
                const total = rowTotal(cat.key)
                return (
                  <tr key={cat.key} style={{ borderBottom: '1px solid var(--c-border-light)', background: ci % 2 !== 0 ? 'var(--c-bg-muted)' : 'transparent' }}>
                    <td style={{ padding: '9px 14px', position: 'sticky', left: 0, background: ci % 2 !== 0 ? 'var(--c-bg-muted)' : 'var(--c-bg-surface)', zIndex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: 'var(--c-text-1)', fontSize: 12 }}>{cat.label}</span>
                      </div>
                    </td>
                    {MESES.map((_, mi) => {
                      const mes = mi + 1
                      const val = getVal(cat.key, mes)
                      return (
                        <td key={mes} style={{ padding: '5px 4px', textAlign: 'center' }}>
                          <CellInput value={val} color={cat.color} onChange={v => setVal(cat.key, mes, v)} />
                        </td>
                      )
                    })}
                    <td className="font-numeric" style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: total > 0 ? cat.color : 'var(--c-text-4)', borderLeft: '1px solid var(--c-border)' }}>
                      {total > 0 ? total.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--c-bg-muted)', borderTop: '2px solid var(--c-border)' }}>
                <td style={{ padding: '11px 14px', fontWeight: 700, fontSize: 12, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', left: 0, background: 'var(--c-bg-muted)' }}>Beneficio</td>
                {MESES.map((_, mi) => {
                  const mes = mi + 1
                  const b = getVal('facturacion', mes) - getVal('coste_personal', mes) - getVal('gastos_personal', mes) - getVal('produccion', mes) - getVal('plan_medios', mes)
                  return (
                    <td key={mes} className="font-numeric" style={{ padding: '11px 4px', textAlign: 'center', fontWeight: 700, fontSize: 12, color: b > 0 ? '#10B981' : b < 0 ? '#EF4444' : 'var(--c-text-4)' }}>
                      {b !== 0 ? b.toLocaleString('es-ES', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                  )
                })}
                <td className="font-numeric" style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: beneficio >= 0 ? '#10B981' : '#EF4444', borderLeft: '1px solid var(--c-border)' }}>
                  {beneficio.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Clockify group hours */}
      <ClockifyGroups codigoProyecto={proyecto.codigo_proyecto} nombreContrato={proyecto.nombre_contrato} anio={proyecto.anio} />

    </div>
  )
}

// ── Clockify helpers ──────────────────────────────────────────────────────────

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

function ClockifyGroups({ codigoProyecto, nombreContrato, anio }) {
  const [loading, setLoading]     = useState(true)
  const [groups, setGroups]       = useState([])
  const [totalSecs, setTotalSecs] = useState(0)
  const [matchedName, setMatchedName] = useState('')
  const [error, setError]         = useState(null)
  const [debug, setDebug]         = useState('')

  useEffect(() => {
    const wsId = localStorage.getItem('clockify_ws')
    if (!wsId) { setLoading(false); setDebug('No clockify_ws en localStorage'); return }
    fetchGroups(wsId)
  }, [codigoProyecto, nombreContrato, anio]) // eslint-disable-line

  async function fetchGroups(wsId) {
    setLoading(true); setError(null); setDebug('')
    try {
      const start = new Date(anio, 0, 1).toISOString()
      const end   = new Date(anio, 11, 31, 23, 59, 59, 999).toISOString()
      const [clockifyProjs, byProj, userGroupsData] = await Promise.all([
        getProjects(wsId),
        getSummaryByProject(wsId, start, end),
        getUserGroups(wsId).catch(() => []),
      ])

      // Auto-match: try codigo_proyecto first, then nombre_contrato, then partial/case-insensitive
      const code = (codigoProyecto || '').trim().toLowerCase()
      const name = (nombreContrato || '').trim().toLowerCase()
      let cProj = clockifyProjs.find(p => p.name.trim() === codigoProyecto?.trim())
               || clockifyProjs.find(p => p.name.trim() === nombreContrato?.trim())
               || clockifyProjs.find(p => p.name.trim().toLowerCase() === code)
               || clockifyProjs.find(p => p.name.trim().toLowerCase() === name)
               || clockifyProjs.find(p => code && p.name.toLowerCase().includes(code))
               || clockifyProjs.find(p => name && p.name.toLowerCase().includes(name))

      if (!cProj) {
        const projNames = clockifyProjs.map(p => p.name).slice(0, 10).join(', ')
        setDebug(`No match. Código: "${codigoProyecto}" · Nombre: "${nombreContrato}" · Clockify proyectos: [${projNames}…]`)
        setGroups([]); setLoading(false); return
      }
      setMatchedName(cProj.name)

      const groupMap = {}
      for (const g of (userGroupsData || []))
        for (const uid of (g.userIds || []))
          if (!groupMap[uid]) groupMap[uid] = g.name

      const projSummary = (byProj?.groupOne || []).find(p => p._id === cProj.id)
      if (!projSummary) {
        setDebug(`Proyecto "${cProj.name}" encontrado pero sin horas en ${anio}`)
        setGroups([]); setLoading(false); return
      }
      const acc = {}; let total = 0
      for (const user of (projSummary?.children || [])) {
        const grp = groupMap[user._id]
        if (!grp || grp.toLowerCase().includes('fundación')) continue
        acc[grp] = (acc[grp] || 0) + (user.duration || 0)
        total += user.duration || 0
      }
      if (total === 0) {
        setDebug(`Proyecto "${cProj.name}" tiene ${projSummary.children?.length || 0} usuarios pero ninguno está en un grupo`)
      }
      setGroups(Object.entries(acc).map(([gname, duration]) => ({ name: gname, duration, pct: total > 0 ? (duration / total) * 100 : 0 })).sort((a, b) => b.duration - a.duration))
      setTotalSecs(total)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '18px 24px', marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-1)' }}>Horas por grupo · {anio}</p>
          {matchedName && <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>Clockify: {matchedName}</p>}
        </div>
        {totalSecs > 0 && (
          <span className="font-numeric" style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>{fmtH(totalSecs)} totales</span>
        )}
      </div>

      {/* Debug temporal — quitar cuando funcione */}
      {debug && <p style={{ fontSize: 11, color: '#F59E0B', background: '#F59E0B15', padding: '8px 12px', borderRadius: 8, marginBottom: 10, wordBreak: 'break-all' }}>🔍 {debug}</p>}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--c-text-3)', padding: '8px 0' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12 }}>Cargando datos de Clockify…</span>
        </div>
      )}
      {error && <p style={{ fontSize: 12, color: '#EF4444' }}>Error: {error}</p>}

      {groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map(g => {
            const gc = grpColor(g.name)
            return (
              <div key={g.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: gc, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', flex: 1 }}>{g.name}</span>
                  <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: gc }}>{g.pct.toFixed(1)}%</span>
                  <span className="font-numeric" style={{ fontSize: 12, color: 'var(--c-text-3)', minWidth: 48, textAlign: 'right' }}>{fmtH(g.duration)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-border)', marginLeft: 18 }}>
                  <div style={{ width: `${g.pct}%`, height: '100%', borderRadius: 3, background: gc, opacity: 0.75, transition: 'width 0.5s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CellInput({ value, color, onChange }) {
  const [focused, setFocused] = useState(false)
  const [local, setLocal]     = useState('')

  return (
    <input
      type="text" inputMode="decimal"
      value={focused ? local : (value === 0 ? '' : value.toLocaleString('es-ES', { maximumFractionDigits: 0 }))}
      placeholder="—"
      onFocus={() => { setFocused(true); setLocal(value === 0 ? '' : String(value)) }}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { setFocused(false); onChange(local || '0') }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      style={{
        width: 72, padding: '5px 6px', textAlign: 'right', fontSize: 12,
        border: focused ? `1.5px solid ${color}` : '1.5px solid transparent',
        borderRadius: 6, background: focused ? `${color}12` : 'transparent',
        color: value > 0 ? 'var(--c-text-1)' : 'var(--c-text-4)',
        fontFamily: 'Space Grotesk, sans-serif', outline: 'none',
        transition: 'all 0.12s', cursor: 'text', boxSizing: 'border-box',
      }}
      onMouseEnter={e => { if (!focused) e.target.style.border = `1.5px solid ${color}50` }}
      onMouseLeave={e => { if (!focused) e.target.style.border = '1.5px solid transparent' }}
    />
  )
}
