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

  function doExport(datos) {
    const p = datos?.proyectos ?? proyectos
    const e = datos?.entradas ?? entradas
    const data = { version: 1, exportDate: new Date().toISOString(), proyectos: p, entradas: e }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const now = new Date()
    const fecha = `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 5).replace(':', 'h')}`
    a.download = `ecofin_backup_${fecha}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    localStorage.setItem('ecofin_last_backup', Date.now().toString())
  }

  function exportData() { doExport() }

  // Auto-backup semanal: descarga automáticamente si han pasado 7+ días
  useEffect(() => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000
    const last = Number(localStorage.getItem('ecofin_last_backup') || '0')
    if (Date.now() - last >= WEEK_MS && proyectos.length > 0) {
      // Pequeño delay para no interferir con la carga inicial
      const timer = setTimeout(() => {
        doExport({ proyectos, entradas })
        console.log('🔄 Auto-backup semanal descargado')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, []) // solo al montar la app

  function importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (!data.proyectos || !Array.isArray(data.proyectos)) {
            reject(new Error('Archivo no válido: no contiene proyectos'))
            return
          }
          setProyectos(data.proyectos)
          setEntradas(data.entradas || [])
          resolve({ proyectos: data.proyectos.length, entradas: (data.entradas || []).length })
        } catch (err) {
          reject(new Error('Error al leer el archivo: ' + err.message))
        }
      }
      reader.onerror = () => reject(new Error('Error al leer el archivo'))
      reader.readAsText(file)
    })
  }

  return (
    <DataContext.Provider value={{
      proyectos, entradas, loading, isDemo,
      addProyecto, updateProyecto, deleteProyecto, saveEntradas, getEntradasProyecto,
      resetToDemo, exportData, importData,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
