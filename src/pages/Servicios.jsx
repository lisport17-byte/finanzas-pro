import { useEffect, useState } from 'react'
import { serviciosClientes as db, tiposServicio as dbTipos, clientes as dbClientes } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Search, Edit2, Trash2, PauseCircle, PlayCircle, Calendar } from 'lucide-react'
import { format, addMonths, addYears, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_BADGE = {
  activo:     'badge-active',
  suspendido: 'badge-suspended',
  cancelado:  'badge-danger',
}

const FORM_INICIAL = {
  cliente_id: '', tipo_servicio_id: '', nombre_servicio: '', descripcion: '',
  precio: '', moneda: 'USD', tipo_renovacion: 'mensual',
  fecha_inicio: new Date().toISOString().split('T')[0],
  fecha_renovacion: '', estado: 'activo', alerta_dias: 5, notas: ''
}

function calcularRenovacion(inicio, tipo) {
  if (!inicio) return ''
  if (tipo === 'pago_unico') return '9999-12-31' // nunca vence
  const fecha = new Date(inicio + 'T00:00:00')
  const nueva = tipo === 'mensual' ? addMonths(fecha, 1) : addYears(fecha, 1)
  return nueva.toISOString().split('T')[0]
}

function diasRestantes(fecha, estado, tipo) {
  if (tipo === 'pago_unico') return { texto: 'Pago Único', clase: 'text-indigo-400' }
  if (estado === 'suspendido') return { texto: 'Suspendido', clase: 'text-amber-400' }
  if (estado === 'cancelado') return { texto: 'Cancelado', clase: 'text-slate-500' }
  const d = differenceInDays(new Date(fecha + 'T00:00:00'), new Date())
  if (d < 0) return { texto: `Vencido ${Math.abs(d)}d`, clase: 'text-red-400' }
  if (d === 0) return { texto: '¡Vence HOY!', clase: 'text-red-400 font-bold' }
  if (d <= 5) return { texto: `${d}d restantes`, clase: 'text-amber-400' }
  return { texto: `${d}d`, clase: 'text-slate-400' }
}

export default function Servicios() {
  const [lista, setLista] = useState([])
  const [tipos, setTipos] = useState([])
  const [clientesLista, setClientesLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const { addToast, user } = useStore()

  const cargar = async () => {
    try {
      const [{ data: svcs }, { data: tps }, { data: cls }] = await Promise.all([
        db.obtenerTodos(),
        dbTipos.obtenerTodos(),
        dbClientes.obtenerTodos(),
      ])
      setLista(svcs || [])
      setTipos(tps || [])
      setClientesLista(cls || [])
    } catch (err) {
      addToast('No se pudieron cargar los servicios: ' + (err?.message || 'revisa tu conexión'), 'error')
    }
  }

  useEffect(() => { cargar() }, [])

  const actualizarRenovacion = (f) => ({
    ...f,
    fecha_renovacion: calcularRenovacion(f.fecha_inicio, f.tipo_renovacion)
  })

  const abrirCrear = () => {
    const f = { ...FORM_INICIAL }
    f.fecha_renovacion = calcularRenovacion(f.fecha_inicio, f.tipo_renovacion)
    setForm(f)
    setSeleccionado(null)
    setModal('crear')
  }

  const abrirEditar = (s) => {
    setForm({
      cliente_id: s.cliente_id,
      tipo_servicio_id: s.tipo_servicio_id || '',
      nombre_servicio: s.nombre_servicio,
      descripcion: s.descripcion || '',
      precio: String(s.precio),
      moneda: s.moneda,
      tipo_renovacion: s.tipo_renovacion,
      fecha_inicio: s.fecha_inicio,
      fecha_renovacion: s.fecha_renovacion,
      estado: s.estado,
      alerta_dias: s.alerta_dias || 5,
      notas: s.notas || '',
    })
    setSeleccionado(s)
    setModal('editar')
  }

  const cerrar = () => { setModal(null); setSeleccionado(null) }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const datos = { ...form, precio: Number(form.precio), user_id: user.id }
      const { error } = modal === 'crear'
        ? await db.crear(datos)
        : await db.actualizar(seleccionado.id, { ...form, precio: Number(form.precio) })
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      addToast(modal === 'crear' ? 'Servicio registrado ✓' : 'Servicio actualizado ✓', 'success')
      cerrar(); cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const suspender = async (s) => {
    await db.suspender(s.id)
    addToast('Servicio suspendido', 'warning')
    cargar()
  }

  const reactivar = async (s) => {
    const nueva = calcularRenovacion(new Date().toISOString().split('T')[0], s.tipo_renovacion)
    await db.reactivar(s.id, nueva)
    addToast('Servicio reactivado ✓', 'success')
    cargar()
  }

  const eliminar = async (s) => {
    if (!confirm(`¿Eliminar servicio "${s.nombre_servicio}"?`)) return
    await db.eliminar(s.id)
    addToast('Servicio eliminado', 'info')
    cargar()
  }

  const filtrados = lista.filter((s) =>
    `${s.clientes?.nombre} ${s.nombre_servicio}`.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar por cliente o servicio..." value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <button onClick={abrirCrear} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nuevo Servicio
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Activos', valor: lista.filter(s => s.estado === 'activo').length, color: 'text-emerald-400' },
          { label: 'Suspendidos', valor: lista.filter(s => s.estado === 'suspendido').length, color: 'text-amber-400' },
          { label: 'Total MRR', valor: `$${lista.filter(s => s.estado === 'activo' && s.moneda === 'USD').reduce((a, s) => a + (s.tipo_renovacion === 'mensual' ? Number(s.precio) : Number(s.precio) / 12), 0).toFixed(0)}`, color: 'text-indigo-400' },
        ].map(({ label, valor, color }) => (
          <div key={label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${color}`}>{valor}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="table-head text-left">Cliente / Servicio</th>
                <th className="table-head text-left hidden sm:table-cell">Tipo</th>
                <th className="table-head text-right hidden md:table-cell">Precio</th>
                <th className="table-head text-center hidden md:table-cell">Renovación</th>
                <th className="table-head text-center">Vence</th>
                <th className="table-head text-center">Estado</th>
                <th className="table-head text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500 py-10">
                  {filtro ? 'Sin resultados' : 'No hay servicios registrados'}
                </td></tr>
              ) : filtrados.map((s) => {
                const { texto, clase } = diasRestantes(s.fecha_renovacion, s.estado, s.tipo_renovacion)
                const esPagoUnico = s.tipo_renovacion === 'pago_unico'
                return (
                  <tr key={s.id} className="table-row">
                    <td className="table-cell">
                      <p className="font-medium text-slate-200">{s.clientes?.nombre}</p>
                      <p className="text-xs text-slate-500">{s.nombre_servicio}</p>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-slate-400 text-xs">
                      {s.tipos_servicio?.nombre || '—'}
                    </td>
                    <td className="table-cell hidden md:table-cell text-right font-mono">
                      <span className="text-emerald-400">{s.moneda === 'USD' ? '$' : 'Bs.'}{Number(s.precio).toFixed(2)}</span>
                      <span className="text-xs text-slate-500 block">
                        {esPagoUnico ? 'Pago único' : s.tipo_renovacion}
                      </span>
                    </td>
                    <td className="table-cell hidden md:table-cell text-center text-xs text-slate-400">
                      {esPagoUnico ? (
                        <span className="text-indigo-400 font-medium">Sin renovación</span>
                      ) : (
                        <span className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(s.fecha_renovacion + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <span className={`text-xs ${clase}`}>{texto}</span>
                    </td>
                    <td className="table-cell text-center">
                      <span className={ESTADO_BADGE[s.estado] || 'badge-inactive'}>{s.estado}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEditar(s)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg" title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {s.estado === 'activo' ? (
                          <button onClick={() => suspender(s)} className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-900/30 rounded-lg" title="Suspender">
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : s.estado === 'suspendido' ? (
                          <button onClick={() => reactivar(s)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Reactivar">
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button onClick={() => eliminar(s)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal titulo={modal === 'crear' ? 'Nuevo Servicio' : 'Editar Servicio'} onClose={cerrar} ancho="max-w-xl">
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Cliente *</label>
                <select className="input" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required>
                  <option value="">— Selecciona un cliente —</option>
                  {clientesLista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tipo de servicio</label>
                <select className="input" value={form.tipo_servicio_id} onChange={e => {
                  const tipo = tipos.find(t => t.id === e.target.value)
                  setForm({...form, tipo_servicio_id: e.target.value, nombre_servicio: tipo?.nombre || form.nombre_servicio, precio: tipo?.precio_base?.toString() || form.precio})
                }}>
                  <option value="">— Personalizado —</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nombre del servicio *</label>
                <input className="input" value={form.nombre_servicio} onChange={e => setForm({...form, nombre_servicio: e.target.value})} required placeholder="Ej: Web corporativa" />
              </div>
              <div>
                <label className="label">Precio *</label>
                <input type="number" step="0.01" min="0" className="input" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} required placeholder="0.00" />
              </div>
              <div>
                <label className="label">Moneda</label>
                <select className="input" value={form.moneda} onChange={e => setForm({...form, moneda: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="BS">Bolívares (Bs.)</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha de inicio *</label>
                <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm(actualizarRenovacion({...form, fecha_inicio: e.target.value}))} required />
              </div>
              <div>
                <label className="label">Tipo de renovación</label>
                <select className="input" value={form.tipo_renovacion} onChange={e => setForm(actualizarRenovacion({...form, tipo_renovacion: e.target.value}))}>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                  <option value="pago_unico">Pago Único (sin renovación)</option>
                </select>
              </div>
              {form.tipo_renovacion !== 'pago_unico' && (
                <>
                  <div>
                    <label className="label">Fecha de renovación *</label>
                    <input type="date" className="input" value={form.fecha_renovacion} onChange={e => setForm({...form, fecha_renovacion: e.target.value})} required />
                  </div>
                  <div>
                    <label className="label">Alertar (días antes)</label>
                    <input type="number" min="1" max="30" className="input" value={form.alerta_dias} onChange={e => setForm({...form, alerta_dias: Number(e.target.value)})} />
                  </div>
                </>
              )}
              <div className="col-span-2">
                <label className="label">Estado</label>
                <select className="input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Detalles del servicio..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
