import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import {
  format, startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subWeeks, subMonths, subYears, addDays, subDays, addMonths,
  isSameDay, getDaysInMonth, getDay,
} from 'date-fns'
import { es } from 'date-fns/locale'

const WEEK_DAYS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

function makePresets() {
  const now = new Date()
  return [
    { label: 'Hoy',                    from: startOfDay(now),                                      to: endOfDay(now) },
    { label: 'Ayer',                   from: startOfDay(subDays(now, 1)),                          to: endOfDay(subDays(now, 1)) },
    { label: 'Esta semana',            from: startOfWeek(now, { weekStartsOn: 1 }),                to: endOfWeek(now, { weekStartsOn: 1 }) },
    { label: 'La semana pasada',       from: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),   to: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) },
    { label: 'Las últimas dos semanas',from: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }),   to: endOfWeek(now, { weekStartsOn: 1 }) },
    { label: 'Este mes',               from: startOfMonth(now),                                    to: endOfMonth(now) },
    { label: 'El mes pasado',          from: startOfMonth(subMonths(now, 1)),                      to: endOfMonth(subMonths(now, 1)) },
    { label: 'Este año',               from: startOfYear(now),                                     to: endOfYear(now) },
    { label: 'El año pasado',          from: startOfYear(subYears(now, 1)),                        to: endOfYear(subYears(now, 1)) },
  ]
}

function findActivePreset(presets, from, to) {
  if (!from || !to) return -1
  return presets.findIndex(p => isSameDay(p.from, from) && isSameDay(p.to, to))
}

