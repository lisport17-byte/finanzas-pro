import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { proyeccion, UMBRALES } from '../lib/queries'
import useStore from '../store/useStore'
import { fmtUSD, MESES_CORTOS, MESES_LARGOS } from '../lib/format'
import {
  ShieldCheck, ShieldAlert, ShieldX, TrendingUp, Wallet, Landmark, Gauge,
  AlertTriangle, Info, Lightbulb, ArrowRight, CalendarClock, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

const SEMAFORO = {
  verde:    { icono: ShieldCheck, texto: 'text-emerald-400', fondo: 'rgba(16,185,129,0.15)', borde: 'border-emerald-500/30', chip: 'bg-emerald-500/15 text-emerald-300' },
  amarillo: { icono: ShieldAlert, texto: 'text-amber-400',   fondo: 'rgba(245,158,11,0.15)', borde: 'border-amber-500/30',  chip: 'bg-amber-500/15 text-amber-300' },
  rojo:     { icono: ShieldX,     texto: 'text-red-400',     fondo: 'rgba(239,68,68,0.15)',  borde: 'border-red-500/30',    chip: 'bg-red-500/15 text-red-300' },
}

const REC_ESTILO = {
  critico: { icono: AlertTriangle, color: 'text-red-400',     borde: 'border-red-500/25',     fondo: 'bg-red-500/[0.06]' },
  aviso:   { icono: AlertTriangle, color: 'text-amber-400',   borde: 'border-amber-500/25',   fondo: 'bg-amber-500/[0.06]' },
  ok:      { icono: Lightbulb,     color: 'text-emerald-400', borde: 'border-emerald-500/25', fondo: 'bg-emerald-500/[0.06]' },
  info:    { icono: Info,          color: 'text-brand-300',   borde: 'border-brand-500/25',   fondo: 'bg-brand-500/[0.06]' },
}

/** Medidor con zonas de referencia (verde/amarillo/rojo) */
function Medidor({ titulo, valor, formato, pct, invertido = false, umbralSano, umbralMalo, ayuda }) {
  const clamp = Math.max(0, Math.min(100, pct))
  const color = invertido
    ? (pct <= umbralSano ? 'bg-emerald-500' : pct <= umbralMalo ? 'bg-amber-500' : 'bg-red-500')
    : (pct >= umbralSano ? 'bg-emerald-500' : pct >= umbralMalo ? 'bg-amber-500' : 'bg-red-500')
  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{titulo}</p>
        <p className="font-display text-lg font-bold text-slate-100 tabular">{formato}</p>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mt-2.5">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${clamp}%` }} />
      </div>
      <p className="text-[11px] text-slate-500 mt-2 leading-snug">{ayuda}</p>
    </div>
  )
}

