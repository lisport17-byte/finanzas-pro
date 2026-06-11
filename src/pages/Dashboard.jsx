import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerResumenDashboard, reportes } from '../lib/queries'
import useStore from '../store/useStore'
import { fmtUSD, MESES_CORTOS } from '../lib/format'
import {
  Users, TrendingUp, TrendingDown, DollarSign, Repeat,
  AlertTriangle, Clock, ArrowRight, ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

const COLORES_CATEGORIA = ['#6366f1', '#34d399', '#f59e0b', '#f43f5e', '#38bdf8', '#a78bfa']

function DeltaBadge({ actual, anterior }) {
  if (!anterior) return null
  const pct = ((actual - anterior) / anterior) * 100
  const positivo = pct >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
      positivo ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
    }`}>
      {positivo ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function StatCard({ titulo, valor, subtitulo, icono: Icon, color, delta }) {
  const colores = {
    indigo:  'bg-brand-500/[0.12] text-brand-300 border-brand-500/20',
    emerald: 'bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20',
    red:     'bg-red-500/[0.12] text-red-400 border-red-500/20',
    amber:   'bg-amber-500/[0.12] text-amber-400 border-amber-500/20',
    cyan:    'bg-cyan-500/[0.12] text-cyan-400 border-cyan-500/20',
  }
  return (
    <div className="card card-hover flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider truncate">{titulo}</p>
        <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
          <p className="font-display text-2xl font-bold text-slate-100 tabular">{valor}</p>
          {delta}
        </div>
        {subtitulo && <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>}
      </div>
      <div className={`p-2.5 rounded-xl border flex-shrink-0 ${colores[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  )
}

function TooltipGrafica({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-2xl text-xs space-y-1.5">
      <p className="font-bold text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400 capitalize">{p.name}:</span>
          <span className="font-bold text-slate-100">{fmtUSD(p.value)}</span>
        </p>
      ))}
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
  const [serie, setSerie] = useState([])
  const [categorias, setCategorias] = useState([])
  const [topClientes, setTopClientes] = useState([])
  const [mrrInfo, setMrrInfo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const setAlertasCount = useStore((s) => s.setAlertasCount)

  const cargar = () => {
    setCargando(true)
    setError(null)
    const hoy = new Date()
    Promise.all([
      obtenerResumenDashboard(),
      reportes.serieMensual(12),
      reportes.gastosPorCategoria(hoy.getMonth() + 1, hoy.getFullYear()),
      reportes.topClientes(12, 5),
      reportes.mrr(),
    ]).then(([d, s, cat, top, m]) => {
      setDatos(d)
      setSerie(s.map((p) => ({ ...p, nombre: `${MESES_CORTOS[p.mes - 1]} ${String(p.anio).slice(2)}` })))
      setCategorias(cat)
      setTopClientes(top)
      setMrrInfo(m)
      setAlertasCount(d.serviciosVencer.length + d.serviciosVencidos.length)
      setCargando(false)
    }).catch((err) => {
      console.error('Error cargando dashboard:', err)
      setError(err?.message || 'No se pudo conectar con la base de datos')
      setCargando(false)
    })
  }

  useEffect(() => { cargar() }, [setAlertasCount])

  if (error) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4 opacity-70" />
        <h3 className="font-display text-lg font-bold text-slate-200">No se pudieron cargar los datos</h3>
        <p className="text-sm text-slate-500 mt-2 mb-6">{error}</p>
        <button onClick={cargar} className="btn-primary">Reintentar</button>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-72" />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="skeleton h-60" /><div className="skeleton h-60" />
        </div>
      </div>
    )
  }

  const mesAnterior = serie.length >= 2 ? serie[serie.length - 2] : null
  const maxTopCliente = topClientes[0]?.total || 1
  const totalCategorias = categorias.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          titulo="Ingresos del mes"
          valor={fmtUSD(datos.totalIngresosMes)}
          subtitulo="USD cobrados"
          icono={TrendingUp}
          color="emerald"
          delta={<DeltaBadge actual={datos.totalIngresosMes} anterior={mesAnterior?.ingresos} />}
        />
        <StatCard
          titulo="Gastos del mes"
          valor={fmtUSD(datos.totalGastosMes)}
          subtitulo="pagados + pendientes"
          icono={TrendingDown}
          color="red"
          delta={<DeltaBadge actual={datos.totalGastosMes} anterior={mesAnterior?.gastos} />}
        />
        <StatCard
          titulo="Por cobrar"
          valor={fmtUSD(datos.totalCobrar)}
          subtitulo="notas pendientes"
          icono={DollarSign}
          color="amber"
        />
        <StatCard
          titulo="Ingreso recurrente"
          valor={fmtUSD(mrrInfo?.mrr || 0)}
          subtitulo={`MRR · ${mrrInfo?.serviciosActivos || 0} servicios activos`}
          icono={Repeat}
          color="cyan"
        />
      </div>

      {/* Utilidad + clientes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40 pointer-events-none"
               style={{ backgroundImage: `radial-gradient(ellipse 60% 80% at 15% 0%, ${datos.utilidadMes >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}, transparent)` }} />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Utilidad neta del mes</p>
              <p className={`font-display text-4xl font-extrabold mt-2 tabular ${datos.utilidadMes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUSD(datos.utilidadMes)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Margen: {datos.totalIngresosMes > 0 ? `${((datos.utilidadMes / datos.totalIngresosMes) * 100).toFixed(1)}%` : '—'} · Ingresos − Gastos
              </p>
            </div>
            <Wallet className={`w-16 h-16 ${datos.utilidadMes >= 0 ? 'text-emerald-500' : 'text-red-500'} opacity-20`} />
          </div>
        </div>
        <StatCard
          titulo="Clientes activos"
          valor={datos.clientesActivos}
          subtitulo={`de ${datos.totalClientes} totales`}
          icono={Users}
          color="indigo"
        />
      </div>

      {/* Tendencia 12 meses */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-200">Flujo de Caja — últimos 12 meses</h3>
            <p className="text-xs text-slate-500 mt-0.5">Ingresos vs gastos en USD</p>
          </div>
          <Link to="/reportes" className="text-xs text-brand-300 hover:text-brand-100 flex items-center gap-1 font-medium">
            Ver reportes <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                     tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={52} />
              <Tooltip content={<TooltipGrafica />} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#34d399" strokeWidth={2.5}
                    fill="url(#gradIngresos)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f43f5e" strokeWidth={2}
                    fill="url(#gradGastos)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Categorías de gasto + Top clientes */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Donut gastos por categoría */}
        <div className="card">
          <h3 className="font-display text-sm font-bold text-slate-200 mb-1">Gastos por Categoría</h3>
          <p className="text-xs text-slate-500 mb-4">Mes actual</p>
          {categorias.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">Sin gastos registrados este mes</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-36 h-36 flex-shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categorias} dataKey="total" nameKey="categoria"
                         innerRadius={42} outerRadius={64} paddingAngle={3} strokeWidth={0}>
                      {categorias.map((c, i) => (
                        <Cell key={c.categoria} fill={COLORES_CATEGORIA[i % COLORES_CATEGORIA.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<TooltipGrafica />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-slate-500 uppercase">Total</p>
                  <p className="text-sm font-bold tabular">{fmtUSD(totalCategorias)}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {categorias.map((c, i) => (
                  <div key={c.categoria} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: COLORES_CATEGORIA[i % COLORES_CATEGORIA.length] }} />
                    <span className="text-slate-400 capitalize flex-1 truncate">{c.categoria}</span>
                    <span className="font-bold text-slate-200 tabular">{fmtUSD(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div className="card">
          <h3 className="font-display text-sm font-bold text-slate-200 mb-1">Top Clientes</h3>
          <p className="text-xs text-slate-500 mb-4">Por ingresos · últimos 12 meses</p>
          {topClientes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">Aún no hay ingresos registrados</p>
          ) : (
            <div className="space-y-3.5">
              {topClientes.map((c, i) => (
                <div key={c.nombre}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium truncate flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400">
                        {i + 1}
                      </span>
                      {c.nombre}
                    </span>
                    <span className="font-bold text-slate-100 tabular">{fmtUSD(c.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{
                           width: `${(c.total / maxTopCliente) * 100}%`,
                           backgroundImage: 'linear-gradient(90deg, #6366f1, #34d399)',
                         }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alertas */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Próximos a vencer */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Próximos a Vencer (10 días)
            </h3>
            <Link to="/alertas" className="text-xs text-brand-300 hover:text-brand-100 flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {datos.serviciosVencer.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">✓ Sin vencimientos próximos</p>
          ) : (
            <div className="space-y-1">
              {datos.serviciosVencer.map((s) => {
                const { label, clase } = diaRestante(s.fecha_renovacion)
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.05] last:border-0">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{s.clientes?.nombre}</p>
                      <p className="text-xs text-slate-500">{s.nombre_servicio}</p>
                    </div>
                    <span className={`text-xs font-medium ${clase}`}>{label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Servicios vencidos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Servicios Vencidos
            </h3>
            <Link to="/alertas" className="text-xs text-brand-300 hover:text-brand-100 flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {datos.serviciosVencidos.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">✓ Sin servicios vencidos</p>
          ) : (
            <div className="space-y-1">
              {datos.serviciosVencidos.map((s) => {
                const dias = Math.abs(differenceInDays(new Date(s.fecha_renovacion + 'T00:00:00'), new Date()))
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] border-b border-white/[0.05] last:border-0">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{s.clientes?.nombre}</p>
                      <p className="text-xs text-slate-500">{s.nombre_servicio}</p>
                    </div>
                    <span className="text-xs font-medium text-red-400">Vencido {dias}d</span>
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
