import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const DEMO_EMAIL = 'pruebas@xul.es'
const DEMO_PASS  = 'Xul14$'
const DEMO_USER  = { id: 'demo', email: DEMO_EMAIL, user_metadata: { full_name: 'Demo Manager' } }

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const isDemo = !isSupabaseConfigured

  useEffect(() => {
    if (isDemo) {
      // SSO: si AppCenter pasa el email en la URL, autologin directo
      const params = new URLSearchParams(window.location.search)
      const ssoEmail = params.get('sso_email')
      if (ssoEmail) {
        const allowed = ['victorgarcia@xul.es','carlagarcia@xul.es','tech@xul.es','josecastillo@xul.es']
        if (allowed.includes(ssoEmail.toLowerCase())) {
          sessionStorage.setItem('demo_auth', '1')
          window.history.replaceState({}, '', window.location.pathname)
          setUser({ ...DEMO_USER, email: ssoEmail.toLowerCase() })
          setLoading(false)
          return
        }
      }
      // Only restore session if user previously authenticated in this tab/session
      const ok = sessionStorage.getItem('demo_auth')
      setUser(ok ? DEMO_USER : null)
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    if (isDemo) {
      await new Promise(r => setTimeout(r, 500))
      if (email === DEMO_EMAIL && password === DEMO_PASS) {
        sessionStorage.setItem('demo_auth', '1')
        setUser(DEMO_USER)
        return { error: null }
      }
      return { error: { message: 'Credenciales incorrectas.' } }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    if (isDemo) {
      sessionStorage.removeItem('demo_auth')
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
