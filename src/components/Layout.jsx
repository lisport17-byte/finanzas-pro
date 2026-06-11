import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import useStore from '../store/useStore'
import { facturacion } from '../lib/queries'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const { user, addToast } = useStore()
  const facturacionEjecutada = useRef(false)

  // Auto-facturación: al abrir la app genera las notas de cobro de los
  // servicios que vencen en los próximos 7 días (una vez por sesión)
  useEffect(() => {
    if (!user?.id || facturacionEjecutada.current) return
    facturacionEjecutada.current = true
    facturacion.generarNotasRenovacion(user.id, 7)
      .then(({ creadas }) => {
        if (creadas > 0) {
          addToast(
            `🧾 ${creadas} nota${creadas > 1 ? 's' : ''} de cobro generada${creadas > 1 ? 's' : ''} automáticamente por renovaciones próximas`,
            'info'
          )
        }
      })
      .catch(() => {}) // silencioso: no bloquear la app si falla
  }, [user, addToast])

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Overlay para móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main key={pathname} className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-up">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
