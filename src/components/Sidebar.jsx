import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Briefcase, TrendingUp,
  Receipt, CreditCard, Bell, LogOut, X, BarChart3, Sparkles
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',       end: true },
  { to: '/clientes',  icon: Users,           label: 'Clientes'         },
  { to: '/servicios', icon: Briefcase,       label: 'Servicios'        },
  { to: '/cobros',    icon: CreditCard,      label: 'Cuentas x Cobrar' },
  { to: '/ingresos',  icon: TrendingUp,      label: 'Ingresos'         },
  { to: '/gastos',    icon: Receipt,         label: 'Gastos'           },
  { to: '/reportes',  icon: BarChart3,       label: 'Reportes'         },
  { to: '/alertas',   icon: Bell,            label: 'Alertas'          },
]

export default function Sidebar({ open, onClose }) {
  const { user, alertasCount, addToast } = useStore()
  const inicial = (user?.email || 'U')[0].toUpperCase()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    addToast('Sesión cerrada correctamente', 'info')
  }

  return (
    <aside className={`
      fixed lg:static inset-y-0 left-0 z-30
      w-64 glass lg:bg-ink-900/40 border-r border-white/[0.06]
      flex flex-col transition-transform duration-300 ease-in-out
      ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center shadow-glow-indigo"
               style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-[15px] tracking-tight text-slate-100">
              Finanzas<span className="text-gradient">Pro</span>
            </p>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.18em]">Suite Financiera</p>
          </div>
        </div>
        <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-500/[0.12] text-brand-300'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-brand-400 to-brand-600" />
                )}
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {label === 'Alertas' && alertasCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                    {alertasCount > 9 ? '9+' : alertasCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
               style={{ backgroundImage: 'linear-gradient(135deg, #34d399, #0d9488)' }}>
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.email}</p>
            <p className="text-[10px] text-slate-500">Administrador</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
