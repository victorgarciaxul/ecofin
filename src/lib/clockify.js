const BASE    = 'https://api.clockify.me/api/v1'
const REPORTS = 'https://reports.api.clockify.me/v1'

const DEFAULT_KEY = 'NjU5NzQ4NjQtOTRjNC00MjRiLWIwYzMtYjFkNDY0MGNiN2E0'

export function getKey()    { return localStorage.getItem('clockify_key') || DEFAULT_KEY }
export function saveKey(k)  { localStorage.setItem('clockify_key', k) }

function h() {
  return { 'X-Api-Key': getKey(), 'Content-Type': 'application/json' }
}

async function req(url, opts = {}) {
  const r = await fetch(url, { headers: h(), ...opts })
  if (!r.ok) {
    const msg = await r.json().catch(() => ({}))
    throw new Error(msg?.message || `Error ${r.status}`)
  }
  return r.json()
}

export const getUser       = ()        => req(`${BASE}/user`)
export const getWorkspaces = ()        => req(`${BASE}/workspaces`)
export const getProjects   = (wid)     => req(`${BASE}/workspaces/${wid}/projects?page-size=500&archived=false`)

function summaryReport(wid, start, end, groups) {
  return req(`${REPORTS}/workspaces/${wid}/reports/summary`, {
    method: 'POST',
    body: JSON.stringify({
      dateRangeStart:  start,
      dateRangeEnd:    end,
      summaryFilter:   { groups, sortColumn: 'DURATION' },
      sortOrder:       'DESCENDING',
      amountShownType: 'HIDE_AMOUNT',
    }),
  })
}

export const getSummaryByUser    = (wid, s, e) => summaryReport(wid, s, e, ['USER',    'PROJECT'])
export const getSummaryByProject = (wid, s, e) => summaryReport(wid, s, e, ['PROJECT', 'USER'])
export const getSummaryByTask    = (wid, s, e) => summaryReport(wid, s, e, ['PROJECT', 'TASK'])
export const getUserGroups       = (wid)        => req(`${BASE}/workspaces/${wid}/userGroups`)
