import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const DEMO_EMAIL = 'pruebas@xul.es'
const DEMO_PASS  = 'Xul14$'
const DEMO_USER  = { id: 'demo', email: DEMO_EMAIL, user_metadata: { full_name: 'Demo Manager' } }

// Acceso completo (pueden editar)
const FULL_ACCESS_EMAILS = ['victorgarcia@xul.es','carlagarcia@xul.es','tech@xul.es','josecastillo@xul.es']
// Solo lectura (pueden ver, no editar)
const READONLY_EMAILS = ['inmaosuna@xul.es']
// Todos los que pueden entrar vía SSO
const SSO_ALLOWED = [...FULL_ACCESS_EMAILS, ...READONLY_EMAILS]

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const isDemo = !isSupabaseConfigured

  useEffect(() => {
    let mounted = true
    const params   = new URLSearchParams(window.location.search)
    const ssoToken = params.get('sso_token')
    const ssoEmail = params.get('sso_email')

    // ── Modo demo (sin Supabase): SSO por email, como antes ──
    if (isDemo) {
      if (ssoEmail && SSO_ALLOWED.includes(ssoEmail.toLowerCase())) {
        sessionStorage.setItem('demo_auth', '1')
        window.history.replaceState({}, '', window.location.pathname)
        setUser({ ...DEMO_USER, email: ssoEmail.toLowerCase() })
      } else {
        const ok = sessionStorage.getItem('demo_auth')
        setUser(ok ? DEMO_USER : null)
      }
      setLoading(false)
      return
    }

    // ── Modo Supabase: sesión REAL ──
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_e, session) => {
        if (mounted) setUser(session?.user ?? null)
      })

    async function bootstrap() {
      // Si venimos de AppCenter con un token de un solo uso, canjearlo por
      // una sesión real de Supabase. La verificación del token y el permiso
      // de acceso los hace el endpoint /api/sso-login en el servidor.
      if (ssoToken) {
        let sessionOk = false
        try {
          const res = await fetch('/api/sso-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sso_token: ssoToken }),
          })
          if (res.ok) {
            const { access_token, refresh_token } = await res.json()
            const { error } = await supabase.auth.setSession({ access_token, refresh_token })
            sessionOk = !error
          }
        } catch (_) { /* red de seguridad abajo */ }
        window.history.replaceState({}, '', window.location.pathname)

        if (sessionOk) {
          const { data: { session } } = await supabase.auth.getSession()
          if (mounted) { setUser(session?.user ?? null); setLoading(false) }
          return
        }

      }

      // ¿Sesión real ya persistida (de un canje anterior)?
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        if (mounted) { setUser(session.user); setLoading(false) }
        return
      }

      // RED DE SEGURIDAD / compatibilidad: sin sesión real, pero venimos de
      // AppCenter con un email permitido (p.ej. el return_to que solo manda
      // sso_email sin token). Degradamos al comportamiento actual (entrar por
      // email) para NO quedar en bucle de redirección con App.jsx.
      // IMPORTANTE: mientras alguien entre por esta vía opera como anon, así
      // que NO debe activarse RLS (paso 4) hasta que todos tengan sesión real.
      if (ssoEmail && SSO_ALLOWED.includes(ssoEmail.toLowerCase())) {
        window.history.replaceState({}, '', window.location.pathname)
        if (mounted) { setUser({ ...DEMO_USER, email: ssoEmail.toLowerCase() }); setLoading(false) }
        return
      }

      if (mounted) { setUser(null); setLoading(false) }
    }
    bootstrap()

    return () => { mounted = false; subscription.unsubscribe() }
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

  const isReadOnly = !!user?.email && READONLY_EMAILS.includes(user.email.toLowerCase())

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, isReadOnly, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
