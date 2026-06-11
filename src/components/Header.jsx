import { Menu, Bell } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import useStore from '../store/useStore'

const titles = {
  '/':          'Dashboard',
  '/clientes':  'Clientes',
  '/servicios': 'Servicios',
  '/cobros':    'Cuentas por Cobrar',
  '/ingresos':  'Ingresos',
  '/gastos':    'Gastos',
  '/reportes':  'Reportes Financieros',
  '/alertas':   'Alertas & Vencimientos',
}

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const alertasCount = useStore((s) => s.alertasCount)
  const title = titles[pathname] || 'FinanzasPro'

  const hoy = new Date().toLocaleDateString('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <header className="glass border-b border-white/[0.06] px-4 md:px-6 h-16 flex items-center justify-between flex-shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-xl transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-slate-100">{title}</h1>
          <p className="text-[11px] text-slate-500 hidden sm:block capitalize">{hoy}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/alertas"
          className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] rounded-xl transition-colors"
        >
          <Bell className="w-5 h-5" />
          {alertasCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]">
              {alertasCount > 9 ? '9+' : alertasCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
