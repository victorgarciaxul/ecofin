/**
 * MyTrack API client — reemplaza la conexión directa a Clockify.
 * Todos los datos de tiempo están en MyTrack (importados desde Clockify).
 *
 * Las respuestas tienen el mismo shape que la API de Clockify Reports
 * para que el resto del código de ECOFIN no necesite cambios.
 */

const BASE = import.meta.env.VITE_MYTRACK_API_URL || 'https://mytrack.xul.es/api'

async function req(url) {
  const r = await fetch(url)
  if (!r.ok) {
    const msg = await r.json().catch(() => ({}))
    throw new Error(msg?.error || `Error ${r.status}`)
  }
  return r.json()
}

export const getWorkspaces = () =>
  req(`${BASE}/workspaces`)

export const getProjects = (wsId, start, end) => {
  const params = new URLSearchParams({ workspace: wsId })
  if (start) params.set('start', start)
  if (end)   params.set('end',   end)
  return req(`${BASE}/projects?${params}`)
}

export const getSummaryByUser    = (wsId, start, end) =>
  req(`${BASE}/summary?workspace=${wsId}&by=user&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)

export const getSummaryByProject = (wsId, start, end) =>
  req(`${BASE}/summary?workspace=${wsId}&by=project&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)

export const getSummaryByTask    = (wsId, start, end) =>
  req(`${BASE}/summary?workspace=${wsId}&by=task&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)

export const getUserGroups = (wsId) =>
  req(`${BASE}/user-groups?workspace=${wsId}`)
