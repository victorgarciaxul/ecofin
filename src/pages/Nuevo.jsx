import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { useData } from '../context/DataContext'

const CURRENT_YEAR = new Date().getFullYear()

export default function Nuevo() {
  const navigate = useNavigate()
  const { addProyecto } = useData()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    codigo_proyecto: '', codigo_contrato: '', nombre_contrato: '',
    cliente: '', responsable_contrato: '', gestor_proyecto: '',
    anio: CURRENT_YEAR, presupuesto_base: '', ampliaciones: '', estado: 'activo',
  })
  const [errors, setErrors] = useState({})

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: null })) }

  function validate() {
    const e = {}
    if (!form.codigo_proyecto.trim()) e.codigo_proyecto = 'Obligatorio'
    if (!form.nombre_contrato.trim()) e.nombre_contrato = 'Obligatorio'
    if (!form.cliente.trim()) e.cliente = 'Obligatorio'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const { data } = await addProyecto({
      codigo_proyecto: form.codigo_proyecto.trim(),
      codigo_contrato: form.codigo_contrato.trim() || null,
      nombre_contrato:      form.nombre_contrato.trim(),
      cliente:              form.cliente.trim(),
      responsable_contrato: form.responsable_contrato.trim() || null,
      gestor_proyecto:      form.gestor_proyecto.trim() || null,
      anio: Number(form.anio),
      presupuesto_base: Number(form.presupuesto_base) || 0,
      ampliaciones: Number(form.ampliaciones) || 0,
      estado: form.estado,
    })
    setSaving(false)
    if (data) navigate(`/proyectos/${data.id}`)
    else navigate('/proyectos')
  }

  const inp = (label, key, type = 'text', placeholder = '', required = false) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      <input type={type} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: `1.5px solid ${errors[key] ? '#EF4444' : 'var(--c-border)'}`, background: 'var(--c-input-bg)', color: 'var(--c-text-1)', outline: 'none', boxSizing: 'border-box', fontFamily: type === 'number' ? 'Space Grotesk, sans-serif' : 'inherit' }}
        onFocus={e => { if (!errors[key]) e.target.style.borderColor = '#F59E0B' }}
        onBlur={e => { if (!errors[key]) e.target.style.borderColor = 'var(--c-border)' }}
      />
      {errors[key] && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>{errors[key]}</p>}
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680, margin: '0 auto' }}>
      <button onClick={() => navigate('/proyectos')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', fontSize: 13, padding: 0, marginBottom: 20 }}>
        <ArrowLeft size={14} /> Volver
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 6, letterSpacing: '-0.3px' }}>Nuevo proyecto</h1>
      <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginBottom: 28 }}>Registra los datos del contrato para iniciar el seguimiento económico</p>

      <form onSubmit={submit}>
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)' }}>Identificación</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {inp('Código proyecto', 'codigo_proyecto', 'text', '2026-020', true)}
            {inp('Código contrato', 'codigo_contrato', 'text', 'XUL-CONTR-020')}
          </div>
          {inp('Nombre del contrato', 'nombre_contrato', 'text', 'Ej: Agencia Digital de Andalucía', true)}
          {inp('Cliente / Entidad', 'cliente', 'text', 'Ej: Junta de Andalucía, SANDETEL…', true)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {inp('Responsable de contrato', 'responsable_contrato', 'text', 'Nombre del responsable')}
            {inp('Gestor del proyecto', 'gestor_proyecto', 'text', 'Nombre del gestor')}
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', marginBottom: 14 }}>Previsión anual</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 6 }}>Año</label>
                <select value={form.anio} onChange={e => set('anio', Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', cursor: 'pointer', boxSizing: 'border-box' }}>
                  {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {inp('Previsión base (€)', 'presupuesto_base', 'number', '0')}
              {inp('Ampliaciones (€)', 'ampliaciones', 'number', '0')}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--c-text-4)', marginBottom: 12 }}>Estado inicial</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[['activo','Activo'], ['preparado','Preparado'], ['cerrado','Cerrado']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => set('estado', val)} style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1.5px solid ${form.estado === val ? '#F59E0B' : 'var(--c-border)'}`,
                  background: form.estado === val ? '#F59E0B18' : 'var(--c-bg-muted)',
                  color: form.estado === val ? '#F59E0B' : 'var(--c-text-2)',
                }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => navigate('/proyectos')} style={{ padding: '9px 20px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', boxShadow: '0 2px 10px rgba(245,158,11,0.3)' }}>
            <Check size={14} /> {saving ? 'Creando…' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
