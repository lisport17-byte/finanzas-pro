import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase, TrendingUp,
  Receipt, CreditCard, Bell, LogOut, DollarSign, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',     end: true },
  { to: '/clientes',  icon: Users,           label: 'Clientes'              },
  { to: '/servicios', icon: Briefcase,        label: 'Servicios'             },
  { to: '/cobros',    icon: CreditCard,       label: 'Cuentas x Cobrar'      },
  { to: '/ingresos',  icon: TrendingUp,       label: 'Ingresos'              },
  { to: '/gastos',    icon: Receipt,          label: 'Gastos'                },
  { to: '/alertas',   icon: Bell,             label: 'Alertas'               },
]

export default function Sidebar({ open, onClose }) {
  const { user, alertasCount, addToast } = useStore()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    addToast('Sesión cerrada correctamente', 'info')
  }

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-30
      w-64 bg-slate-900 border-r border-slate-800
      flex flex-col transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">FinanzasPro</p>
            <p className="text-xs text-slate-500">Control Empresarial</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {label === 'Alertas' && alertasCount > 0 && (
              <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-red-600 text-white rounded-full">
                {alertasCount > 9 ? '9+' : alertasCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-medium text-slate-300 truncate">{user?.email}</p>
          <p className="text-xs text-slate-500">Administrador</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
