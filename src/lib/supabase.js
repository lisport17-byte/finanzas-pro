import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Timeout global: ninguna petición puede colgarse indefinidamente.
// Si la red/BD no responde en 20s, falla con error claro en vez de spinner eterno.
const fetchConTimeout = (url, options = {}) => {
  const señal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(20000)
    : undefined
  return fetch(url, { ...options, signal: options.signal || señal })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: fetchConTimeout,
  },
})
