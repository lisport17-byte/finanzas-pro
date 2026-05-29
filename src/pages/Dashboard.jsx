import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerResumenDashboard } from '../lib/queries'
import useStore from '../store/useStore'
import {
  Users, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, Clock, CheckCircle, ArrowRight
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

function StatCard({ titulo, valor, subtitulo, icono: Icon, color }) {
  const colores = {
    indigo:  'bg-indigo-600/20 text-indigo-400 border-indigo-700/30',
    emerald: 'bg-emerald-600/20 text-emerald-400 border-emerald-700/30',
    red:     'bg-red-600/20 text-red-400 border-red-700/30',
    amber:   'bg-amber-600/20 text-amber-400 border-amber-700/30',
  }
  return (
    <div className="card flex items-start justify-between gap-4">
      <div>
        <p className="text-xs text-slate-400 font-medium">{titulo}</p>
        <p className="text-2xl font-bold text-slate-100 mt-1">{valor}</p>
        {subtitulo && <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>}
      </div>
      <div className={`p-2.5 rounded-lg border ${colores[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
}

function diaRestante(fecha) {
  const dias = differenceInDays(new Date(fecha + 'T00:00:00'), new Date())
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)}d`, clase: 'text-red-400' }
  if (dias === 0) return { label: 'Vence HOY', clase: 'text-red-400 font-bold' }
  if (dias <= 3) return { label: `${dias}d restantes`, clase: 'text-amber-400' }
  return { label: `${dias}d restantes`, clase: 'text-slate-400' }
}

export default function Dashboard() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const setAlertasCount = useStore((s) => s.setAlertasCount)

  useEffect(() => {
    obtenerResumenDashboard().then((d) => {
      setDatos(d)
      setAlertasCount(d.serviciosVencer.length + d.serviciosVencidos.length)
      setCargando(false)
    })
  }, [setAlertasCount])

  const mesActual = format(new Date(), 'MMMM yyyy', { locale: es })

  if (cargando) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="card h-24 animate-pulse bg-slate-800" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          titulo="Clientes Activos"
          valor={datos.clientesActivos}
          subtitulo={`de ${datos.totalClientes} totales`}
          icono={Users}
          color="indigo"
        />
        <StatCard
          titulo={`Ingresos ${mesActual}`}
          valor={`$${datos.totalIngresosMes.toFixed(2)}`}
          subtitulo="USD cobrados"
          icono={TrendingUp}
          color="emerald"
        />
        <StatCard
          titulo={`Gastos ${mesActual}`}
          valor={`$${datos.totalGastosMes.toFixed(2)}`}
          subtitulo="USD pagados/pendientes"
          icono={TrendingDown}
          color="red"
        />
        <StatCard
          titulo="Por Cobrar"
          valor={`$${datos.totalCobrar.toFixed(2)}`}
          subtitulo="notas pendientes"
          icono={DollarSign}
          color="amber"
        />
      </div>

      {/* Utilidad del mes */}
      <div className="card border-l-4 border-l-indigo-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Utilidad Neta del Mes</p>
            <p className={`text-3xl font-bold mt-1 ${datos.utilidadMes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ${datos.utilidadMes.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Ingresos − Gastos = Utilidad</p>
          </div>
          <CheckCircle className={`w-12 h-12 ${datos.utilidadMes >= 0 ? 'text-emerald-600' : 'text-red-600'} opacity-30`} />
        </div>
      </div>

      {/* Grids de alertas */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Próximos a vencer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Próximos a Vencer (10 días)
            </h3>
            <Link to="/alertas" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {datos.serviciosVencer.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">✓ Sin vencimientos próximos</p>
          ) : (
            <div className="space-y-2">
              {datos.serviciosVencer.map((s) => {
                const { label, clase } = diaRestante(s.fecha_renovacion)
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="text-sm text-slate-200">{s.clientes?.nombre}</p>
                      <p className="text-xs text-slate-500">{s.nombre_servicio}</p>
                    </div>
                    <span className={`text-xs ${clase}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Servicios vencidos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Servicios Vencidos
            </h3>
            <Link to="/alertas" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {datos.serviciosVencidos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">✓ Sin servicios vencidos</p>
          ) : (
            <div className="space-y-2">
              {datos.serviciosVencidos.map((s) => {
                const dias = Math.abs(differenceInDays(new Date(s.fecha_renovacion + 'T00:00:00'), new Date()))
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div>
                      <p className="text-sm text-slate-200">{s.clientes?.nombre}</p>
                      <p className="text-xs text-slate-500">{s.nombre_servicio}</p>
                    </div>
                    <span className="text-xs text-red-400">Vencido {dias}d</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
