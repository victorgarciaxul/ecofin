/**
 * POST /api/sso-login   { sso_token }  ->  { access_token, refresh_token }
 *
 * Convierte el token de un solo uso de AppCenter en una sesión REAL de Supabase
 * para EcoFin. Antes, la entrada por SSO solo marcaba un flag local y las
 * peticiones a la BD iban como rol `anon` (público) — por eso las tablas
 * eco_* estaban expuestas a cualquiera con la clave pública. Con una sesión
 * real, el usuario pasa a rol `authenticated` y RLS puede cerrar el acceso
 * anónimo sin dejar fuera a nadie.
 *
 * Mismo patrón, ya probado, que MyTicket y MyTrack.
 *
 * Variables de entorno necesarias en Vercel (proyecto ecofin):
 *   - VITE_SUPABASE_URL            (ya existe)
 *   - SUPABASE_SERVICE_ROLE_KEY    (NUEVA: clave secreta sb_secret_... del proyecto EcoFin)
 *   - APPCENTER_SSO_TOKEN          (NUEVA: clave anon del proyecto AppCenter, para /sso/verify)
 */
import { createClient } from '@supabase/supabase-js'

// Quién puede entrar a EcoFin (misma lista que tenía el frontend hardcodeada).
// La verificación de identidad la hace el token; esto solo restringe a quién
// se le concede sesión, exactamente igual que hoy.
const SSO_ALLOWED = [
  'victorgarcia@xul.es',
  'carlagarcia@xul.es',
  'josecastillo@xul.es',
  'inmaosuna@xul.es',
]

const APPCENTER_VERIFY = 'https://qwlebsymypgauydkqxem.supabase.co/functions/v1/sso/verify'

let _admin = null
function admin() {
  if (!_admin) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    _admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  }
  return _admin
}

export default async function handler(req, res) {
  // Diagnóstico temporal (no expone secretos: solo presencia y longitud).
  // Se retira tras confirmar la configuración.
  if (req.method === 'GET') {
    const t = process.env.APPCENTER_SSO_TOKEN || ''
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    return res.status(200).json({
      appcenter_token: { present: !!t, len: t.length, empieza: t.slice(0, 6), termina: t.slice(-6) },
      service_key:     { present: !!k, len: k.length, empieza: k.slice(0, 8) },
      supabase_url:    { present: !!u, valor: u },
    })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { sso_token } = req.body || {}
    if (!sso_token || typeof sso_token !== 'string') {
      return res.status(400).json({ error: 'Falta sso_token' })
    }

    // 1) Verificar el token contra AppCenter (server-to-server)
    const verifyRes = await fetch(APPCENTER_VERIFY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APPCENTER_SSO_TOKEN}`,
      },
      body: JSON.stringify({ sso_token }),
      signal: AbortSignal.timeout(10000),
    })
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'No se pudo verificar la sesión de AppCenter' })
    }
    const { valid, email } = await verifyRes.json()
    if (!valid || !email) {
      return res.status(401).json({ error: 'Token inválido o caducado' })
    }

    const emailLc = String(email).toLowerCase()
    if (!SSO_ALLOWED.includes(emailLc)) {
      return res.status(403).json({ error: 'Este usuario no tiene acceso a EcoFin' })
    }

    const sb = admin()

    // 2) Localizar (o crear) el usuario en la BD de EcoFin.
    //    Necesario porque hoy entran sin sesión real: p.ej. inmaosuna aún no existe.
    const { data: list, error: listErr } = await sb.auth.admin.listUsers()
    if (listErr) return res.status(500).json({ error: 'No se pudo consultar usuarios' })
    let user = list?.users?.find(u => u.email?.toLowerCase() === emailLc)

    if (!user) {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email: emailLc,
        email_confirm: true,
        user_metadata: { full_name: emailLc.split('@')[0] },
      })
      if (createErr || !created?.user) {
        return res.status(500).json({ error: `No se pudo crear el usuario: ${createErr?.message ?? 'desconocido'}` })
      }
      user = created.user
    }

    // 3) Generar un enlace mágico y canjearlo server-side para obtener tokens reales
    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: 'magiclink',
      email: emailLc,
    })
    if (linkErr || !linkData?.properties?.hashed_token) {
      return res.status(500).json({ error: 'No se pudo generar la sesión' })
    }

    const { data: sessionData, error: otpErr } = await sb.auth.verifyOtp({
      type: 'magiclink',
      token_hash: linkData.properties.hashed_token,
    })
    if (otpErr || !sessionData?.session) {
      return res.status(500).json({ error: 'No se pudo canjear la sesión' })
    }

    return res.status(200).json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
  } catch (err) {
    return res.status(500).json({ error: err?.message ?? 'Error inesperado' })
  }
}
