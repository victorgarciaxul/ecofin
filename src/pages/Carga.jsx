import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users, Calendar, LayoutGrid, RefreshCw, Settings, ExternalLink,
  AlertTriangle, X, Check, Key, Eye, EyeOff, Clock, Sparkles, Copy, CheckCheck,
} from 'lucide-react'
import { getCreds, saveCreds, clearCreds, getMyBoards, loadBoard } from '../lib/trello'

const LABEL_HEX = {
  green: '#61BD4F', yellow: '#F2D600', orange: '#FF9F1A', red: '#EB5A46',
  purple: '#C377E0', blue: '#0079BF', sky: '#00C2E0', lime: '#51E898',
  pink: '#FF78CB', black: '#344563',
}

const DONE_RE = /\b(done|hecho|completado|terminado|cerrado|finalizado|archiv|listo)\b/i
function isDoneList(name = '') { return DONE_RE.test(name) }

function dueBucket(d) {
  if (!d) return null
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000)
  if (diff < 0)   return 'overdue'
  if (diff <= 7)  return 'week1'
  if (diff <= 14) return 'week2'
  if (diff <= 21) return 'week3'
  return 'later'
}

function fmtDue(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?'
}

function memberColor(id = '') {
  const h = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return `hsl(${(h * 47) % 360}, 55%, 48%)`
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Carga() {
  const saved = getCreds()
  const [configured, setConfigured] = useState(!!(saved.key && saved.token))
  const [credForm, setCredForm]     = useState(saved)
  const [showToken, setShowToken]   = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connError, setConnError]   = useState(null)

  const [allBoards, setAllBoards]     = useState([])
  const [selectedIds, setSelectedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('trello_boards') || '[]') } catch { return [] }
  })
  const [showBoardConfig, setShowBoardConfig] = useState(false)

  const [boardData, setBoardData] = useState({})
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const [view, setView]           = useState('persona')
  const [excludeDone, setExcludeDone] = useState(true)

  const [showAnalysis, setShowAnalysis]       = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult]   = useState(null)
  const [analysisError, setAnalysisError]     = useState(null)
  const [showClaudeSetup, setShowClaudeSetup] = useState(false)
  const [claudeKeyInput, setClaudeKeyInput]   = useState('')

  useEffect(() => {
    if (!configured) return
    getMyBoards().then(setAllBoards).catch(() => {})
  }, [configured])

  const fetchData = useCallback(async () => {
    if (selectedIds.length === 0) return
    setLoading(true); setError(null)
    try {
      const results = await Promise.all(selectedIds.map(id => loadBoard(id)))
      const map = {}
      results.forEach(r => { map[r.board.id] = r })
      setBoardData(map)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedIds])

  useEffect(() => {
    if (configured && selectedIds.length > 0) fetchData()
  }, [configured]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConnect() {
    setConnecting(true); setConnError(null)
    try {
      saveCreds(credForm.key.trim(), credForm.token.trim())
      const boards = await getMyBoards()
      setAllBoards(boards)
      setConfigured(true)
      setShowBoardConfig(true)
    } catch {
      clearCreds()
      setConnError('Credenciales incorrectas. Verifica tu API Key y Token.')
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    clearCreds()
    setConfigured(false); setAllBoards([]); setBoardData({}); setSelectedIds([])
    localStorage.removeItem('trello_boards')
    setShowBoardConfig(false)
  }

  function toggleBoard(id) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('trello_boards', JSON.stringify(next))
      return next
    })
  }

  // Build derived data
  const { memberMap, personCards, allCards } = useMemo(() => {
    const memberMap = {}
    const personCards = {}
    const allCards = []

    Object.values(boardData).forEach(({ board, lists, cards, members }) => {
      const listMap = Object.fromEntries(lists.map(l => [l.id, l]))
      members.forEach(m => { memberMap[m.id] = m })

      cards.forEach(card => {
        const list = listMap[card.idList]
        if (!list) return
        if (excludeDone && isDoneList(list.name)) return
        const enriched = { ...card, boardName: board.name, boardUrl: board.shortUrl, listName: list.name }
        allCards.push(enriched)
        if (card.idMembers.length === 0) {
          personCards['__none__'] = [...(personCards['__none__'] || []), enriched]
        } else {
          card.idMembers.forEach(mid => {
            personCards[mid] = [...(personCards[mid] || []), enriched]
          })
        }
      })
    })

    return { memberMap, personCards, allCards }
  }, [boardData, excludeDone])

  // ── AI analysis ─────────────────────────────────────────────────────────────

  function buildPrompt() {
    const lines = []
    lines.push('Eres un consultor de gestión de proyectos analizando la carga de trabajo de una agencia. Analiza los datos de Trello que te proporciono y da un informe claro para la reunión de managers de hoy.')
    lines.push('')

    const overdue = allCards.filter(c => dueBucket(c.due) === 'overdue').length
    lines.push('## RESUMEN')
    lines.push(`- Tableros activos: ${Object.keys(boardData).length}`)
    lines.push(`- Tarjetas en curso (sin "Hecho"): ${allCards.length}`)
    lines.push(`- Tarjetas vencidas: ${overdue}`)
    lines.push(`- Sin miembro asignado: ${(personCards['__none__'] || []).length}`)
    lines.push('')

    lines.push('## CARGA POR PERSONA')
    Object.entries(personCards)
      .map(([id, cards]) => ({ name: id === '__none__' ? 'Sin asignar' : (memberMap[id]?.fullName || id), cards }))
      .sort((a, b) => b.cards.length - a.cards.length)
      .forEach(m => {
        const ov = m.cards.filter(c => dueBucket(c.due) === 'overdue').length
        const w1 = m.cards.filter(c => dueBucket(c.due) === 'week1').length
        lines.push(`**${m.name}** — ${m.cards.length} tarjetas${ov ? ` ⚠ ${ov} VENCIDAS` : ''}${w1 ? ` · ${w1} vencen esta semana` : ''}`)
        m.cards.forEach(c => lines.push(`  - "${c.name}" [${c.boardName} → ${c.listName}]${c.due ? ` · ${fmtDue(c.due)}` : ''}`))
        lines.push('')
      })

    lines.push('## ESTADO DE PROYECTOS')
    Object.values(boardData).forEach(({ board, lists, cards }) => {
      const doneIds = new Set(lists.filter(l => isDoneList(l.name)).map(l => l.id))
      const done    = cards.filter(c => doneIds.has(c.idList)).length
      const active  = cards.length - done
      const pct     = cards.length > 0 ? Math.round((done / cards.length) * 100) : 0
      lines.push(`**${board.name}**: ${active} activas · ${done} completadas · ${pct}% completado`)
      lists.filter(l => !isDoneList(l.name)).forEach(l => {
        const n = cards.filter(c => c.idList === l.id).length
        if (n > 0) lines.push(`  - ${l.name}: ${n}`)
      })
      lines.push('')
    })

    lines.push('---')
    lines.push('Responde en español con estas 4 secciones:')
    lines.push('1. **🚨 Alertas críticas** — saturación, vencimientos urgentes, bloqueos')
    lines.push('2. **👤 Diagnóstico por persona** — quién está sobrecargado, quién tiene margen')
    lines.push('3. **📁 Proyectos con señales de alerta** — estancados, sin progreso, riesgo')
    lines.push('4. **✅ Acciones para la reunión de hoy** — concretas, priorizadas, con nombres')
    lines.push('')
    lines.push('Sé directo. Usa los nombres reales. No repitas los datos en bruto.')
    return lines.join('\n')
  }

  async function runAnalysis() {
    const key = localStorage.getItem('claude_key') || ''
    if (!key) { setShowClaudeSetup(true); return }
    setShowAnalysis(true)
    setAnalysisLoading(true)
    setAnalysisResult(null)
    setAnalysisError(null)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{ role: 'user', content: buildPrompt() }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `Error ${res.status}`)
      }
      const data = await res.json()
      setAnalysisResult(data.content[0].text)
    } catch (e) {
      setAnalysisError(e.message)
    } finally {
      setAnalysisLoading(false)
    }
  }

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div style={{ padding: '48px 32px', maxWidth: 500, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#0079BF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,121,191,0.4)' }}>
            <Key size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)' }}>Conectar con Trello</h1>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Acceso de sólo lectura a tus tableros de proyecto</p>
          </div>
        </div>

        <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 24, marginBottom: 16 }}>
          {/* Step 1 */}
          <SetupStep n={1} label="Obtén tu API Key">
            <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginBottom: 10 }}>
              Ve a <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer" style={{ color: '#0079BF', fontWeight: 600 }}>trello.com/power-ups/admin</a>, crea una Power-Up y copia la API Key.
            </p>
            <input value={credForm.key} onChange={e => setCredForm(f => ({ ...f, key: e.target.value }))}
              placeholder="pega tu API Key"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif', outline: 'none' }} />
          </SetupStep>

          {/* Step 2 */}
          <SetupStep n={2} label="Genera un Token de lectura">
            {credForm.key.trim() ? (
              <a
                href={`https://trello.com/1/authorize?expiration=never&scope=read&response_type=token&name=EcoFin&key=${credForm.key.trim()}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, background: '#0079BF', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 10 }}>
                Autorizar en Trello <ExternalLink size={12} />
              </a>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--c-text-4)', fontStyle: 'italic', marginBottom: 10 }}>Escribe primero tu API Key</p>
            )}
            <div style={{ position: 'relative' }}>
              <input type={showToken ? 'text' : 'password'} value={credForm.token} onChange={e => setCredForm(f => ({ ...f, token: e.target.value }))}
                placeholder="pega el token aquí"
                style={{ width: '100%', padding: '9px 40px 9px 12px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif', outline: 'none' }} />
              <button onClick={() => setShowToken(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex' }}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </SetupStep>
        </div>

        {connError && (
          <div style={{ background: '#EF444418', border: '1px solid #EF444440', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={13} /> {connError}
          </div>
        )}

        <button onClick={handleConnect} disabled={!credForm.key.trim() || !credForm.token.trim() || connecting}
          style={{ width: '100%', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700, background: credForm.key && credForm.token ? '#0079BF' : 'var(--c-bg-muted)', color: credForm.key && credForm.token ? '#fff' : 'var(--c-text-4)', border: 'none', cursor: credForm.key && credForm.token ? 'pointer' : 'default', boxShadow: credForm.key && credForm.token ? '0 2px 12px rgba(0,121,191,0.3)' : 'none' }}>
          {connecting ? 'Conectando…' : 'Conectar con Trello'}
        </button>
      </div>
    )
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', letterSpacing: '-0.4px' }}>Carga de Trabajo</h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-3)', marginTop: 2 }}>
            {selectedIds.length} tablero{selectedIds.length !== 1 ? 's' : ''} · {allCards.length} tarjeta{allCards.length !== 1 ? 's' : ''} activa{allCards.length !== 1 ? 's' : ''}
            {lastRefresh && <span> · {lastRefresh.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-text-3)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={excludeDone} onChange={e => setExcludeDone(e.target.checked)} style={{ accentColor: '#F59E0B' }} />
            Ocultar "Hecho"
          </label>
          <button onClick={() => setShowBoardConfig(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--c-bg-surface)', color: 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: 'pointer' }}>
            <Settings size={13} /> Tableros
          </button>
          <button onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--c-bg-surface)', color: loading ? 'var(--c-text-4)' : 'var(--c-text-2)', border: '1.5px solid var(--c-border)', cursor: loading ? 'wait' : 'pointer' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualizar
          </button>
          {allCards.length > 0 && (
            <button onClick={runAnalysis} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(124,77,255,0.3)' }}>
              <Sparkles size={13} /> Analizar carga
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--c-bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--c-border)', width: 'fit-content' }}>
        {[
          { id: 'persona',      Icon: Users,       label: 'Por persona' },
          { id: 'vencimientos', Icon: Calendar,     label: 'Vencimientos' },
          { id: 'proyecto',     Icon: LayoutGrid,   label: 'Por proyecto' },
        ].map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setView(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: view === id ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'transparent',
            color: view === id ? '#fff' : 'var(--c-text-3)',
            boxShadow: view === id ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* No boards */}
      {selectedIds.length === 0 && !showBoardConfig && (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <p style={{ fontSize: 14, color: 'var(--c-text-3)', marginBottom: 14 }}>No hay tableros seleccionados</p>
          <button onClick={() => setShowBoardConfig(true)} style={{ padding: '9px 22px', borderRadius: 9, background: '#0079BF', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Seleccionar tableros</button>
        </div>
      )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: 'var(--c-text-3)' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid #0079BF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Cargando datos de Trello…</span>
        </div>
      )}

      {/* Content */}
      {!loading && !error && selectedIds.length > 0 && (
        <>
          {view === 'persona'      && <PersonaView personCards={personCards} memberMap={memberMap} />}
          {view === 'vencimientos' && <VencimientosView cards={allCards} memberMap={memberMap} />}
          {view === 'proyecto'     && <ProyectoView boardData={boardData} excludeDone={excludeDone} />}
        </>
      )}

      {/* AI analysis modal */}
      {showAnalysis && (
        <AnalysisModal
          loading={analysisLoading}
          result={analysisResult}
          error={analysisError}
          onClose={() => setShowAnalysis(false)}
          onRetry={runAnalysis}
        />
      )}

      {/* Claude key setup modal */}
      {showClaudeSetup && (
        <ClaudeSetupModal
          value={claudeKeyInput}
          onChange={setClaudeKeyInput}
          onConfirm={() => {
            if (!claudeKeyInput.trim()) return
            localStorage.setItem('claude_key', claudeKeyInput.trim())
            setShowClaudeSetup(false)
            runAnalysis()
          }}
          onClose={() => setShowClaudeSetup(false)}
        />
      )}

      {/* Board config modal */}
      {showBoardConfig && (
        <BoardConfig
          allBoards={allBoards}
          selectedIds={selectedIds}
          onToggle={toggleBoard}
          onClose={() => { setShowBoardConfig(false); if (selectedIds.length > 0) fetchData() }}
          onDisconnect={handleDisconnect}
        />
      )}
    </div>
  )
}

// ─── Setup step component ─────────────────────────────────────────────────────

function SetupStep({ n, label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0079BF', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{label}</span>
      </div>
      <div style={{ paddingLeft: 30 }}>{children}</div>
    </div>
  )
}

// ─── Card chip ────────────────────────────────────────────────────────────────

function CardChip({ card }) {
  const bucket = dueBucket(card.due)
  const dueColor = { overdue: '#EF4444', week1: '#F59E0B', week2: '#7C4DFF', week3: '#06B6D4', later: 'var(--c-text-4)' }
  return (
    <div onClick={() => window.open(card.url, '_blank')}
      style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, cursor: 'pointer' }}>
      {card.labels.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 5 }}>
          {card.labels.map(l => (
            <span key={l.id} title={l.name || l.color} style={{ height: 6, minWidth: 24, borderRadius: 3, background: LABEL_HEX[l.color] || '#B3BEC4', display: 'inline-block' }} />
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-1)', lineHeight: 1.35, marginBottom: 6 }}>{card.name}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--c-text-4)', fontWeight: 500 }}>{card.boardName}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 10, background: 'var(--c-bg-muted)', color: 'var(--c-text-3)', padding: '1px 6px', borderRadius: 4 }}>{card.listName}</span>
          {card.due && (
            <span style={{ fontSize: 10, fontWeight: 700, color: dueColor[bucket] || 'var(--c-text-4)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Clock size={9} /> {fmtDue(card.due)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Por persona ──────────────────────────────────────────────────────────────

function loadBadge(n) {
  if (n >= 8) return { color: '#EF4444', label: 'Saturado' }
  if (n >= 4) return { color: '#F59E0B', label: 'Cargado' }
  return { color: '#10B981', label: 'Disponible' }
}

function PersonaView({ personCards, memberMap }) {
  const members = Object.keys(personCards)
    .map(id => ({
      id,
      name: id === '__none__' ? 'Sin asignar' : (memberMap[id]?.fullName || memberMap[id]?.username || id),
      cards: [...personCards[id]].sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return new Date(a.due) - new Date(b.due)
      }),
    }))
    .sort((a, b) => b.cards.length - a.cards.length)

  if (members.length === 0) return (
    <Empty text="No hay tarjetas activas. Comprueba que los gestores asignan miembros en Trello." />
  )

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
      {members.map(m => {
        const badge = loadBadge(m.cards.length)
        return (
          <div key={m.id} style={{ flexShrink: 0, width: 244, background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 14 }}>
            {/* Member header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: m.id === '__none__' ? 'var(--c-bg-muted)' : memberColor(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                {initials(m.name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{m.name}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: badge.color }}>{m.cards.length} tarjeta{m.cards.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            {/* Cards */}
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {m.cards.map(c => <CardChip key={c.id} card={c} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Vencimientos ─────────────────────────────────────────────────────────────

const BUCKETS = ['overdue', 'week1', 'week2', 'week3', 'later']
const BUCKET_META = {
  overdue: { label: 'Vencidas',        color: '#EF4444', bg: '#EF444415' },
  week1:   { label: 'Esta semana',      color: '#F59E0B', bg: '#F59E0B15' },
  week2:   { label: 'Próxima semana',   color: '#7C4DFF', bg: '#7C4DFF15' },
  week3:   { label: 'En 2-3 semanas',   color: '#06B6D4', bg: '#06B6D415' },
  later:   { label: 'Más adelante',     color: 'var(--c-text-3)', bg: 'var(--c-bg-muted)' },
}

function VencimientosView({ cards, memberMap }) {
  const withDue = [...cards].filter(c => c.due).sort((a, b) => new Date(a.due) - new Date(b.due))
  const noDue   = cards.length - withDue.length

  const grouped = {}
  BUCKETS.forEach(b => { grouped[b] = [] })
  withDue.forEach(c => { const b = dueBucket(c.due); if (b) grouped[b].push(c) })

  if (withDue.length === 0) return (
    <Empty text="Ninguna tarjeta tiene fecha de vencimiento. Los gestores deben añadir fechas en Trello para usar esta vista." />
  )

  return (
    <div>
      {noDue > 0 && (
        <p style={{ fontSize: 12, color: 'var(--c-text-4)', marginBottom: 20 }}>
          {noDue} tarjeta{noDue !== 1 ? 's' : ''} sin fecha de vencimiento no {noDue !== 1 ? 'se muestran' : 'se muestra'}.
        </p>
      )}
      {BUCKETS.filter(b => grouped[b].length > 0).map(b => {
        const meta = BUCKET_META[b]
        return (
          <div key={b} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: 12, color: 'var(--c-text-4)' }}>({grouped[b].length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {grouped[b].map(card => (
                <div key={card.id} onClick={() => window.open(card.url, '_blank')}
                  style={{ background: 'var(--c-bg-surface)', border: `1px solid ${b === 'overdue' ? '#EF444450' : 'var(--c-border)'}`, borderRadius: 10, padding: '11px 14px', cursor: 'pointer' }}>
                  {card.labels.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginBottom: 7, flexWrap: 'wrap' }}>
                      {card.labels.map(l => (
                        <span key={l.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: (LABEL_HEX[l.color] || '#B3BEC4') + '28', color: LABEL_HEX[l.color] || '#B3BEC4', fontWeight: 700 }}>
                          {l.name || l.color}
                        </span>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-1)', lineHeight: 1.35, marginBottom: 9 }}>{card.name}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {card.idMembers.map(mid => {
                        const m = memberMap[mid]
                        if (!m) return null
                        return (
                          <div key={mid} title={m.fullName} style={{ width: 22, height: 22, borderRadius: 6, background: memberColor(mid), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                            {initials(m.fullName)}
                          </div>
                        )
                      })}
                      <span style={{ fontSize: 11, color: 'var(--c-text-4)', marginLeft: 4 }}>{card.boardName}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} /> {fmtDue(card.due)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Por proyecto ─────────────────────────────────────────────────────────────

function ProyectoView({ boardData, excludeDone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.values(boardData).map(({ board, lists, cards, members }) => {
        const memberMap  = Object.fromEntries(members.map(m => [m.id, m]))
        const doneLists  = new Set(lists.filter(l => isDoneList(l.name)).map(l => l.id))
        const doneCount  = cards.filter(c => doneLists.has(c.idList)).length
        const totalCount = cards.length
        const pct        = totalCount > 0 ? doneCount / totalCount : 0
        const visibleLists = excludeDone ? lists.filter(l => !isDoneList(l.name)) : lists

        return (
          <div key={board.id} style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 14, overflow: 'hidden' }}>
            {/* Board header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 10, height: 38, borderRadius: 4, background: '#0079BF', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 2 }}>{board.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>
                    {totalCount - doneCount} activas · {doneCount} completadas · {members.length} miembro{members.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Progress */}
                <div style={{ width: 130, textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--c-text-3)' }}>Completado</span>
                    <span className="font-numeric" style={{ fontSize: 11, fontWeight: 700, color: pct > 0.7 ? '#10B981' : '#F59E0B' }}>{(pct * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--c-border)' }}>
                    <div style={{ width: `${Math.min(pct * 100, 100)}%`, height: '100%', borderRadius: 3, background: pct > 0.7 ? '#10B981' : '#F59E0B', transition: 'width 0.4s' }} />
                  </div>
                </div>
                <a href={board.shortUrl} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--c-text-4)', display: 'flex', padding: 4 }} title="Abrir en Trello">
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>

            {/* Kanban columns */}
            <div style={{ display: 'flex', gap: 0, overflowX: 'auto', padding: '14px 16px 16px', gap: 10, alignItems: 'flex-start' }}>
              {visibleLists.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--c-text-4)', padding: '8px 4px' }}>No hay listas activas visibles.</p>
              ) : visibleLists.map(list => {
                const listCards = cards.filter(c => c.idList === list.id)
                return (
                  <div key={list.id} style={{ flexShrink: 0, width: 200, background: 'var(--c-bg-muted)', borderRadius: 9, padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{list.name}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-4)', background: 'var(--c-border)', padding: '1px 7px', borderRadius: 10, marginLeft: 6, flexShrink: 0 }}>{listCards.length}</span>
                    </div>
                    {listCards.slice(0, 7).map(card => (
                      <div key={card.id} onClick={() => window.open(card.url, '_blank')}
                        style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 7, padding: '7px 8px', marginBottom: 5, cursor: 'pointer' }}>
                        {card.labels.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
                            {card.labels.map(l => (
                              <span key={l.id} title={l.name} style={{ height: 5, minWidth: 18, borderRadius: 2, background: LABEL_HEX[l.color] || '#B3BEC4', display: 'inline-block' }} />
                            ))}
                          </div>
                        )}
                        <p style={{ fontSize: 11, color: 'var(--c-text-1)', lineHeight: 1.3, marginBottom: 5 }}>{card.name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {card.idMembers.slice(0, 3).map(mid => {
                              const m = memberMap[mid]
                              if (!m) return null
                              return (
                                <div key={mid} title={m.fullName} style={{ width: 16, height: 16, borderRadius: 4, background: memberColor(mid), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: '#fff' }}>
                                  {initials(m.fullName)}
                                </div>
                              )
                            })}
                          </div>
                          {card.due && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: dueBucket(card.due) === 'overdue' ? '#EF4444' : 'var(--c-text-4)' }}>
                              {fmtDue(card.due)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {listCards.length > 7 && (
                      <p style={{ fontSize: 10, color: 'var(--c-text-4)', textAlign: 'center', padding: '4px 0' }}>+{listCards.length - 7} más</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Board config modal ───────────────────────────────────────────────────────

function BoardConfig({ allBoards, selectedIds, onToggle, onClose, onDisconnect }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: 28, width: 460, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)' }}>Tableros de proyecto</h2>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Selecciona los tableros que quieres monitorizar</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: 2 }}><X size={16} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {allBoards.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center', padding: 24 }}>No se encontraron tableros abiertos.</p>
          ) : allBoards.map(b => {
            const sel = selectedIds.includes(b.id)
            return (
              <div key={b.id} onClick={() => onToggle(b.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${sel ? '#0079BF60' : 'var(--c-border)'}`,
                background: sel ? '#0079BF0A' : 'transparent', transition: 'all 0.1s',
              }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: sel ? '#0079BF' : 'var(--c-bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}>
                  {sel && <Check size={12} color="white" />}
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? 'var(--c-text-1)' : 'var(--c-text-2)' }}>{b.name}</span>
                <a href={b.shortUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ color: 'var(--c-text-4)', display: 'flex', flexShrink: 0 }} title="Abrir en Trello">
                  <ExternalLink size={11} />
                </a>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--c-border)', paddingTop: 16 }}>
          <button onClick={onDisconnect} style={{ fontSize: 12, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Desconectar Trello</button>
          <button onClick={onClose} style={{ padding: '8px 22px', borderRadius: 9, background: '#0079BF', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Confirmar ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px' }}>
      <p style={{ fontSize: 14, color: 'var(--c-text-3)', maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>{text}</p>
    </div>
  )
}

// ─── Claude API key setup ─────────────────────────────────────────────────────

function ClaudeSetupModal({ value, onChange, onConfirm, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: 28, width: 440 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124,77,255,0.35)' }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)' }}>Análisis con IA</p>
            <p style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Necesitas una API Key de Anthropic</p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--c-text-3)', marginBottom: 14, lineHeight: 1.5 }}>
          Obtén tu clave en{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: '#7C4DFF', fontWeight: 600 }}>
            console.anthropic.com
          </a>
          . Se guarda localmente y nunca sale de tu navegador.
        </p>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="sk-ant-..."
          type="password"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onConfirm() }}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--c-border)', background: 'var(--c-input-bg)', color: 'var(--c-text-1)', fontSize: 13, boxSizing: 'border-box', fontFamily: 'Space Grotesk, sans-serif', outline: 'none', marginBottom: 16 }}
        />
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

