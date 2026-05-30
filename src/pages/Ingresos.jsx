import { useEffect, useState } from 'react'
import { ingresos as db, clientes as dbClientes } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { Plus, Search, Trash2, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const METODOS = ['transferencia', 'zelle', 'efectivo', 'paypal', 'binance', 'otro']

const FORM_INICIAL = {
  cliente_id: '', concepto: '', monto: '', moneda: 'USD',
  tasa_cambio: '', monto_usd: '',
  fecha_pago: new Date().toISOString().split('T')[0],
  metodo_pago: 'transferencia', referencia: '', notas: ''
}

export default function Ingresos() {
  const hoy = new Date()
  const [lista, setLista] = useState([])
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [clientesLista, setClientesLista] = useState([])
  const { addToast, user } = useStore()

  const cargar = async () => {
    const [{ data }, { data: cls }] = await Promise.all([
      db.obtenerPorMes(mes, anio),
      dbClientes.obtenerTodos(),
    ])
    setLista(data || [])
    setClientesLista(cls || [])
  }

  useEffect(() => { cargar() }, [mes, anio])

  // Auto-calcular monto USD si pagan en Bs
  const handleMonto = (monto, moneda, tasa) => {
    if (moneda === 'BS' && tasa) {
      return { monto, moneda, tasa_cambio: tasa, monto_usd: (Number(monto) / Number(tasa)).toFixed(2) }
    }
    return { monto, moneda, tasa_cambio: tasa, monto_usd: moneda === 'USD' ? monto : '' }
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const datos = {
        ...form,
        monto: Number(form.monto),
        tasa_cambio: form.tasa_cambio ? Number(form.tasa_cambio) : null,
        monto_usd: form.moneda === 'USD' ? Number(form.monto) : (form.monto_usd ? Number(form.monto_usd) : null),
        user_id: user.id,
      }
      const { error } = await db.crear(datos)
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      addToast('Ingreso registrado ✓', 'success')
      setModal(false); setForm(FORM_INICIAL); cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (item) => {
    if (!confirm('¿Eliminar este ingreso?')) return
    await db.eliminar(item.id)
    addToast('Ingreso eliminado', 'info')
    cargar()
  }

  const filtrados = lista.filter(i =>
    `${i.clientes?.nombre} ${i.concepto} ${i.referencia}`.toLowerCase().includes(filtro.toLowerCase())
  )

  const totalUSD = filtrados.reduce((s, i) =>
    s + (i.moneda === 'USD' ? Number(i.monto) : Number(i.monto_usd || 0)), 0)

  const meses = Array.from({ length: 12 }, (_, i) => ({
    valor: i + 1,
    nombre: format(new Date(2024, i, 1), 'MMMM', { locale: es })
  }))

  return (
    <div className="space-y-4">
      {/* Filtros de mes/año */}
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
        <button onClick={() => { setForm(FORM_INICIAL); setModal(true) }} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Registrar Ingreso
        </button>
      </div>

      {/* Resumen del mes */}
      <div className="card border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Total ingresos del mes</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">${totalUSD.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{filtrados.length} pagos registrados</p>
          </div>
          <TrendingUp className="w-12 h-12 text-emerald-700 opacity-40" />
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input className="input pl-9" placeholder="Buscar por cliente, concepto o referencia..." value={filtro} onChange={e => setFiltro(e.target.value)} />
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="table-head text-left">Fecha</th>
                <th className="table-head text-left">Cliente</th>
                <th className="table-head text-left hidden md:table-cell">Concepto</th>
                <th className="table-head text-right">Monto</th>
                <th className="table-head text-center hidden sm:table-cell">Método</th>
                <th className="table-head text-right hidden lg:table-cell">Ref.</th>
                <th className="table-head text-right">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500 py-10">
                  No hay ingresos registrados para este período
                </td></tr>
              ) : filtrados.map((i) => (
                <tr key={i.id} className="table-row">
                  <td className="table-cell text-xs text-slate-400">
                    {format(new Date(i.fecha_pago + 'T00:00:00'), 'dd MMM', { locale: es })}
                  </td>
                  <td className="table-cell font-medium text-slate-200">{i.clientes?.nombre || '—'}</td>
                  <td className="table-cell hidden md:table-cell text-slate-400 text-xs max-w-[150px] truncate">{i.concepto}</td>
                  <td className="table-cell text-right font-mono font-semibold text-emerald-400">
                    {i.moneda === 'USD' ? '$' : 'Bs.'}{Number(i.monto).toFixed(2)}
                    {i.moneda === 'BS' && i.monto_usd && (
                      <span className="block text-xs text-slate-500">${Number(i.monto_usd).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="table-cell text-center hidden sm:table-cell">
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{i.metodo_pago}</span>
                  </td>
                  <td className="table-cell text-right hidden lg:table-cell text-xs text-slate-500 font-mono">{i.referencia || '—'}</td>
                  <td className="table-cell">
                    <button onClick={() => eliminar(i)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg float-right">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal titulo="Registrar Ingreso" onClose={() => setModal(false)} ancho="max-w-xl">
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Cliente</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}>
                <option value="">— Sin cliente específico —</option>
                {clientesLista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Concepto *</label>
              <input className="input" value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} required placeholder="Ej: Pago mantenimiento web junio" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Moneda</label>
                <select className="input" value={form.moneda} onChange={e => setForm({...form, moneda: e.target.value, tasa_cambio: '', monto_usd: ''})}>
                  <option value="USD">USD ($)</option>
                  <option value="BS">Bolívares (Bs.)</option>
                </select>
              </div>
              <div>
                <label className="label">Monto *</label>
                <input type="number" step="0.01" min="0" className="input" value={form.monto}
                  onChange={e => {
                    const updates = handleMonto(e.target.value, form.moneda, form.tasa_cambio)
                    setForm({...form, ...updates})
                  }} required placeholder="0.00" />
              </div>
              {form.moneda === 'BS' && (
                <>
                  <div>
                    <label className="label">Tasa BCV (Bs./$)</label>
                    <input type="number" step="0.01" min="0" className="input" value={form.tasa_cambio}
                      onChange={e => {
                        const updates = handleMonto(form.monto, form.moneda, e.target.value)
                        setForm({...form, ...updates})
                      }} placeholder="Ej: 45.50" />
                  </div>
                  <div>
                    <label className="label">Equivalente USD</label>
                    <input type="number" step="0.01" className="input bg-slate-700" value={form.monto_usd} readOnly />
                  </div>
                </>
              )}
              <div>
                <label className="label">Fecha de pago *</label>
                <input type="date" className="input" value={form.fecha_pago} onChange={e => setForm({...form, fecha_pago: e.target.value})} required />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="input" value={form.metodo_pago} onChange={e => setForm({...form, metodo_pago: e.target.value})}>
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Referencia bancaria</label>
                <input className="input" value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} placeholder="Nº de comprobante" />
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones adicionales..." />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Registrar Ingreso'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
