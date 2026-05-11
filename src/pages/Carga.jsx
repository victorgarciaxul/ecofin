import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, LayoutGrid, BarChart2, RefreshCw, Sparkles,
  Copy, CheckCheck, X, AlertTriangle,
} from 'lucide-react'
import { getWorkspaces, getProjects, getSummaryByUser, getSummaryByProject, getSummaryByTask } from '../lib/clockify'

// ── Helpers ────────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: 'week',      label: 'Esta semana' },
  { id: 'month',     label: 'Este mes'    },
  { id: 'lastmonth', label: 'Mes anterior'},
  { id: 'year',      label: 'Este año'    },
]

function getPeriodRange(period) {
  const now = new Date()
  let start, end
  if (period === 'week') {
    const dow = now.getDay() || 7
    start = new Date(now); start.setDate(now.getDate() - dow + 1); start.setHours(0,0,0,0)
    end   = new Date(now); end.setHours(23,59,59,999)
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  } else if (period === 'lastmonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  } else {
    start = new Date(now.getFullYear(), 0, 1)
    end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

function fmtH(seconds) {
  if (!seconds || seconds === 0) return '0h'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function personColor(id = '') {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return `hsl(${(n * 47) % 360}, 55%, 48%)`
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalisisTrabajo() {
  const [workspaces, setWorkspaces]   = useState([])
  const [wsId, setWsId]               = useState(() => localStorage.getItem('clockify_ws') || '')
  const [period, setPeriod]           = useState('month')
  const [view, setView]               = useState('persona')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [byUser, setByUser]           = useState(null)
  const [byProject, setByProject]     = useState(null)
  const [byTask, setByTask]           = useState(null)
  const [projects, setProjects]       = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)

  // AI
  const [showAnalysis, setShowAnalysis]       = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult]   = useState(null)
  const [analysisError, setAnalysisError]     = useState(null)
  const [showGroqSetup, setShowGroqSetup]     = useState(false)
  const [groqKeyInput, setGroqKeyInput]       = useState('')
  const [chatMessages, setChatMessages]       = useState([])
  const [chatLoading, setChatLoading]         = useState(false)

  // Init workspaces
  useEffect(() => {
    getWorkspaces()
      .then(ws => {
        setWorkspaces(ws)
        if (!wsId && ws.length > 0) {
          const id = ws[0].id
          setWsId(id)
          localStorage.setItem('clockify_ws', id)
        }
      })
      .catch(e => setError(e.message))
  }, []) // eslint-disable-line

  const fetchData = useCallback(async () => {
    if (!wsId) return
    setLoading(true); setError(null)
    const range = getPeriodRange(period)
    try {
      const [userReport, projectReport, taskReport, projs] = await Promise.all([
        getSummaryByUser(wsId, range.start, range.end),
        getSummaryByProject(wsId, range.start, range.end),
        getSummaryByTask(wsId, range.start, range.end),
        getProjects(wsId),
      ])
      setByUser(userReport)
      setByProject(projectReport)
      setByTask(taskReport)
      setProjects(projs)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [wsId, period])

  useEffect(() => { if (wsId) fetchData() }, [wsId, period]) // eslint-disable-line

  const projectColorMap = Object.fromEntries(projects.map(p => [p.id, p.color || '#7C4DFF']))
  const totalSeconds    = byUser?.totals?.[0]?.totalTime || 0

  // ── AI ────────────────────────────────────────────────────────────────────────

  function buildPrompt() {
    const label = PERIODS.find(p => p.id === period)?.label || period
    const lines = [
      `Eres un consultor analizando la carga de trabajo de una agencia. Período: ${label}. Total horas: ${fmtH(totalSeconds)}.`,
      '', '## HORAS POR PERSONA',
    ]
    ;(byUser?.groupOne || []).forEach(u => {
      lines.push(`**${u.name}** — ${fmtH(u.duration)}`)
      ;(u.children || []).forEach(p => lines.push(`  - ${p.name}: ${fmtH(p.duration)}`))
    })
    lines.push('', '## HORAS POR PROYECTO')
    ;(byProject?.groupOne || []).forEach(p => {
      lines.push(`**${p.name}** — ${fmtH(p.duration)}`)
      ;(p.children || []).forEach(u => lines.push(`  - ${u.name}: ${fmtH(u.duration)}`))
    })
    lines.push(
      '', '---',
      'Responde en español con estas secciones:',
      '1. **📊 Resumen del período** — horas totales, media por persona, tendencias',
      '2. **👤 Diagnóstico por persona** — quién está sobrecargado, quién tiene margen',
      '3. **📁 Proyectos con más dedicación** — cuáles concentran más horas y si es coherente',
      '4. **✅ Recomendaciones** — acciones concretas para equilibrar la carga',
      '', 'Sé directo. Usa los nombres reales. No repitas los datos en bruto.',
    )
    return lines.join('\n')
  }

  async function runAnalysis() {
    const key = localStorage.getItem('groq_key') || import.meta.env.VITE_GROQ_KEY || ''
    if (!key) { setShowGroqSetup(true); return }
    setShowAnalysis(true); setAnalysisLoading(true); setAnalysisResult(null); setAnalysisError(null); setChatMessages([])
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2048,
          messages: [{ role: 'user', content: buildPrompt() }],
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Error ${res.status}`) }
      const data = await res.json()
      setAnalysisResult(data.choices[0].message.content)
    } catch (e) {
      setAnalysisError(e.message)
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function sendChatMessage(text) {
    if (!text.trim() || chatLoading || !analysisResult) return
    const key = localStorage.getItem('groq_key') || import.meta.env.VITE_GROQ_KEY || ''
    const userMsg = { role: 'user', content: text.trim() }
    setChatMessages(prev => [...prev, userMsg])
    setChatLoading(true)
    try {
      const history = [
        { role: 'user', content: buildPrompt() },
        { role: 'assistant', content: analysisResult },
        ...chatMessages.map(m => ({ role: m.role, content: m.content })),
        userMsg,
      ]
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages: history }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Error ${res.status}`) }
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, isError: true }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.4px' }}>Análisis de trabajo</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>
            <span className="font-numeric" style={{ fontWeight: 600, color: 'var(--c-text-2)' }}>{fmtH(totalSeconds)}</span> registradas
            {lastRefresh && <> · actualizado {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Workspace selector */}
          {workspaces.length > 1 && (
            <select value={wsId} onChange={e => { setWsId(e.target.value); localStorage.setItem('clockify_ws', e.target.value) }}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--c-border)', background: 'var(--c-bg-surface)', color: 'var(--c-text-1)', cursor: 'pointer' }}>
              {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {/* Period selector */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--c-bg-surface)', padding: 3, borderRadius: 9, border: '1px solid var(--c-border)' }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                padding: '5px 11px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: period === p.id ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'transparent',
                color: period === p.id ? '#fff' : 'var(--c-text-3)',
              }}>{p.label}</button>
            ))}
          </div>

          <button onClick={fetchData} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--c-bg-surface)', color: loading ? 'var(--c-text-4)' : 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: loading ? 'wait' : 'pointer' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Actualizar
          </button>

          {totalSeconds > 0 && (
            <button onClick={runAnalysis}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(124,77,255,0.3)' }}>
              <Sparkles size={13} /> Analizar con IA
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--c-bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--c-border)', width: 'fit-content' }}>
        {[
          { id: 'persona',  Icon: Users,       label: 'Por persona'  },
          { id: 'proyecto', Icon: LayoutGrid,  label: 'Por proyecto' },
          { id: 'grafico',  Icon: BarChart2,   label: 'Gráficos'     },
        ].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setView(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: view === id ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'transparent',
            color: view === id ? '#fff' : 'var(--c-text-3)',
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#EF444418', border: '1px solid #EF444440', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <AlertTriangle size={15} style={{ color: '#EF4444', flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: '#EF4444', flex: 1 }}>{error}</p>
          <button onClick={fetchData} style={{ fontSize: 12, fontWeight: 600, color: '#EF4444', background: 'none', border: '1px solid #EF444460', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 0', color: 'var(--c-text-3)' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid #F59E0B', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Cargando datos de Clockify…</span>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <>
          {view === 'persona'  && <PersonaView  data={byUser}    projectColorMap={projectColorMap} totalSeconds={totalSeconds} />}
          {view === 'proyecto' && <ProyectoView data={byProject} projectColorMap={projectColorMap} />}
          {view === 'grafico'  && <GraficoView  data={byTask}    projectColorMap={projectColorMap} totalSeconds={totalSeconds} />}
        </>
      )}

      {/* Modals */}
      {showAnalysis && (
        <AnalysisModal loading={analysisLoading} result={analysisResult} error={analysisError}
          chatMessages={chatMessages} chatLoading={chatLoading}
          onClose={() => { setShowAnalysis(false); setChatMessages([]) }}
          onRetry={runAnalysis} onSendMessage={sendChatMessage} />
      )}
      {showGroqSetup && (
        <GroqSetupModal value={groqKeyInput} onChange={setGroqKeyInput}
          onConfirm={() => {
            if (!groqKeyInput.trim()) return
            localStorage.setItem('groq_key', groqKeyInput.trim())
            setShowGroqSetup(false); runAnalysis()
          }}
          onClose={() => setShowGroqSetup(false)} />
      )}
    </div>
  )
}

// ── Vista por persona ──────────────────────────────────────────────────────────

function PersonaView({ data, projectColorMap, totalSeconds }) {
  if (!data) return <Empty text="Sin datos para este período." />
  const users = data.groupOne || []
  if (users.length === 0) return <Empty text="No hay horas registradas en este período." />

  const maxSec = Math.max(...users.map(u => u.duration || 0), 1)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
      {users.map(user => {
        const pct = user.duration / maxSec
        const loadColor = pct > 0.75 ? '#EF4444' : pct > 0.4 ? '#F59E0B' : '#10B981'
        const loadLabel = pct > 0.75 ? 'Alta carga' : pct > 0.4 ? 'Media' : 'Baja carga'
        const projs     = user.children || []
        const maxProj   = Math.max(...projs.map(p => p.duration || 0), 1)

        return (
          <div key={user._id} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '18px 20px' }}>
            {/* Avatar + nombre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: personColor(user._id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                {initials(user.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user.name}</p>
                <span className="font-numeric" style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)' }}>{fmtH(user.duration)}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: loadColor, background: loadColor + '18', padding: '3px 9px', borderRadius: 6, flexShrink: 0 }}>{loadLabel}</span>
            </div>

            {/* % del total */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Del total registrado</span>
                <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: loadColor }}>
                  {totalSeconds > 0 ? ((user.duration / totalSeconds) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--c-border)' }}>
                <div style={{ width: `${totalSeconds > 0 ? Math.min((user.duration / totalSeconds) * 100, 100) : 0}%`, height: '100%', borderRadius: 3, background: loadColor, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Proyectos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {projs.slice(0, 7).map(proj => {
                const isNoProject = !proj._id || proj._id === '000000000000000000000000'
                const color = isNoProject ? '#B0B0C8' : (projectColorMap[proj._id] || '#7C4DFF')
                const w     = (proj.duration / maxProj) * 100
                return (
                  <div key={proj._id || 'none'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--c-text-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {isNoProject ? 'Sin proyecto' : proj.name}
                        </span>
                      </div>
                      <span className="font-numeric" style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-1)', flexShrink: 0, marginLeft: 8 }}>{fmtH(proj.duration)}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'var(--c-border)' }}>
                      <div style={{ width: `${w}%`, height: '100%', borderRadius: 2, background: color + 'cc', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
              {projs.length > 7 && (
                <p style={{ fontSize: 10, color: 'var(--c-text-4)', marginTop: 2 }}>+{projs.length - 7} proyectos más</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista por proyecto ─────────────────────────────────────────────────────────

function ProyectoView({ data, projectColorMap }) {
  if (!data) return <Empty text="Sin datos para este período." />
  const projs = data.groupOne || []
  if (projs.length === 0) return <Empty text="No hay horas registradas en este período." />

  const maxSec = Math.max(...projs.map(p => p.duration || 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {projs.map(proj => {
        const isNoProject = !proj._id || proj._id === '000000000000000000000000'
        const color = isNoProject ? '#B0B0C8' : (projectColorMap[proj._id] || '#7C4DFF')
        const users = proj.children || []
        const pct   = proj.duration / maxSec

        return (
          <div key={proj._id || 'none'} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: users.length > 0 ? 14 : 0 }}>
              <div style={{ width: 10, height: 38, borderRadius: 4, background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 5 }}>
                  {isNoProject ? 'Sin proyecto asignado' : proj.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="font-numeric" style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)', flexShrink: 0 }}>{fmtH(proj.duration)}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--c-border)', maxWidth: 240 }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--c-text-4)', flexShrink: 0 }}>
                    {users.length} persona{users.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            {users.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', paddingLeft: 22 }}>
                {users.map(u => (
                  <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '5px 10px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: personColor(u._id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {initials(u.name)}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--c-text-2)', fontWeight: 500 }}>{u.name.split(' ')[0]}</span>
                    <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-1)' }}>{fmtH(u.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista gráficos ─────────────────────────────────────────────────────────────

function GraficoView({ data, projectColorMap, totalSeconds }) {
  const [selected, setSelected] = useState(null)

  if (!data) return <Empty text="Sin datos para este período." />
  const projs = (data.groupOne || []).filter(p => p._id && p._id !== '000000000000000000000000')
  if (projs.length === 0) return <Empty text="No hay horas registradas en este período." />

  const totalProj = projs.reduce((s, p) => s + (p.duration || 0), 0)

  const items = projs
    .map((p, idx) => ({
      name: p.name,
      duration: p.duration || 0,
      pct: totalProj > 0 ? (p.duration / totalProj) * 100 : 0,
      id: p._id,
      color: projectColorMap[p._id] || `hsl(${(idx * 67 + 197) % 360},60%,52%)`,
      tasks: (p.children || []).sort((a, b) => (b.duration || 0) - (a.duration || 0)),
    }))
    .sort((a, b) => b.duration - a.duration)

  const selItem = selected ? items.find(i => i.id === selected) : null

  // ── Custom SVG donut ────────────────────────────────────────────────────────
  const SZ = 200, CX = 100, CY = 100, RO = 84, RI = 54
  const GAP = items.length > 1 ? 0.03 : 0

  function slicePath(startA, endA) {
    const span = endA - startA - GAP * 2
    if (span <= 0) return ''
    const s = startA + GAP, e = s + span
    const large = span > Math.PI ? 1 : 0
    const ox1 = CX + RO * Math.cos(s), oy1 = CY + RO * Math.sin(s)
    const ox2 = CX + RO * Math.cos(e), oy2 = CY + RO * Math.sin(e)
    const ix1 = CX + RI * Math.cos(e), iy1 = CY + RI * Math.sin(e)
    const ix2 = CX + RI * Math.cos(s), iy2 = CY + RI * Math.sin(s)
    return `M${ox1} ${oy1} A${RO} ${RO} 0 ${large} 1 ${ox2} ${oy2} L${ix1} ${iy1} A${RI} ${RI} 0 ${large} 0 ${ix2} ${iy2}Z`
  }

  let cursor = -Math.PI / 2
  const slices = items.map(item => {
    const span = (item.pct / 100) * 2 * Math.PI
    const start = cursor
    cursor += span
    return { ...item, start, end: cursor }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Stats chips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {[
          { label: 'Total horas',   value: fmtH(totalSeconds), sub: null },
          { label: 'Proyectos activos', value: items.length, sub: null },
          items[0] ? { label: 'Proyecto top', value: items[0].name, sub: `${items[0].pct.toFixed(1)}% del período`, color: items[0].color } : null,
        ].filter(Boolean).map((chip, i) => (
          <div key={i} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '13px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 4 }}>{chip.label}</p>
            <p className="font-numeric" style={{ fontSize: 18, fontWeight: 700, color: chip.color || 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{chip.value}</p>
            {chip.sub && <p style={{ fontSize: 10, color: chip.color || 'var(--c-text-3)', marginTop: 2, fontWeight: 600 }}>{chip.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Main area ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Donut card */}
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)', marginBottom: 14, alignSelf: 'flex-start' }}>Distribución</p>
          <div style={{ position: 'relative', width: SZ, height: SZ }}>
            <svg width={SZ} height={SZ} style={{ overflow: 'visible' }}>
              {slices.map(sl => (
                <path
                  key={sl.id}
                  d={slicePath(sl.start, sl.end)}
                  fill={sl.color}
                  stroke={selected === sl.id ? '#fff' : 'transparent'}
                  strokeWidth="2"
                  opacity={selected && selected !== sl.id ? 0.25 : 1}
                  style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onClick={() => setSelected(selected === sl.id ? null : sl.id)}
                />
              ))}
            </svg>
            {/* Center label */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {selItem ? (
                <>
                  <p className="font-numeric" style={{ fontSize: 24, fontWeight: 800, color: selItem.color, lineHeight: 1 }}>{selItem.pct.toFixed(0)}%</p>
                  <p style={{ fontSize: 9, color: 'var(--c-text-3)', marginTop: 4, textAlign: 'center', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selItem.name}</p>
                </>
              ) : (
                <>
                  <p className="font-numeric" style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-text-1)', lineHeight: 1 }}>{fmtH(totalProj)}</p>
                  <p style={{ fontSize: 10, color: 'var(--c-text-3)', marginTop: 3 }}>total</p>
                </>
              )}
            </div>
          </div>

          {/* Mini legend */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
            {items.slice(0, 6).map(item => (
              <div key={item.id}
                onClick={() => setSelected(selected === item.id ? null : item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background 0.15s',
                  background: selected === item.id ? item.color + '1A' : 'transparent',
                  opacity: selected && selected !== item.id ? 0.35 : 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--c-text-2)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</span>
                <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: item.color, flexShrink: 0 }}>{item.pct.toFixed(0)}%</span>
              </div>
            ))}
            {items.length > 6 && (
              <p style={{ fontSize: 10, color: 'var(--c-text-4)', paddingLeft: 6, marginTop: 2 }}>+{items.length - 6} proyectos más</p>
            )}
          </div>
        </div>

        {/* Projects + tasks list */}
        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-2)' }}>Proyectos y tareas</p>
            <p style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Clic para expandir tareas</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item, idx) => {
              const isOpen = selected === item.id
              return (
                <div key={item.id} style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--c-border-light)' : 'none' }}>

                  {/* Project row */}
                  <div
                    onClick={() => setSelected(isOpen ? null : item.id)}
                    style={{ padding: '13px 20px', cursor: 'pointer', transition: 'background 0.15s',
                      background: isOpen ? item.color + '0E' : 'transparent',
                      borderLeft: `3px solid ${isOpen ? item.color : 'transparent'}`,
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--c-bg-hover)' }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.name}</span>
                      <span className="font-numeric" style={{ fontSize: 12, fontWeight: 700, color: item.color, flexShrink: 0 }}>{item.pct.toFixed(1)}%</span>
                      <span className="font-numeric" style={{ fontSize: 12, color: 'var(--c-text-3)', flexShrink: 0, minWidth: 40, textAlign: 'right' }}>{fmtH(item.duration)}</span>
                      <span style={{ fontSize: 10, color: 'var(--c-text-4)', marginLeft: 4, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'var(--c-border)', marginLeft: 19 }}>
                      <div style={{ width: `${item.pct}%`, height: '100%', borderRadius: 3, background: item.color, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)', opacity: 0.85 }} />
                    </div>
                  </div>

                  {/* Task breakdown — inline expand */}
                  {isOpen && (
                    <div style={{ padding: '10px 20px 16px 42px', background: item.color + '07', borderTop: `1px solid ${item.color}22` }}>
                      {item.tasks.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--c-text-4)', fontStyle: 'italic', padding: '6px 0' }}>Sin tareas registradas en Clockify</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {item.tasks.map((task, ti) => {
                            const tPct = item.duration > 0 ? (task.duration / item.duration) * 100 : 0
                            const noTask = !task._id || !task.name || task.name === '(No task)'
                            return (
                              <div key={task._id || ti}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, color: noTask ? 'var(--c-text-4)' : 'var(--c-text-2)', fontStyle: noTask ? 'italic' : 'normal', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                    {noTask ? 'Sin tarea asignada' : task.name}
                                  </span>
                                  <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: item.color, flexShrink: 0 }}>{tPct.toFixed(1)}%</span>
                                  <span className="font-numeric" style={{ fontSize: 11, color: 'var(--c-text-3)', flexShrink: 0, minWidth: 36, textAlign: 'right' }}>{fmtH(task.duration)}</span>
                                </div>
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--c-border)' }}>
                                  <div style={{ width: `${tPct}%`, height: '100%', borderRadius: 2, background: item.color, opacity: noTask ? 0.3 : 0.65, transition: 'width 0.5s' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty ──────────────────────────────────────────────────────────────────────

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <p style={{ fontSize: 14, color: 'var(--c-text-3)', maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

// ── Groq key setup ─────────────────────────────────────────────────────────────

function GroqSetupModal({ value, onChange, onConfirm, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: 28, width: 460 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)' }}>Análisis con IA</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Llama 3.3 70B · Groq · Gratuito</p>
          </div>
        </div>
        <div style={{ background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 6 }}>
            Groq ofrece el modelo <strong style={{ color: 'var(--c-text-1)' }}>Llama 3.3 70B</strong> completamente gratis.
            Solo necesitas crear una cuenta y generar una API key:
          </p>
          <p style={{ fontSize: 12, color: 'var(--c-text-3)', lineHeight: 1.6 }}>
            1. Ve a{' '}
            <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: '#7C4DFF', fontWeight: 600 }}>
              console.groq.com/keys
            </a>
            {' '}→ crea una cuenta gratis<br />
            2. Clic en <strong style={{ color: 'var(--c-text-1)' }}>Create API Key</strong> → copia la clave<br />
            3. Pégala aquí
          </p>
        </div>
        <input value={value} onChange={e => onChange(e.target.value)} placeholder="gsk_…" type="password" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onConfirm() }}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', outline: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={onConfirm} disabled={!value.trim()} style={{ padding: '8px 20px', borderRadius: 8, background: value.trim() ? 'linear-gradient(135deg,#7C4DFF,#06B6D4)' : 'var(--c-bg-muted)', color: value.trim() ? '#fff' : 'var(--c-text-4)', border: 'none', cursor: value.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700 }}>
            Guardar y analizar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Analysis modal ─────────────────────────────────────────────────────────────

function AnalysisModal({ loading, result, error, chatMessages, chatLoading, onClose, onRetry, onSendMessage }) {
  const [copied, setCopied]   = useState(false)
  const [chatInput, setChatInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatMessages, chatLoading])

  function copyText() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  function handleSend() {
    if (!chatInput.trim() || chatLoading) return
    onSendMessage(chatInput)
    setChatInput('')
  }

  function renderInline(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} style={{ color: 'var(--c-text-1)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )
  }

  function renderMarkdown(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## '))  return <p key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', marginTop: 20, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--c-border)' }}>{line.slice(3)}</p>
      if (line.startsWith('### ')) return <p key={i} style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginTop: 14, marginBottom: 6 }}>{line.slice(4)}</p>
      if (line.startsWith('- ') || line.startsWith('* ')) return (
        <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, paddingLeft: 14, marginBottom: 4, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 2, color: 'var(--c-text-4)' }}>·</span>
          {renderInline(line.slice(2))}
        </p>
      )
      if (/^\d+\.\s/.test(line)) return <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 6, paddingLeft: 4 }}>{renderInline(line)}</p>
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      return <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 4 }}>{renderInline(line)}</p>
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: 'var(--c-bg-surface)', borderLeft: '1px solid var(--c-border)', width: 520, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={14} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>Análisis de trabajo</p>
            <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Llama 3.3 · 70B · Groq</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {result && (
              <button onClick={copyText} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: copied ? '#10B98118' : 'var(--c-bg-muted)', color: copied ? '#10B981' : 'var(--c-text-3)', border: `1px solid ${copied ? '#10B98140' : 'var(--c-border)'}`, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {copied ? <CheckCheck size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            )}
            {result && !loading && (
              <button onClick={onRetry} title="Regenerar" style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', borderRadius: 7, background: 'var(--c-bg-muted)', color: 'var(--c-text-3)', border: '1px solid var(--c-border)', cursor: 'pointer' }}>
                <RefreshCw size={12} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: 4, display: 'flex' }}><X size={16} /></button>
          </div>
        </div>

        {/* Content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center' }}>Analizando la carga de trabajo…<br /><span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Unos segundos</span></p>
            </div>
          )}
          {error && (
            <div style={{ background: '#EF444418', border: '1px solid #EF444440', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>Error al analizar</p>
              <p style={{ fontSize: 12, color: '#EF4444' }}>{error}</p>
              <button onClick={onRetry} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Reintentar</button>
            </div>
          )}

          {/* Initial analysis */}
          {result && !loading && (
            <div style={{ paddingBottom: 8 }}>{renderMarkdown(result)}</div>
          )}

          {/* Chat messages */}
          {chatMessages.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conversación</span>
                <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '88%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: msg.role === 'user' ? 'linear-gradient(135deg,#7C4DFF,#06B6D4)' : msg.isError ? '#EF444418' : 'var(--c-bg-muted)',
                      border: msg.role === 'user' ? 'none' : `1px solid ${msg.isError ? '#EF444440' : 'var(--c-border)'}`,
                    }}>
                      <p style={{ fontSize: 13, color: msg.role === 'user' ? '#fff' : msg.isError ? '#EF4444' : 'var(--c-text-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                        {msg.role === 'assistant' ? renderInline(msg.content) : msg.content}
                      </p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: 'var(--c-bg-muted)', border: '1px solid var(--c-border)' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {[0,1,2].map(j => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C4DFF', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${j * 0.2}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          <div style={{ height: 8 }} />
        </div>

        {/* Chat input */}
        {result && !loading && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--c-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Pregunta algo sobre el análisis… (Enter para enviar)"
                rows={2}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10, fontSize: 13,
                  border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)',
                  color: 'var(--c-text-1)', outline: 'none', resize: 'none',
                  fontFamily: 'inherit', lineHeight: 1.4,
                }}
                onFocus={e => e.target.style.borderColor = '#7C4DFF'}
                onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
              />
              <button onClick={handleSend} disabled={!chatInput.trim() || chatLoading}
                style={{
                  width: 38, height: 38, borderRadius: 10, border: 'none', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default',
                  background: chatInput.trim() && !chatLoading ? 'linear-gradient(135deg,#7C4DFF,#06B6D4)' : 'var(--c-bg-muted)',
                  color: chatInput.trim() && !chatLoading ? '#fff' : 'var(--c-text-4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--c-text-4)', marginTop: 5, textAlign: 'center' }}>Shift+Enter para nueva línea · Contexto completo incluido</p>
          </div>
        )}
      </div>
    </div>
  )
}
