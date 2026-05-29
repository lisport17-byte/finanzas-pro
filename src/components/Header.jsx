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
    <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 h-14 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-100">{title}</h1>
          <p className="text-xs text-slate-500 hidden sm:block capitalize">{hoy}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/alertas"
          className="relative p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {alertasCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold bg-red-600 text-white rounded-full">
              {alertasCount > 9 ? '9+' : alertasCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