// ─── Analysis result modal ────────────────────────────────────────────────────

function AnalysisModal({ loading, result, error, onClose, onRetry }) {
  const [copied, setCopied] = useState(false)

  function copyText() {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Simple markdown renderer: bold, headers, bullet lists
  function renderMarkdown(text) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return (
        <p key={i} style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', marginTop: 20, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--c-border)' }}>
          {line.slice(3)}
        </p>
      )
      if (line.startsWith('### ')) return (
        <p key={i} style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginTop: 14, marginBottom: 6 }}>{line.slice(4)}</p>
      )
      if (line.startsWith('- ') || line.startsWith('* ')) return (
        <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, paddingLeft: 14, marginBottom: 4, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 2, color: 'var(--c-text-4)' }}>·</span>
          {renderInline(line.slice(2))}
        </p>
      )
      if (/^\d+\.\s/.test(line)) return (
        <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 6, paddingLeft: 4 }}>
          {renderInline(line)}
        </p>
      )
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      return (
        <p key={i} style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.6, marginBottom: 4 }}>
          {renderInline(line)}
        </p>
      )
    })
  }

  function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} style={{ color: 'var(--c-text-1)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 110, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ background: 'var(--c-bg-surface)', borderLeft: '1px solid var(--c-border)', width: 520, height: '100vh', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#7C4DFF,#06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={15} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>Análisis de carga de trabajo</p>
            <p style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Generado por Claude · modelo Haiku</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {result && (
              <button onClick={copyText} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, background: copied ? '#10B98118' : 'var(--c-bg-muted)', color: copied ? '#10B981' : 'var(--c-text-3)', border: `1px solid ${copied ? '#10B98140' : 'var(--c-border)'}`, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                {copied ? <CheckCheck size={12} /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: 4, display: 'flex' }}><X size={16} /></button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 48 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #7C4DFF', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13, color: 'var(--c-text-3)', textAlign: 'center' }}>Analizando la carga de trabajo…<br />
                <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Esto puede tardar unos segundos</span>
              </p>
            </div>
          )}
          {error && (
            <div style={{ background: '#EF444418', border: '1px solid #EF444440', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#EF4444', fontWeight: 600, marginBottom: 4 }}>Error al analizar</p>
              <p style={{ fontSize: 12, color: '#EF4444' }}>{error}</p>
              <button onClick={onRetry} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Reintentar</button>
            </div>
          )}
          {result && !loading && (
            <div style={{ paddingBottom: 24 }}>
              {renderMarkdown(result)}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && !loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Basado en los datos actuales de Trello</p>
            <button onClick={onRetry} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'var(--c-bg-muted)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              <RefreshCw size={11} /> Regenerar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
