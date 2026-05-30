import { useEffect, useState } from 'react'
import { notasPago as db } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Search, CheckCircle, Trash2, FileText, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const ESTADO_BADGE = {
  pendiente: 'badge-suspended',
  pagada:    'badge-active',
  vencida:   'badge-danger',
  anulada:   'badge-inactive',
}

const FORM_INICIAL = {
  cliente_id: '', servicio_cliente_id: '', concepto: '',
  monto: '', moneda: 'USD',
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '', estado: 'pendiente', notas: ''
}

export default function NotasPago() {
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const { addToast, clientes, user } = useStore()

  const cargar = async () => {
    await db.actualizarVencidas()
    const { data } = await db.obtenerTodas()
    setLista(data || [])
  }

  useEffect(() => { cargar() }, [])

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const { error } = await db.crear({ ...form, monto: Number(form.monto), user_id: user.id })
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      addToast('Nota de pago creada ✓', 'success')
      setModal(false)
      setForm(FORM_INICIAL)
      cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const marcarPagada = async (n) => {
    if (!confirm(`¿Marcar como pagada la nota ${n.numero}?`)) return
    await db.marcarPagada(n.id)
    addToast('Marcada como pagada ✓', 'success')
    cargar()
  }

  const eliminar = async (n) => {
    if (!confirm(`¿Eliminar nota ${n.numero}?`)) return
    await db.eliminar(n.id)
    addToast('Nota eliminada', 'info')
    cargar()
  }

  const filtrados = lista.filter((n) => {
    const matchTexto = `${n.clientes?.nombre} ${n.numero} ${n.concepto}`.toLowerCase().includes(filtro.toLowerCase())
    const matchEstado = filtroEstado === 'todos' || n.estado === filtroEstado
    return matchTexto && matchEstado
  })

  const totalPendiente = lista.filter(n => ['pendiente', 'vencida'].includes(n.estado))
    .reduce((s, n) => s + Number(n.monto), 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total por cobrar', valor: `$${totalPendiente.toFixed(2)}`, color: 'text-amber-400' },
          { label: 'Pendientes', valor: lista.filter(n => n.estado === 'pendiente').length, color: 'text-slate-300' },
          { label: 'Vencidas', valor: lista.filter(n => n.estado === 'vencida').length, color: 'text-red-400' },
          { label: 'Pagadas', valor: lista.filter(n => n.estado === 'pagada').length, color: 'text-emerald-400' },
        ].map(({ label, valor, color }) => (
          <div key={label} className="card text-center py-3">
            <p className={`text-xl font-bold ${color}`}>{valor}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar nota, cliente o concepto..." value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencida">Vencida</option>
          <option value="pagada">Pagada</option>
          <option value="anulada">Anulada</option>
        </select>
        <button onClick={() => { setForm(FORM_INICIAL); setModal(true) }} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nueva Nota
        </button>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="table-head text-left">Nº Nota</th>
                <th className="table-head text-left">Cliente</th>
                <th className="table-head text-left hidden md:table-cell">Concepto</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head text-center hidden sm:table-cell">Vencimiento</th>
                <th className="table-head text-center">Estado</th>
                <th className="table-head text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500 py-10">
                  Sin notas de pago registradas
                </td></tr>
              ) : filtrados.map((n) => (
                <tr key={n.id} className="table-row">
                  <td className="table-cell">
                    <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-400">
                      <FileText className="w-3 h-3" /> {n.numero}
                    </span>
                  </td>
                  <td className="table-cell font-medium">{n.clientes?.nombre}</td>
                  <td className="table-cell hidden md:table-cell text-slate-400 text-xs max-w-[200px] truncate">{n.concepto}</td>
                  <td className="table-cell text-right font-mono font-semibold">
                    <span className={n.estado === 'pagada' ? 'text-emerald-400' : 'text-amber-400'}>
                      {n.moneda === 'USD' ? '$' : 'Bs.'}{Number(n.monto).toFixed(2)}
                    </span>
                  </td>
                  <td className="table-cell text-center hidden sm:table-cell">
                    <span className={`flex items-center justify-center gap-1 text-xs ${
                      n.estado === 'vencida' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {format(new Date(n.fecha_vencimiento + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={ESTADO_BADGE[n.estado] || 'badge-inactive'}>{n.estado}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {n.estado !== 'pagada' && n.estado !== 'anulada' && (
                        <button onClick={() => marcarPagada(n)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Marcar pagada">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => eliminar(n)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal nueva nota */}
      {modal && (
        <Modal titulo="Nueva Nota de Pago" onClose={() => setModal(false)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Cliente *</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required>
                <option value="">— Selecciona —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Concepto *</label>
              <input className="input" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} required placeholder="Ej: Mantenimiento web mensual - junio" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monto *</label>
                <input type="number" step="0.01" min="0" className="input" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} required placeholder="0.00" />
              </div>
              <div>
                <label className="label">Moneda</label>
                <select className="input" value={form.moneda} onChange={e => setForm({...form, moneda: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="BS">Bolívares (Bs.)</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha emisión *</label>
                <input type="date" className="input" value={form.fecha_emision} onChange={e => setForm({...form, fecha_emision: e.target.value})} required />
              </div>
              <div>
                <label className="label">Fecha vencimiento *</label>
                <input type="date" className="input" value={form.fecha_vencimiento} onChange={e => setForm({...form, fecha_vencimiento: e.target.value})} required />
              </div>
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Crear Nota'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
