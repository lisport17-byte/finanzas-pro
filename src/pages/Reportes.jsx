import { useEffect, useState } from 'react'
import { reportes } from '../lib/queries'
import { descargarCSV } from '../lib/export'
import { fmtUSD, MESES_CORTOS, MESES_LARGOS } from '../lib/format'
import useStore from '../store/useStore'
import { Download, TrendingUp, TrendingDown, Scale, Trophy } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'

function TooltipGrafica({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-4 py-3 shadow-2xl text-xs space-y-1.5">
      <p className="font-bold text-slate-300">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-slate-100">{fmtUSD(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function ResumenCard({ titulo, valor, subtitulo, icono: Icon, color }) {
  return (
    <div className="card card-hover">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{titulo}</p>
      </div>
      <p className={`font-display text-xl font-bold tabular ${color}`}>{valor}</p>
      {subtitulo && <p className="text-xs text-slate-500 mt-1">{subtitulo}</p>}
    </div>
  )
}

export default function Reportes() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [serie, setSerie] = useState([])
  const [cargando, setCargando] = useState(true)
  const addToast = useStore((s) => s.addToast)

  useEffect(() => {
    setCargando(true)
    reportes.serieAnio(anio).then((s) => {
      setSerie(s)
      setCargando(false)
    }).catch((err) => {
      console.error('Error cargando reportes:', err)
      addToast('No se pudieron cargar los reportes: ' + (err?.message || 'revisa tu conexión'), 'error')
      setSerie([])
      setCargando(false)
    })
  }, [anio, addToast])

  const totalIngresos = serie.reduce((s, m) => s + m.ingresos, 0)
  const totalGastos = serie.reduce((s, m) => s + m.gastos, 0)
  const utilidadAnual = totalIngresos - totalGastos
  const mesesConDatos = serie.filter((m) => m.ingresos > 0 || m.gastos > 0)
  const mejorMes = serie.reduce((mejor, m) => (m.utilidad > (mejor?.utilidad ?? -Infinity) ? m : mejor), null)

  // Acumulado para la tabla
  let acumulado = 0
  const filas = serie.map((m) => {
    acumulado += m.utilidad
    return { ...m, acumulado }
  })

  const datosGrafica = serie.map((m) => ({ ...m, nombre: MESES_CORTOS[m.mes - 1] }))

  const exportar = () => {
    descargarCSV(
      `libro-mayor-${anio}`,
      ['Mes', 'Ingresos USD', 'Gastos USD', 'Utilidad USD', 'Acumulado USD'],
      filas.map((f) => [
        MESES_LARGOS[f.mes - 1],
        f.ingresos.toFixed(2),
        f.gastos.toFixed(2),
        f.utilidad.toFixed(2),
        f.acumulado.toFixed(2),
      ]).concat([['TOTAL', totalIngresos.toFixed(2), totalGastos.toFixed(2), utilidadAnual.toFixed(2), '']])
    )
    addToast(`Libro mayor ${anio} exportado a CSV ✓`, 'success')
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-72" />
        <div className="skeleton h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Selector de año + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select className="input w-auto" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - 3 + i).map((y) => (
            <option key={y} value={y}>Año {y}</option>
          ))}
        </select>
        <button onClick={exportar} className="btn-secondary">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Resumen anual */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ResumenCard
          titulo="Ingresos del año"
          valor={fmtUSD(totalIngresos)}
          subtitulo={`${mesesConDatos.length} meses con actividad`}
          icono={TrendingUp}
          color="text-emerald-400"
        />
        <ResumenCard
          titulo="Gastos del año"
          valor={fmtUSD(totalGastos)}
          subtitulo={totalIngresos > 0 ? `${((totalGastos / totalIngresos) * 100).toFixed(0)}% de los ingresos` : null}
          icono={TrendingDown}
          color="text-red-400"
        />
        <ResumenCard
          titulo="Utilidad anual"
          valor={fmtUSD(utilidadAnual)}
          subtitulo={mesesConDatos.length > 0 ? `${fmtUSD(utilidadAnual / mesesConDatos.length)} promedio/mes` : null}
          icono={Scale}
          color={utilidadAnual >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <ResumenCard
          titulo="Mejor mes"
          valor={mejorMes && mejorMes.utilidad > 0 ? MESES_LARGOS[mejorMes.mes - 1] : '—'}
          subtitulo={mejorMes && mejorMes.utilidad > 0 ? `${fmtUSD(mejorMes.utilidad)} de utilidad` : 'Sin datos aún'}
          icono={Trophy}
          color="text-amber-400"
        />
      </div>

      {/* Gráfica anual */}
      <div className="card">
        <h3 className="font-display text-sm font-bold text-slate-200 mb-1">Comparativo Mensual {anio}</h3>
        <p className="text-xs text-slate-500 mb-5">Barras: ingresos y gastos · Línea: utilidad</p>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={datosGrafica} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                     tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={52} />
              <Tooltip content={<TooltipGrafica />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
              <Bar dataKey="ingresos" name="Ingresos" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={22} fillOpacity={0.85} />
              <Bar dataKey="gastos" name="Gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={22} fillOpacity={0.7} />
              <Line type="monotone" dataKey="utilidad" name="Utilidad" stroke="#818cf8" strokeWidth={2.5}
                    dot={{ r: 3, fill: '#818cf8', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Libro mayor — tabla mes a mes */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="font-display text-sm font-bold text-slate-200">Libro Mayor {anio}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Consolidado mes a mes en USD</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="table-head text-left">Mes</th>
                <th className="table-head text-right">Ingresos</th>
                <th className="table-head text-right">Gastos</th>
                <th className="table-head text-right">Utilidad</th>
                <th className="table-head text-right hidden sm:table-cell">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const esMesActual = anio === hoy.getFullYear() && f.mes === hoy.getMonth() + 1
                const sinDatos = f.ingresos === 0 && f.gastos === 0
                return (
                  <tr key={f.mes} className={`table-row ${esMesActual ? 'bg-brand-500/[0.06]' : ''}`}>
                    <td className="table-cell font-medium">
                      {MESES_LARGOS[f.mes - 1]}
                      {esMesActual && <span className="ml-2 text-[10px] font-bold text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded-md">ACTUAL</span>}
                    </td>
                    <td className={`table-cell text-right font-mono ${sinDatos ? 'text-slate-600' : 'text-emerald-400'}`}>
                      {sinDatos ? '—' : fmtUSD(f.ingresos)}
                    </td>
                    <td className={`table-cell text-right font-mono ${sinDatos ? 'text-slate-600' : 'text-red-400'}`}>
                      {sinDatos ? '—' : fmtUSD(f.gastos)}
                    </td>
                    <td className={`table-cell text-right font-mono font-semibold ${sinDatos ? 'text-slate-600' : f.utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sinDatos ? '—' : fmtUSD(f.utilidad)}
                    </td>
                    <td className={`table-cell text-right font-mono hidden sm:table-cell ${sinDatos ? 'text-slate-600' : 'text-slate-300'}`}>
                      {sinDatos ? '—' : fmtUSD(f.acumulado)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-white/[0.03]">
              <tr>
                <td className="px-4 py-4 text-xs font-bold text-slate-300 uppercase tracking-wider">Total {anio}</td>
                <td className="px-4 py-4 text-right font-mono font-bold text-emerald-400">{fmtUSD(totalIngresos)}</td>
                <td className="px-4 py-4 text-right font-mono font-bold text-red-400">{fmtUSD(totalGastos)}</td>
                <td className={`px-4 py-4 text-right font-mono font-bold ${utilidadAnual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtUSD(utilidadAnual)}
                </td>
                <td className="hidden sm:table-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
