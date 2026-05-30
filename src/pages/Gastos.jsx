import { useEffect, useState } from 'react'
import { gastos as db } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, CheckCircle, Trash2, RefreshCw, TrendingDown, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const CATEGORIAS = ['tecnologia', 'servicios', 'oficina', 'impuestos', 'personal', 'otro']
const GASTOS_PREDEFINIDOS = [
  { nombre: 'Servidor (Hosting)', categoria: 'tecnologia', proveedor: 'Hostinger/Render' },
  { nombre: 'Claude API (Anthropic)', categoria: 'tecnologia', proveedor: 'Anthropic' },
  { nombre: 'VPN', categoria: 'tecnologia', proveedor: '' },
  { nombre: 'Dominio', categoria: 'tecnologia', proveedor: 'Namecheap' },
  { nombre: 'GitHub Copilot', categoria: 'tecnologia', proveedor: 'GitHub' },
  { nombre: 'Internet', categoria: 'servicios', proveedor: '' },
  { nombre: 'Teléfono', categoria: 'servicios', proveedor: '' },
]

const FORM_INICIAL = {
  nombre: '', categoria: 'tecnologia', monto: '', moneda: 'USD',
  mes: new Date().getMonth() + 1, anio: new Date().getFullYear(),
  dia_vence: '', es_recurrente: true, proveedor: '', notas: '', estado: 'pendiente'
}

export default function Gastos() {
  const hoy = new Date()
  const [lista, setLista] = useState([])
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [clonando, setClonando] = useState(false)
  const { addToast, user } = useStore()

  const cargar = async () => {
    const { data } = await db.obtenerPorMes(mes, anio)
    setLista(data || [])
  }

  useEffect(() => { cargar() }, [mes, anio])

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const { error } = await db.crear({ ...form, monto: Number(form.monto), mes, anio, user_id: user.id })
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      addToast('Gasto registrado ✓', 'success')
      setModal(false); setForm(FORM_INICIAL); cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const marcarPagado = async (g) => {
    await db.marcarPagado(g.id)
    addToast('Marcado como pagado ✓', 'success')
    cargar()
  }

  const eliminar = async (g) => {
    if (!confirm(`¿Eliminar "${g.nombre}"?`)) return
    await db.eliminar(g.id)
    addToast('Gasto eliminado', 'info')
    cargar()
  }

  const clonarMes = async () => {
    const mesPrev = mes === 1 ? 12 : mes - 1
    const anioPrev = mes === 1 ? anio - 1 : anio
    setClonando(true)
    await db.clonarRecurrentes(mesPrev, anioPrev, mes, anio)
    setClonando(false)
    addToast('Gastos recurrentes clonados ✓', 'success')
    cargar()
  }

  const usarPredefinido = (gasto) => {
    setForm({...FORM_INICIAL, nombre: gasto.nombre, categoria: gasto.categoria, proveedor: gasto.proveedor || '', mes, anio})
    setModal(true)
  }

  const totalPagado = lista.filter(g => g.estado === 'pagado').reduce((s, g) => s + Number(g.monto), 0)
  const totalPendiente = lista.filter(g => g.estado === 'pendiente').reduce((s, g) => s + Number(g.monto), 0)
  const totalMes = totalPagado + totalPendiente

  const meses = Array.from({ length: 12 }, (_, i) => ({
    valor: i + 1, nombre: format(new Date(2024, i, 1), 'MMMM', { locale: es })
  }))

  const porCategoria = CATEGORIAS.filter(c => lista.some(g => g.categoria === c))

  return (
    <div className="space-y-4">
      {/* Filtros y acciones */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <select className="input w-auto" value={mes} onChange={e => setMes(Number(e.target.value))}>
            {meses.map(m => <option key={m.valor} value={m.valor} className="capitalize">{m.nombre}</option>)}
          </select>
          <select className="input w-auto" value={anio} onChange={e => setAnio(Number(e.target.value))}>
            {[hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={clonarMes} disabled={clonando} className="btn-secondary">
            {clonando ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <Copy className="w-4 h-4" />}
            Clonar del mes anterior
          </button>
          <button onClick={() => { setForm({...FORM_INICIAL, mes, anio}); setModal(true) }} className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3 border-l-4 border-l-red-500">
          <p className="text-xl font-bold text-red-400">${totalMes.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Total del mes</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-emerald-400">${totalPagado.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Pagado</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold text-amber-400">${totalPendiente.toFixed(2)}</p>
          <p className="text-xs text-slate-500">Pendiente</p>
        </div>
      </div>

      {/* Gastos predefinidos (atajos rápidos) */}
      <div className="card">
        <p className="text-xs font-semibold text-slate-400 mb-3">⚡ Gastos frecuentes (clic para agregar)</p>
        <div className="flex flex-wrap gap-2">
          {GASTOS_PREDEFINIDOS.map(g => (
            <button key={g.nombre} onClick={() => usarPredefinido(g)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors">
              + {g.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de gastos del mes */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="table-head text-left">Gasto</th>
                <th className="table-head text-left hidden md:table-cell">Categoría</th>
                <th className="table-head text-left hidden lg:table-cell">Proveedor</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head text-center">Estado</th>
                <th className="table-head text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-10">
                  No hay gastos registrados para este mes.<br/>
                  <span className="text-xs">Usa "Clonar del mes anterior" si tienes gastos recurrentes</span>
                </td></tr>
              ) : lista.map((g) => (
                <tr key={g.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium text-slate-200">{g.nombre}</p>
                    {g.es_recurrente && <span className="text-xs text-indigo-400 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" />Recurrente</span>}
                  </td>
                  <td className="table-cell hidden md:table-cell">
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full capitalize">{g.categoria}</span>
                  </td>
                  <td className="table-cell hidden lg:table-cell text-slate-500 text-xs">{g.proveedor || '—'}</td>
                  <td className="table-cell text-right font-mono font-semibold text-red-400">
                    {g.moneda === 'USD' ? '$' : 'Bs.'}{Number(g.monto).toFixed(2)}
                  </td>
                  <td className="table-cell text-center">
                    <span className={g.estado === 'pagado' ? 'badge-active' : 'badge-suspended'}>{g.estado}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {g.estado !== 'pagado' && (
                        <button onClick={() => marcarPagado(g)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Marcar pagado">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => eliminar(g)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {lista.length > 0 && (
              <tfoot className="bg-slate-800/30">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-400">TOTAL DEL MES</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-400">${totalMes.toFixed(2)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal titulo="Registrar Gasto" onClose={() => setModal(false)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Nombre del gasto *</label>
              <input className="input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required placeholder="Ej: Servidor Render" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                  {CATEGORIAS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Proveedor</label>
                <input className="input" value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} placeholder="Ej: Render.com" />
              </div>
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
                <label className="label">Día de vencimiento</label>
                <input type="number" min="1" max="31" className="input" value={form.dia_vence} onChange={e => setForm({...form, dia_vence: e.target.value})} placeholder="Ej: 15" />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input type="checkbox" id="recurrente" checked={form.es_recurrente} onChange={e => setForm({...form, es_recurrente: e.target.checked})} className="w-4 h-4 rounded accent-indigo-500" />
                <label htmlFor="recurrente" className="text-sm text-slate-300">Gasto recurrente</label>
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Registrar Gasto'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
