import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DEMO_PROYECTOS, DEMO_ENTRADAS } from '../lib/demoData'

const DataContext = createContext({})

function initFromStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

export function DataProvider({ children }) {
  const isDemo = !isSupabaseConfigured

  const [proyectos, setProyectos] = useState(() =>
    initFromStorage('ecofin_proyectos', DEMO_PROYECTOS)
  )
  const [entradas, setEntradas] = useState(() =>
    initFromStorage('ecofin_entradas', DEMO_ENTRADAS)
  )
  const [loading, setLoading] = useState(!isDemo)

  // Persist to localStorage in demo mode
  useEffect(() => {
    if (isDemo) localStorage.setItem('ecofin_proyectos', JSON.stringify(proyectos))
  }, [proyectos, isDemo])

  useEffect(() => {
    if (isDemo) localStorage.setItem('ecofin_entradas', JSON.stringify(entradas))
  }, [entradas, isDemo])

  // Load from Supabase when configured
  useEffect(() => {
    if (!isDemo) loadFromSupabase()
  }, [isDemo])

  async function loadFromSupabase() {
    setLoading(true)
    const [{ data: pData }, { data: eData }] = await Promise.all([
      supabase.from('eco_proyectos').select('*').order('codigo_proyecto'),
      supabase.from('eco_entradas').select('*'),
    ])
    if (pData) setProyectos(pData)
    if (eData) setEntradas(eData)
    setLoading(false)
  }

  // ── Mutations ─────────────────────────────────────────

  async function addProyecto(data) {
    if (isDemo) {
      const nuevo = { ...data, id: `p${Date.now()}` }
      setProyectos(prev => [...prev, nuevo])
      return { data: nuevo, error: null }
    }
    const { data: row, error } = await supabase.from('eco_proyectos').insert(data).select().single()
    if (!error) setProyectos(prev => [...prev, row])
    return { data: row, error }
  }

  async function updateProyecto(id, patch) {
    if (isDemo) {
      setProyectos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
      return { error: null }
    }
    const { error } = await supabase.from('eco_proyectos').update(patch).eq('id', id)
    if (!error) setProyectos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    return { error }
  }

  async function deleteProyecto(id) {
    if (isDemo) {
      setProyectos(prev => prev.filter(p => p.id !== id))
      setEntradas(prev => prev.filter(e => e.proyecto_id !== id))
      return { error: null }
    }
    const { error } = await supabase.from('eco_proyectos').delete().eq('id', id)
    if (!error) { setProyectos(prev => prev.filter(p => p.id !== id)); setEntradas(prev => prev.filter(e => e.proyecto_id !== id)) }
    return { error }
  }

  async function saveEntradas(proyectoId, anio, grid) {
    // grid = { 'facturacion-1': 1000, 'coste_personal-2': 500, ... }
    const upserts = []
    const cats = ['facturacion','coste_personal','gastos_personal','produccion','plan_medios']
    cats.forEach(cat => {
      for (let mes = 1; mes <= 12; mes++) {
        upserts.push({ proyecto_id: proyectoId, anio, mes, categoria: cat, importe: grid[`${cat}-${mes}`] || 0 })
      }
    })

    if (isDemo) {
      setEntradas(prev => {
        const filtered = prev.filter(e => !(e.proyecto_id === proyectoId && e.anio === anio))
        const newEntries = upserts.filter(u => u.importe !== 0)
        return [...filtered, ...newEntries]
      })
      return { error: null }
    }
    const { error } = await supabase.from('eco_entradas')
      .upsert(upserts, { onConflict: 'proyecto_id,anio,mes,categoria' })
    if (!error) {
      setEntradas(prev => {
        const filtered = prev.filter(e => !(e.proyecto_id === proyectoId && e.anio === anio))
        return [...filtered, ...upserts.filter(u => u.importe !== 0)]
      })
    }
    return { error }
  }

  function getEntradasProyecto(proyectoId, anio) {
    return entradas.filter(e => e.proyecto_id === proyectoId && e.anio === anio)
  }

  function resetToDemo() {
    localStorage.removeItem('ecofin_proyectos')
    localStorage.removeItem('ecofin_entradas')
    setProyectos(DEMO_PROYECTOS)
    setEntradas(DEMO_ENTRADAS)
  }

  return (
    <DataContext.Provider value={{
      proyectos, entradas, loading, isDemo,
      addProyecto, updateProyecto, deleteProyecto, saveEntradas, getEntradasProyecto,
      resetToDemo,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
