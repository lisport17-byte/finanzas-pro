import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { inicializarDatos } from './lib/queries'
import useStore from './store/useStore'

// Componentes
import Layout from './components/Layout'
import Toast from './components/Toast'
import RestablecerClave from './components/RestablecerClave'
import BloqueoBiometrico from './components/BloqueoBiometrico'
import { biometria } from './lib/biometria'

// Páginas
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Servicios from './pages/Servicios'
import Ingresos from './pages/Ingresos'
import Gastos from './pages/Gastos'
import NotasPago from './pages/NotasPago'
import Alertas from './pages/Alertas'
import Reportes from './pages/Reportes'

function ProtectedRoute({ children }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, setUser, toasts, removeToast } = useStore()
  const [loading, setLoading] = useState(true)
  // Recuperación de contraseña: se activa al llegar desde el enlace del correo
  const [recuperando, setRecuperando] = useState(false)
  // Candado biométrico: si está activado, pide la huella al abrir la app
  const [bloqueado, setBloqueado] = useState(biometria.estaActiva())

  useEffect(() => {
    // Timeout de seguridad: si getSession tarda más de 8s, carga igual
    const timeout = setTimeout(() => setLoading(false), 8000)

    // Verificar sesión existente (NO llama inicializarDatos aquí para evitar duplicados)
    supabase.auth.getSession()
      .then(({ data }) => {
        if (data?.session?.user) {
          setUser(data.session.user)
        }
      })
      .catch(() => {}) // silenciar error de red
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })

    // Escuchar cambios de autenticación.
    // IMPORTANTE: nunca hacer await de llamadas a Supabase DENTRO de este callback —
    // la librería mantiene un lock mientras lo ejecuta y la llamada interna espera
    // ese mismo lock → deadlock que congela TODAS las consultas de la app.
    // setTimeout saca la llamada del callback y libera el lock primero.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user)
          // Llegó desde el enlace "¿Olvidaste tu contraseña?" del correo
          if (event === 'PASSWORD_RECOVERY') {
            setRecuperando(true)
            setBloqueado(false) // no pedir huella en medio de la recuperación
          }
          // Solo inicializar en el primer login real, no en cada recarga
          if (event === 'SIGNED_IN') {
            setTimeout(() => { inicializarDatos(session.user.id) }, 0)
          }
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [setUser])

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-glow-indigo animate-pulse"
               style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            <span className="text-white font-bold text-xl">F</span>
          </div>
          <p className="text-slate-400 text-sm">Cargando FinanzasPro...</p>
        </div>
      </div>
    )
  }

  // Pantalla de nueva contraseña (llegó desde el correo de recuperación)
  if (recuperando) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>
        <RestablecerClave onListo={() => setRecuperando(false)} />
      </>
    )
  }

  // Candado biométrico: pide la huella antes de mostrar los datos
  // (solo si hay sesión activa; si no, va directo al login normal)
  if (bloqueado && user) {
    return <BloqueoBiometrico onDesbloqueado={() => setBloqueado(false)} />
  }

  return (
    <HashRouter>
      {/* Toasts globales */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="servicios" element={<Servicios />} />
          <Route path="ingresos" element={<Ingresos />} />
          <Route path="gastos" element={<Gastos />} />
          <Route path="cobros" element={<NotasPago />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="alertas" element={<Alertas />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
