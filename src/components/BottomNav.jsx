import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, TrendingUp, Receipt, BarChart3 } from 'lucide-react'

const items = [
  { to: '/',          icon: LayoutDashboard, label: 'Inicio',   end: true },
  { to: '/clientes',  icon: Users,           label: 'Clientes' },
  { to: '/ingresos',  icon: TrendingUp,      label: 'Ingresos' },
  { to: '/gastos',    icon: Receipt,         label: 'Gastos'   },
  { to: '/reportes',  icon: BarChart3,       label: 'Reportes' },
]

/** Barra de navegación inferior estilo app nativa — solo visible en móvil */
export default function BottomNav() {
  return (
    <nav
      className="lg:hidden glass border-t border-white/[0.08] flex items-stretch gap-1 px-2 pt-1.5 flex-shrink-0"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'text-brand-300' : 'text-slate-500 hover:text-slate-300'}`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`p-1 rounded-lg transition-all ${isActive ? 'bg-brand-500/[0.15]' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
