import { useEffect, useState } from 'react'
import { serviciosClientes as db, notasPago as dbNotas } from '../lib/queries'
import useStore from '../store/useStore'
import { fmtMonto } from '../lib/format'
import { push } from '../lib/push'
import { biometria } from '../lib/biometria'
import { AlertTriangle, Clock, PauseCircle, PlayCircle, Bell, CheckCircle, BellRing, Fingerprint } from 'lucide-react'
import { format, differenceInDays, addMonths, addYears } from 'date-fns'
import { es } from 'date-fns/locale'

function UrgenciaBadge({ dias }) {
  if (dias < 0) return <span className="badge-danger">Vencido {Math.abs(dias)}d</span>
  if (dias === 0) return <span className="badge-danger animate-pulse">HOY</span>
  if (dias <= 3) return <span className="badge-danger">{dias}d</span>
  if (dias <= 7) return <span className="badge-suspended">{dias}d</span>
  return <span className="badge-inactive">{dias}d</span>
}

export default function Alertas() {
  const [vencidos, setVencidos] = useState([])
  const [proximos, setProximos] = useState([])
  const [cargando, setCargando] = useState(true)
  const { addToast, setAlertasCount, user } = useStore()

  // Estado de notificaciones push y bloqueo con huella (por dispositivo)
  const [pushActivo, setPushActivo] = useState(false)
  const [pushOcupado, setPushOcupado] = useState(false)
  const [huellaActiva, setHuellaActiva] = useState(biometria.estaActiva())
  const [huellaDisponible, setHuellaDisponible] = useState(false)

  useEffect(() => {
    push.estaActivo().then(setPushActivo)
    biometria.disponible().then(setHuellaDisponible)
  }, [])

  const togglePush = async () => {
    setPushOcupado(true)
    const r = pushActivo ? await push.desactivar() : await push.activar(user.id)
    setPushOcupado(false)
    addToast(r.mensaje, r.ok ? 'success' : 'error')
    if (r.ok) setPushActivo(!pushActivo)
  }

  const toggleHuella = async () => {
    if (huellaActiva) {
      const r = biometria.desactivar()
      setHuellaActiva(false)
      addToast(r.mensaje, 'info')
    } else {
      const r = await biometria.activar(user)
      addToast(r.mensaje, r.ok ? 'success' : 'error')
      if (r.ok) setHuellaActiva(true)
    }
  }

  const cargar = async () => {
    setCargando(true)
    try {
      const [{ data: venc }, { data: prox }] = await Promise.all([
        db.obtenerVencidos(),
        db.obtenerProximosVencer(15),
      ])
      setVencidos(venc || [])
      setProximos(prox || [])
      setAlertasCount((venc?.length || 0) + (prox?.length || 0))
    } catch (err) {
      addToast('No se pudieron cargar las alertas: ' + (err?.message || 'revisa tu conexión'), 'error')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const suspender = async (s) => {
    await db.suspender(s.id)
    addToast(`Servicio de ${s.clientes?.nombre} suspendido`, 'warning')
    cargar()
  }

  const renovar = async (s) => {
    try {
      // Si aún no vence, el nuevo período arranca donde termina el actual
      // (contablemente correcto); si ya venció, arranca hoy.
      const vencimiento = new Date(s.fecha_renovacion + 'T00:00:00')
      const base = vencimiento >= new Date() ? vencimiento : new Date()
      const nueva = s.tipo_renovacion === 'mensual' ? addMonths(base, 1) : addYears(base, 1)
      const nuevaFecha = format(nueva, 'yyyy-MM-dd')

      const { error } = await db.reactivar(s.id, nuevaFecha)
      if (error) { addToast('Error al renovar: ' + error.message, 'error'); return }
      addToast(`Servicio renovado hasta ${format(nueva, 'dd MMM yyyy', { locale: es })} ✓`, 'success')

      // Nota de cobro automática por la renovación
      if (Number(s.precio) > 0 &&
          confirm(`¿Crear nota de cobro por ${fmtMonto(s.precio, s.moneda)} a ${s.clientes?.nombre}?`)) {
        const { error: errNota } = await dbNotas.crear({
          cliente_id: s.cliente_id,
          servicio_cliente_id: s.id,
          concepto: `Renovación ${s.tipo_renovacion} — ${s.nombre_servicio}`,
          monto: Number(s.precio),
          moneda: s.moneda,
          fecha_emision: format(new Date(), 'yyyy-MM-dd'),
          fecha_vencimiento: nuevaFecha,
          estado: 'pendiente',
          user_id: user.id,
        })
        if (errNota) addToast('Servicio renovado, pero falló la nota: ' + errNota.message, 'warning')
        else addToast('Nota de cobro creada — revísala en Cuentas x Cobrar ✓', 'success')
      }
      cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'inténtalo de nuevo'), 'error')
    }
  }

  const ServiceCard = ({ s, esVencido }) => {
    const dias = differenceInDays(new Date(s.fecha_renovacion + 'T00:00:00'), new Date())
    return (
      <div className={`card border-l-4 ${esVencido ? 'border-l-red-500' : dias <= 3 ? 'border-l-red-400' : dias <= 7 ? 'border-l-amber-400' : 'border-l-indigo-500'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-100">{s.clientes?.nombre}</h3>
              <UrgenciaBadge dias={dias} />
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                {s.tipos_servicio?.nombre || 'Servicio'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">{s.nombre_servicio}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Renovación: {format(new Date(s.fecha_renovacion + 'T00:00:00'), "dd 'de' MMMM, yyyy", { locale: es })}
              </span>
              {s.clientes?.email && (
                <span>{s.clientes.email}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {esVencido && (
              <button onClick={() => suspender(s)} className="btn-danger text-xs py-1.5">
                <PauseCircle className="w-3.5 h-3.5" /> Suspender
              </button>
            )}
            <button onClick={() => renovar(s)} className="btn-success text-xs py-1.5">
              <PlayCircle className="w-3.5 h-3.5" /> {esVencido ? 'Renovar y Reactivar' : 'Marcar Renovado'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="card h-24 animate-pulse bg-slate-800" />)}
      </div>
    )
  }

  const totalAlertas = vencidos.length + proximos.length

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card text-center py-3 border-l-4 border-l-red-500">
          <p className="text-3xl font-bold text-red-400">{vencidos.length}</p>
          <p className="text-xs text-slate-500">Servicios vencidos</p>
        </div>
        <div className="card text-center py-3 border-l-4 border-l-amber-400">
          <p className="text-3xl font-bold text-amber-400">{proximos.length}</p>
          <p className="text-xs text-slate-500">Por vencer (15 días)</p>
        </div>
        <div className="card text-center py-3 col-span-2 md:col-span-1">
          {totalAlertas === 0 ? (
            <>
              <p className="text-3xl font-bold text-emerald-400">✓</p>
              <p className="text-xs text-slate-500">Todo al día</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-300">{totalAlertas}</p>
              <p className="text-xs text-slate-500">Requieren atención</p>
            </>
          )}
        </div>
      </div>

      {/* Sin alertas */}
      {totalAlertas === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-slate-200">Todo al día</h3>
          <p className="text-slate-400 text-sm mt-1">No hay servicios vencidos ni próximos a vencer en los próximos 15 días</p>
        </div>
      )}

      {/* Servicios vencidos */}
      {vencidos.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Servicios vencidos — requieren acción inmediata ({vencidos.length})
          </h2>
          <div className="space-y-3">
            {vencidos.map(s => <ServiceCard key={s.id} s={s} esVencido={true} />)}
          </div>
        </div>
      )}

      {/* Próximos a vencer */}
      {proximos.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-3">
            <Bell className="w-4 h-4" />
            Próximos a vencer en 15 días ({proximos.length})
          </h2>
          <div className="space-y-3">
            {proximos.map(s => <ServiceCard key={s.id} s={s} esVencido={false} />)}
          </div>
        </div>
      )}

      {/* Configuración: avisos push y seguridad */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <BellRing className="w-4 h-4" />
          Avisos y seguridad de este dispositivo
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {/* Notificaciones push */}
          <div className="card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${pushActivo ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}>
                <BellRing className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">Recordatorios push</p>
                <p className="text-xs text-slate-500">
                  {!push.soportado()
                    ? 'No soportado en este navegador'
                    : pushActivo
                      ? 'Recibirás un aviso diario si hay vencimientos'
                      : 'Recibe avisos aunque la app esté cerrada'}
                </p>
              </div>
            </div>
            {push.soportado() && (
              <button
                onClick={togglePush}
                disabled={pushOcupado}
                className={pushActivo ? 'btn-secondary text-xs py-1.5' : 'btn-primary text-xs py-1.5'}
              >
                {pushOcupado ? '...' : pushActivo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>

          {/* Bloqueo con huella */}
          <div className="card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${huellaActiva ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                <Fingerprint className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">Bloqueo con huella</p>
                <p className="text-xs text-slate-500">
                  {!huellaDisponible && !huellaActiva
                    ? 'Este dispositivo no tiene biometría disponible'
                    : huellaActiva
                      ? 'Se pedirá tu huella al abrir la app'
                      : 'Protege la app con tu huella o rostro'}
                </p>
              </div>
            </div>
            {(huellaDisponible || huellaActiva) && (
              <button
                onClick={toggleHuella}
                className={huellaActiva ? 'btn-secondary text-xs py-1.5' : 'btn-primary text-xs py-1.5'}
              >
                {huellaActiva ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