function MonthGrid({ month, from, to, selecting, hover, onDayClick, onDayEnter, onDayLeave }) {
  const firstDow = (getDay(month) + 6) % 7
  const daysCount = getDaysInMonth(month)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysCount; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))

  function getDayStyle(date) {
    const rangeFrom = selecting ? (hover && hover < selecting ? hover : selecting) : from
    const rangeTo   = selecting ? (hover && hover < selecting ? selecting : (hover || selecting)) : to
    const isStart = rangeFrom && isSameDay(date, rangeFrom)
    const isEnd   = rangeTo   && isSameDay(date, rangeTo)
    const inRange = rangeFrom && rangeTo && date > rangeFrom && date < rangeTo
    const isToday = isSameDay(date, new Date())
    if (isStart || isEnd) return { bg: '#7C4DFF', color: '#fff', fw: 700, radius: isStart && isEnd ? 8 : isStart ? '8px 0 0 8px' : '0 8px 8px 0' }
    if (inRange)          return { bg: '#7C4DFF1A', color: '#7C4DFF', fw: 500, radius: 0 }
    if (isToday)          return { bg: 'transparent', color: '#7C4DFF', fw: 700, radius: 8, border: '1.5px solid #7C4DFF55' }
    return { bg: 'transparent', color: 'var(--c-text-1)', fw: 400, radius: 8 }
  }

  return (
    <div style={{ minWidth: 196 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WEEK_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--c-text-4)', paddingBottom: 4, textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px 0' }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />
          const ds = getDayStyle(date)
          return (
            <div
              key={date.getDate()}
              onClick={() => onDayClick(date)}
              onMouseEnter={() => onDayEnter(date)}
              onMouseLeave={onDayLeave}
              style={{
                textAlign: 'center', fontSize: 12, fontWeight: ds.fw,
                padding: '5px 0', cursor: 'pointer',
                background: ds.bg, color: ds.color,
                borderRadius: ds.radius, border: ds.border || 'none',
                transition: 'background 0.08s', userSelect: 'none', lineHeight: '20px',
              }}
            >
              {date.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen]      = useState(false)
  const [selecting, setSel]  = useState(null)
  const [hover, setHover]    = useState(null)
  const [leftMonth, setLeft] = useState(() => startOfMonth(from || new Date()))
  const containerRef         = useRef(null)

  const presets      = makePresets()
  const activePreset = findActivePreset(presets, from, to)
  const rightMonth   = addMonths(leftMonth, 1)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!containerRef.current?.contains(e.target)) { setOpen(false); setSel(null); setHover(null) }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleOpen() {
    setOpen(o => !o)
    if (!open) setLeft(startOfMonth(from || new Date()))
  }

  function handlePreset(p) {
    onChange({ from: p.from, to: p.to })
    setSel(null); setHover(null); setOpen(false)
  }

  function handleDayClick(date) {
    if (!selecting) {
      setSel(date)
    } else {
      const [f, t] = date < selecting
        ? [startOfDay(date), endOfDay(selecting)]
        : [startOfDay(selecting), endOfDay(date)]
      onChange({ from: f, to: t })
      setSel(null); setHover(null); setOpen(false)
    }
  }

  function shiftRange(dir) {
    if (!from || !to) return
    const shift = Math.round((startOfDay(to) - startOfDay(from)) / 86400000) + 1
    onChange({
      from: startOfDay(dir > 0 ? addDays(from, shift) : subDays(from, shift)),
      to:   endOfDay(  dir > 0 ? addDays(to,   shift) : subDays(to,   shift)),
    })
  }

  const triggerLabel = from && to
    ? `${format(from, 'dd/MM/yyyy')} - ${format(to, 'dd/MM/yyyy')}`
    : 'Seleccionar rango'

  const arrowBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 34, border: '1px solid var(--c-border)',
    background: 'var(--c-bg-surface)', cursor: 'pointer', color: 'var(--c-text-3)',
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRight: 'none',
          border: '1px solid var(--c-border)', borderRadius: '8px 0 0 8px',
          background: 'var(--c-bg-surface)', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)',
          height: 34, whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={14} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
        {triggerLabel}
      </button>
      <button onClick={() => shiftRange(-1)} style={{ ...arrowBtn, borderRadius: 0 }}>
        <ChevronLeft size={14} />
      </button>
      <button onClick={() => shiftRange(1)} style={{ ...arrowBtn, borderLeft: 'none', borderRadius: '0 8px 8px 0' }}>
        <ChevronRight size={14} />
      </button>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 400,
            background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)',
            borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            display: 'flex', overflow: 'hidden',
          }}
        >
          {/* Presets */}
          <div style={{ borderRight: '1px solid var(--c-border-light)', padding: '8px 0', minWidth: 175 }}>
            {presets.map((p, i) => (
              <div
                key={p.label}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '9px 18px', fontSize: 13, cursor: 'pointer',
                  fontWeight: i === activePreset ? 600 : 400,
                  color: i === activePreset ? '#fff' : 'var(--c-text-1)',
                  background: i === activePreset ? '#7C4DFF' : 'transparent',
                }}
                onMouseEnter={e => { if (i !== activePreset) e.currentTarget.style.background = 'var(--c-bg-muted)' }}
                onMouseLeave={e => { if (i !== activePreset) e.currentTarget.style.background = 'transparent' }}
              >
                {p.label}
              </div>
            ))}
          </div>

          {/* Dual calendar */}
          <div style={{ padding: '16px 20px', display: 'flex', gap: 28 }}>
            {[leftMonth, rightMonth].map((month, mi) => (
              <div key={mi}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  {mi === 0
                    ? <button onClick={() => setLeft(m => addMonths(m, -1))} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}><ChevronLeft size={13} /></button>
                    : <div style={{ width: 26 }} />
                  }
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', textTransform: 'capitalize', minWidth: 120, textAlign: 'center' }}>
                    {format(month, 'MMMM yyyy', { locale: es })}
                  </span>
                  {mi === 1
                    ? <button onClick={() => setLeft(m => addMonths(m, 1))} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--c-border)', background: 'var(--c-bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-3)' }}><ChevronRight size={13} /></button>
                    : <div style={{ width: 26 }} />
                  }
                </div>
                <MonthGrid
                  month={month} from={from} to={to}
                  selecting={selecting} hover={hover}
                  onDayClick={handleDayClick}
                  onDayEnter={d => selecting && setHover(d)}
                  onDayLeave={() => setHover(null)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