function TooltipFlujo({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-2xl text-xs space-y-1.5">
      <p className="font-bold text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className={`font-bold ${Number(p.value) < 0 ? 'text-red-400' : 'text-slate-100'}`}>{fmtUSD(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function Proyeccion() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const { addToast } = useStore()

  const cargar = () => {
    setCargando(true)
    setError(null)
    proyeccion.analizar(6)
      .then(setDatos)
      .catch((err) => {
        setError(err?.message || 'No se pudo calcular la proyección')
        addToast('Error al calcular la proyección', 'error')
      })
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [])

  if (error) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4 opacity-70" />
        <h3 className="font-display text-lg font-bold text-slate-200">No se pudo calcular la proyección</h3>
        <p className="text-sm text-slate-500 mt-2 mb-6">{error}</p>
        <button onClick={cargar} className="btn-primary">Reintentar</button>
      </div>
    )
  }

  if (cargando || !datos) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-72" />
      </div>
    )
  }

  const { serie, indicadores: ind, semaforo, recomendaciones } = datos
  const est = SEMAFORO[semaforo.nivel]
  const IconoSemaforo = est.icono

  const datosGrafica = serie.map((b) => ({
    ...b,
    nombre: `${MESES_CORTOS[b.mes - 1]} ${String(b.anio).slice(2)}`,
  }))

  // Compromisos (cuotas) de los próximos meses, ordenados por fecha
  const compromisos = serie.flatMap((b) => b.compromisos).sort((a, b) => a.fecha.localeCompare(b.fecha))

  const dscrPct = ind.dscr === null ? 100 : (ind.dscr / (UMBRALES.DSCR_SANO * 1.5)) * 100
  const cargaPct = (ind.cargaDeuda / UMBRALES.CARGA_MAXIMA) * 100
  const gastoPct = ind.mrr > 0 ? (ind.gastoFijo / ind.mrr) * 100 : 0

  return (
    <div className="space-y-5">
      {/* Semáforo de endeudamiento */}
      <div className={`card relative overflow-hidden border ${est.borde}`}>
        <div className="absolute inset-0 opacity-60 pointer-events-none"
             style={{ backgroundImage: `radial-gradient(ellipse 70% 90% at 12% 0%, ${est.fondo}, transparent)` }} />
        <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
          <div className={`p-3 rounded-2xl flex-shrink-0 ${est.chip}`}>
            <IconoSemaforo className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
              ¿Puedo tomar más crédito?
            </p>
            <h2 className={`font-display text-xl sm:text-2xl font-extrabold mt-1 ${est.texto}`}>
              {semaforo.titulo}
            </h2>
            {semaforo.nivel !== 'rojo' && (
              <p className="text-sm text-slate-300 mt-2">
                Cuota nueva máxima recomendada:{' '}
                <b className="font-mono text-emerald-400">{fmtUSD(semaforo.cuotaMaximaSugerida)}</b> al mes
              </p>
            )}
            {semaforo.razones.length > 0 && (
              <ul className="mt-3 space-y-1">
                {semaforo.razones.map((r, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className={est.texto}>•</span>
                    <span className="first-letter:uppercase">{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={cargar} className="btn-secondary !py-2 text-xs flex-shrink-0" title="Recalcular">
            <RefreshCw className="w-3.5 h-3.5" /> Recalcular
          </button>
        </div>
      </div>

      {/* Indicadores clave */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Flujo libre</p>
              <p className={`font-display text-2xl font-bold mt-1 tabular ${ind.capacidadPago >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUSD(ind.capacidadPago)}
              </p>
              <p className="text-xs text-slate-500 mt-1">recurrente − gastos fijos</p>
            </div>
            <div className="p-2.5 rounded-xl border bg-emerald-500/[0.12] text-emerald-400 border-emerald-500/20 flex-shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Cuotas del mes</p>
              <p className="font-display text-2xl font-bold mt-1 tabular text-red-400">{fmtUSD(ind.servicioDeuda)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {ind.creditosActivos} crédito{ind.creditosActivos === 1 ? '' : 's'} · deuda {fmtUSD(ind.deudaTotal)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border bg-red-500/[0.12] text-red-400 border-red-500/20 flex-shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Ingreso recurrente</p>
              <p className="font-display text-2xl font-bold mt-1 tabular text-slate-100">{fmtUSD(ind.mrr)}</p>
              <p className="text-xs text-slate-500 mt-1">MRR de servicios activos</p>
            </div>
            <div className="p-2.5 rounded-xl border bg-cyan-500/[0.12] text-cyan-400 border-cyan-500/20 flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Margen para deuda</p>
              <p className={`font-display text-2xl font-bold mt-1 tabular ${ind.capacidadAdicional > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUSD(ind.capacidadAdicional)}
              </p>
              <p className="text-xs text-slate-500 mt-1">cuota adicional segura</p>
            </div>
            <div className="p-2.5 rounded-xl border bg-brand-500/[0.12] text-brand-300 border-brand-500/20 flex-shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Medidores de salud */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Medidor
          titulo="Cobertura de deuda (DSCR)"
          formato={ind.dscr === null ? 'Sin deuda' : `${ind.dscr.toFixed(2)}×`}
          pct={dscrPct}
          umbralSano={(UMBRALES.DSCR_SANO / (UMBRALES.DSCR_SANO * 1.5)) * 100}
          umbralMalo={(UMBRALES.DSCR_MINIMO / (UMBRALES.DSCR_SANO * 1.5)) * 100}
          ayuda={`Cuántas veces tu flujo libre cubre las cuotas. Sano ≥ ${UMBRALES.DSCR_SANO}× · riesgo < ${UMBRALES.DSCR_MINIMO}×`}
        />
        <Medidor
          titulo="Carga de deuda"
          formato={`${(ind.cargaDeuda * 100).toFixed(0)}%`}
          pct={cargaPct}
          invertido
          umbralSano={(UMBRALES.CARGA_SANA / UMBRALES.CARGA_MAXIMA) * 100}
          umbralMalo={100}
          ayuda={`Cuotas sobre ingreso recurrente. Recomendado ≤ ${UMBRALES.CARGA_SANA * 100}% · límite ${UMBRALES.CARGA_MAXIMA * 100}%`}
        />
        <Medidor
          titulo="Peso de gastos fijos"
          formato={`${gastoPct.toFixed(0)}%`}
          pct={gastoPct}
          invertido
          umbralSano={50}
          umbralMalo={70}
          ayuda={`${fmtUSD(ind.gastoFijo)}/mes de gastos recurrentes sobre tu ingreso recurrente`}
        />
      </div>

      {/* Proyección de flujo */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-200">Proyección de Flujo de Caja — 6 meses</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cobros comprometidos y renovaciones esperadas vs gastos fijos y cuotas · análisis en USD
            </p>
          </div>
          <Link to="/reportes" className="text-xs text-brand-300 hover:text-brand-100 hidden sm:flex items-center gap-1 font-medium">
            Ver histórico <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datosGrafica} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                     tickFormatter={(v) => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={52} />
              <Tooltip content={<TooltipFlujo />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="ingresos" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="egresos" name="Egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="acumulado" name="Caja acumulada" stroke="#6366f1" strokeWidth={2.5}
                    dot={{ r: 3, strokeWidth: 0, fill: '#6366f1' }} activeDot={{ r: 5, strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detalle mes a mes */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="font-display text-sm font-bold text-slate-200">Mes a Mes</h3>
          <p className="text-xs text-slate-500 mt-0.5">Los meses en rojo son los que debes resolver antes de endeudarte</p>
        </div>
        {/* Móvil */}
        <div className="sm:hidden divide-y divide-white/[0.06]">
          {serie.map((b) => (
            <div key={b.clave} className={`p-4 space-y-2 ${b.acumulado < 0 ? 'bg-red-500/[0.05]' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-200 capitalize">{MESES_LARGOS[b.mes - 1]} {b.anio}</p>
                <span className={`font-mono font-bold ${b.flujo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtUSD(b.flujo)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="text-slate-500">Ingresos: <span className="font-mono text-slate-300">{fmtUSD(b.ingresos)}</span></p>
                <p className="text-slate-500">Egresos: <span className="font-mono text-slate-300">{fmtUSD(b.egresos)}</span></p>
                <p className="text-slate-500">Cuotas: <span className="font-mono text-slate-300">{fmtUSD(b.cuotas)}</span></p>
                <p className="text-slate-500">Caja: <span className={`font-mono ${b.acumulado >= 0 ? 'text-brand-300' : 'text-red-400'}`}>{fmtUSD(b.acumulado)}</span></p>
              </div>
            </div>
          ))}
        </div>
        {/* Escritorio */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="table-head text-left">Mes</th>
                <th className="table-head text-right">Por cobrar</th>
                <th className="table-head text-right">Renovaciones</th>
                <th className="table-head text-right">Gastos fijos</th>
                <th className="table-head text-right">Cuotas</th>
                <th className="table-head text-right">Flujo</th>
                <th className="table-head text-right">Caja acumulada</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((b) => (
                <tr key={b.clave} className={`table-row ${b.acumulado < 0 ? 'bg-red-500/[0.05]' : ''}`}>
                  <td className="table-cell font-medium text-slate-200 capitalize">
                    {MESES_LARGOS[b.mes - 1]} {b.anio}
                    {b.cobrado > 0 && <span className="block text-[10px] text-slate-500">cobrado: {fmtUSD(b.cobrado)}</span>}
                  </td>
                  <td className="table-cell text-right font-mono text-amber-400">{fmtUSD(b.porCobrar)}</td>
                  <td className="table-cell text-right font-mono text-slate-400">{fmtUSD(b.recurrente)}</td>
                  <td className="table-cell text-right font-mono text-slate-400">{fmtUSD(b.gastos)}</td>
                  <td className="table-cell text-right font-mono text-red-400">{fmtUSD(b.cuotas)}</td>
                  <td className={`table-cell text-right font-mono font-bold ${b.flujo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmtUSD(b.flujo)}
                  </td>
                  <td className={`table-cell text-right font-mono font-bold ${b.acumulado >= 0 ? 'text-brand-300' : 'text-red-400'}`}>
                    {fmtUSD(b.acumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold text-slate-200 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" /> Recomendaciones
        </h3>
        {recomendaciones.map((r, i) => {
          const e = REC_ESTILO[r.nivel] || REC_ESTILO.info
          const Icono = e.icono
          return (
            <div key={i} className={`rounded-2xl border p-4 flex gap-3 ${e.borde} ${e.fondo}`}>
              <Icono className={`w-5 h-5 flex-shrink-0 mt-0.5 ${e.color}`} />
              <div className="min-w-0">
                <p className={`text-sm font-bold ${e.color}`}>{r.titulo}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{r.texto}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Calendario de cuotas */}
      {compromisos.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-slate-200 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-brand-300" /> Cuotas Programadas
            </h3>
            <Link to="/creditos" className="text-xs text-brand-300 hover:text-brand-100 flex items-center gap-1 font-medium">
              Ver créditos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {compromisos.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40">
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{c.acreedor}</p>
                  <p className="text-xs text-slate-500">
                    Cuota {c.cuota}/{c.total} · {format(new Date(c.fecha + 'T00:00:00'), "dd 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-red-400 whitespace-nowrap">
                  {c.moneda === 'USD' ? fmtUSD(c.monto) : `Bs.${Number(c.monto).toFixed(2)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
