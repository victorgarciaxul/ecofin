const MESES3 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Selector de rango de meses (tramos), estilo MyTrack.
// props: desde (1-12), hasta (1-12), onChange(desde, hasta)
export default function RangoMeses({ desde, hasta, onChange, size = 'md' }) {
  const mesActual = new Date().getMonth() + 1
  const isFull = desde === 1 && hasta === 12
  const matches = (d, h) => desde === d && hasta === h
  const ult = n => [Math.max(1, mesActual - n + 1), mesActual]

  const pad = size === 'sm' ? '4px 10px' : '6px 12px'
  const fs  = size === 'sm' ? 11.5 : 12.5

  const chip = (label, active, onClick) => (
    <button onClick={onClick} style={{
      padding: pad, borderRadius: 8, fontSize: fs, fontWeight: 600, cursor: 'pointer',
      border: `1.5px solid ${active ? '#F59E0B' : 'var(--c-border)'}`,
      background: active ? '#F59E0B18' : 'var(--c-bg-surface)',
      color: active ? '#F59E0B' : 'var(--c-text-2)', transition: 'all 0.12s',
    }}>{label}</button>
  )

  const selStyle = {
    padding: pad, borderRadius: 8, fontSize: fs, fontWeight: 600,
    border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)',
    color: 'var(--c-text-1)', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {chip('Año completo', isFull, () => onChange(1, 12))}
      {chip('Últimos 3M', !isFull && matches(...ult(3)), () => onChange(...ult(3)))}
      {chip('Últimos 6M', !isFull && matches(...ult(6)), () => onChange(...ult(6)))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: fs - 1, color: 'var(--c-text-4)', fontWeight: 600 }}>De</span>
        <select value={desde} onChange={e => onChange(Math.min(Number(e.target.value), hasta), hasta)} style={selStyle}>
          {MESES3.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <span style={{ fontSize: fs - 1, color: 'var(--c-text-4)', fontWeight: 600 }}>a</span>
        <select value={hasta} onChange={e => onChange(desde, Math.max(Number(e.target.value), desde))} style={selStyle}>
          {MESES3.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
    </div>
  )
}
