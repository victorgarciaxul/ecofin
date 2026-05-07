const BASE = 'https://api.trello.com/1'

export function getCreds() {
  return {
    key:   localStorage.getItem('trello_key')   || '',
    token: localStorage.getItem('trello_token') || '',
  }
}

export function saveCreds(key, token) {
  localStorage.setItem('trello_key', key)
  localStorage.setItem('trello_token', token)
}

export function clearCreds() {
  localStorage.removeItem('trello_key')
  localStorage.removeItem('trello_token')
}

async function req(path, params = {}) {
  const { key, token } = getCreds()
  if (!key || !token) throw new Error('Sin credenciales')
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('key', key)
  url.searchParams.set('token', token)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Trello ${res.status}: ${await res.text()}`)
  return res.json()
}

export const getMyBoards = () =>
  req('/members/me/boards', { fields: 'name,shortUrl,closed', filter: 'open' })

export async function loadBoard(boardId) {
  const [board, lists, cards, members] = await Promise.all([
    req(`/boards/${boardId}`, { fields: 'name,shortUrl' }),
    req(`/boards/${boardId}/lists`, { fields: 'name,pos', filter: 'open' }),
    req(`/boards/${boardId}/cards/open`, {
      fields: 'name,idList,due,dueComplete,idMembers,labels,url',
    }),
    req(`/boards/${boardId}/members`, { fields: 'fullName,username' }),
  ])
  return { board, lists, cards, members }
}
