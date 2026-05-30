import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { inicializarDatos } from './lib/queries'
import useStore from './store/useStore'

// Componentes
import Layout from './components/Layout'
import Toast from './components/Toast'

// Páginas
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import Servicios from './pages/Servicios'
import Ingresos from './pages/Ingresos'
import Gastos from './pages/Gastos'
import NotasPago from './pages/NotasPago'
import Alertas from './pages/Alertas'

function ProtectedRoute({ children }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { setUser, toasts, removeToast } = useStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sesión existente (NO llama inicializarDatos aquí para evitar duplicados)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
      }
      setLoading(false)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          // Solo inicializar en el primer login real, no en cada recarga
          if (event === 'SIGNED_IN') {
            await inicializarDatos(session.user.id)
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando FinanzasPro...</p>
        </div>
      </div>
    )
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
          <Route path="alertas" element={<Alertas />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
