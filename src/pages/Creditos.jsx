import { useEffect, useState } from 'react'
import { creditos as db } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { fmtMonto } from '../lib/format'
import { Plus, Search, Edit2, Trash2, CheckCircle, Landmark, CreditCard, User, HandCoins, Calendar, History } from 'lucide-react'
import { format, addMonths } from 'date-fns'
import { es } from 'date-fns/locale'

const TIPOS = {
  tarjeta: { label: 'Tarjeta de crédito', icon: CreditCard },
  banco:   { label: 'Préstamo bancario',  icon: Landmark },
  persona: { label: 'Préstamo personal',  icon: User },
  otro:    { label: 'Otro',               icon: HandCoins },
}

const ESTADO_BADGE = {
  activo:    'badge-suspended', // amarillo: deuda viva
  pagado:    'badge-active',
  cancelado: 'badge-inactive',
}

const METODOS_PAGO = ['transferencia', 'zelle', 'efectivo', 'paypal', 'binance', 'otro']

const FORM_INICIAL = {
  tipo: 'tarjeta', acreedor: '', descripcion: '',
  monto_total: '', moneda: 'USD', num_cuotas: '1', monto_cuota: '',
  tasa_interes: '', fecha_inicio: new Date().toISOString().split('T')[0],
  dia_pago: '', notas: '',
}

/** Fecha estimada de la próxima cuota: un mes después del inicio por cada cuota pagada */
function proximaCuota(c) {
  const f = addMonths(new Date(c.fecha_inicio + 'T00:00:00'), (c.cuotas_pagadas || 0) + 1)
  if (c.dia_pago) {
    const ultimoDia = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()
    f.setDate(Math.min(c.dia_pago, ultimoDia))
  }
  return f
}

const saldoDe = (c) => Math.max(0, Number(c.monto_total) - Number(c.abonado || 0))

export default function Creditos() {
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null) // 'crear' | 'editar' | 'pagar' | 'historial'
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [formPago, setFormPago] = useState(null)
  const [pagos, setPagos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const { addToast, user } = useStore()

  const cargar = async () => {
    try {
      const { data, error } = await db.obtenerTodos()
      if (error) throw error
      setLista(data || [])
    } catch (err) {
      const msg = err?.message || ''
      addToast(
        /creditos/i.test(msg) && /find|exist|schema/i.test(msg)
          ? 'Falta la tabla de créditos: ejecuta supabase-pendiente.sql en Supabase'
          : 'No se pudieron cargar los créditos: ' + (msg || 'revisa tu conexión'),
        'error'
      )
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => {
    setForm(FORM_INICIAL)
    setSeleccionado(null)
    setModal('crear')
  }

  const abrirEditar = (c) => {
    setForm({
      tipo: c.tipo, acreedor: c.acreedor, descripcion: c.descripcion || '',
      monto_total: String(c.monto_total), moneda: c.moneda,
      num_cuotas: String(c.num_cuotas), monto_cuota: c.monto_cuota ? String(c.monto_cuota) : '',
      tasa_interes: c.tasa_interes ? String(c.tasa_interes) : '',
      fecha_inicio: c.fecha_inicio, dia_pago: c.dia_pago ? String(c.dia_pago) : '',
      notas: c.notas || '',
    })
    setSeleccionado(c)
    setModal('editar')
  }

  const abrirPagar = (c) => {
    const saldo = saldoDe(c)
    const cuota = Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas)
    setFormPago({
      monto: String(Math.min(cuota, saldo).toFixed(2)),
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'transferencia',
      referencia: '',
    })
    setSeleccionado(c)
    setModal('pagar')
  }

  const abrirHistorial = async (c) => {
    setSeleccionado(c)
    setPagos([])
    setModal('historial')
    const { data } = await db.obtenerPagos(c.id)
    setPagos(data || [])
  }

  const cerrar = () => { setModal(null); setSeleccionado(null) }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const datos = {
        ...form,
        monto_total: Number(form.monto_total),
        num_cuotas: Number(form.num_cuotas) || 1,
        monto_cuota: form.monto_cuota ? Number(form.monto_cuota) : Number(form.monto_total) / (Number(form.num_cuotas) || 1),
        tasa_interes: form.tasa_interes ? Number(form.tasa_interes) : null,
        dia_pago: form.dia_pago ? Number(form.dia_pago) : null,
      }
      const { error } = modal === 'crear'
        ? await db.crear({ ...datos, user_id: user.id })
        : await db.actualizar(seleccionado.id, datos)
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      addToast(modal === 'crear' ? 'Crédito registrado ✓' : 'Crédito actualizado ✓', 'success')
      cerrar(); cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const pagarCuota = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const { error, saldado, saldoRestante } = await db.pagarCuota(seleccionado, formPago, user.id)
      if (error) { addToast('Error: ' + error.message, 'error'); return }
      if (saldado) {
        addToast(`🎉 ¡Crédito con ${seleccionado.acreedor} saldado por completo!`, 'success')
      } else {
        addToast(`Cuota pagada ✓ (registrada en Gastos) — saldo: ${fmtMonto(saldoRestante, seleccionado.moneda)}`, 'success')
      }
      cerrar(); cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar el crédito con "${c.acreedor}"? Se borra también su historial de pagos (los gastos ya registrados se conservan).`)) return
    await db.eliminar(c.id)
    addToast('Crédito eliminado', 'info')
    cargar()
  }

  const filtrados = lista.filter((c) =>
    `${c.acreedor} ${c.descripcion} ${TIPOS[c.tipo]?.label}`.toLowerCase().includes(filtro.toLowerCase())
  )

  const activos = lista.filter((c) => c.estado === 'activo')
  const deudaUSD = activos.filter(c => c.moneda === 'USD').reduce((s, c) => s + saldoDe(c), 0)
  const cuotaMensualUSD = activos.filter(c => c.moneda === 'USD')
    .reduce((s, c) => s + (Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas)), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className="input pl-9" placeholder="Buscar por acreedor o tipo..." value={filtro} onChange={e => setFiltro(e.target.value)} />
        </div>
        <button onClick={abrirCrear} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nuevo Crédito
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Deuda restante', valor: `$${deudaUSD.toFixed(2)}`, color: 'text-red-400' },
          { label: 'Cuotas del mes', valor: `$${cuotaMensualUSD.toFixed(2)}`, color: 'text-amber-400' },
          { label: 'Créditos activos', valor: activos.length, color: 'text-slate-300' },
        ].map(({ label, valor, color }) => (
          <div key={label} className="card text-center py-3">
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{valor}</p>
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
                <th className="table-head text-left">Acreedor</th>
                <th className="table-head text-left hidden md:table-cell">Cuotas</th>
                <th className="table-head text-right hidden sm:table-cell">Cuota</th>
                <th className="table-head text-center hidden md:table-cell">Próximo pago</th>
                <th className="table-head text-right">Saldo</th>
                <th className="table-head text-center">Estado</th>
                <th className="table-head text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500 py-10">
                  {filtro ? 'Sin resultados' : 'Sin créditos registrados. Registra giros de tarjeta, préstamos bancarios o de personas.'}
                </td></tr>
              ) : filtrados.map((c) => {
                const Icono = TIPOS[c.tipo]?.icon || HandCoins
                const cuota = Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas)
                const progreso = Math.min(100, (Number(c.abonado || 0) / Number(c.monto_total)) * 100)
                return (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Icono className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate">{c.acreedor}</p>
                          <p className="text-xs text-slate-500 truncate">{TIPOS[c.tipo]?.label}{c.descripcion ? ` · ${c.descripcion}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <p className="text-xs text-slate-400 mb-1">{c.cuotas_pagadas || 0} de {c.num_cuotas}</p>
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${progreso}%` }} />
                      </div>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-right font-mono text-slate-300">
                      {fmtMonto(cuota, c.moneda)}
                    </td>
                    <td className="table-cell hidden md:table-cell text-center text-xs text-slate-400">
                      {c.estado === 'activo' ? (
                        <span className="flex items-center justify-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(proximaCuota(c), 'dd MMM yyyy', { locale: es })}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="table-cell text-right font-mono font-semibold">
                      <span className={c.estado === 'pagado' ? 'text-emerald-400' : 'text-red-400'}>
                        {fmtMonto(saldoDe(c), c.moneda)}
                      </span>
                      {Number(c.abonado) > 0 && c.estado === 'activo' && (
                        <span className="block text-[10px] font-normal text-slate-500">
                          de {fmtMonto(c.monto_total, c.moneda)}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <span className={ESTADO_BADGE[c.estado] || 'badge-inactive'}>{c.estado}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {c.estado === 'activo' && (
                          <button onClick={() => abrirPagar(c)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Pagar cuota">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => abrirHistorial(c)} className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg" title="Historial de pagos">
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => abrirEditar(c)} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg" title="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => eliminar(c)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg" title="Eliminar">
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

      {/* Modal crear/editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <Modal titulo={modal === 'crear' ? 'Nuevo Crédito' : 'Editar Crédito'} onClose={cerrar} ancho="max-w-xl">
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tipo *</label>
                <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  {Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Acreedor *</label>
                <input className="input" value={form.acreedor} onChange={e => setForm({...form, acreedor: e.target.value})} required
                  placeholder={form.tipo === 'persona' ? 'Nombre de la persona' : 'Banco / Tarjeta'} />
              </div>
              <div className="col-span-2">
                <label className="label">Descripción</label>
                <input className="input" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="Ej: Giro Visa marzo, préstamo para equipos..." />
              </div>
              <div>
                <label className="label">Monto total a pagar *</label>
                <input type="number" step="0.01" min="0.01" className="input" value={form.monto_total}
                  onChange={e => {
                    const total = e.target.value
                    const n = Number(form.num_cuotas) || 1
                    setForm({ ...form, monto_total: total, monto_cuota: total ? (Number(total) / n).toFixed(2) : '' })
                  }} required placeholder="0.00" />
              </div>
              <div>
                <label className="label">Moneda</label>
                <select className="input" value={form.moneda} onChange={e => setForm({...form, moneda: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="BS">Bolívares (Bs.)</option>
                </select>
              </div>
              <div>
                <label className="label">Nº de cuotas *</label>
                <input type="number" min="1" max="120" className="input" value={form.num_cuotas}
                  onChange={e => {
                    const n = Number(e.target.value) || 1
                    setForm({ ...form, num_cuotas: e.target.value, monto_cuota: form.monto_total ? (Number(form.monto_total) / n).toFixed(2) : '' })
                  }} required />
              </div>
              <div>
                <label className="label">Monto por cuota</label>
                <input type="number" step="0.01" min="0" className="input" value={form.monto_cuota}
                  onChange={e => setForm({...form, monto_cuota: e.target.value})} placeholder="Se calcula solo" />
              </div>
              <div>
                <label className="label">Fecha del crédito *</label>
                <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm({...form, fecha_inicio: e.target.value})} required />
              </div>
              <div>
                <label className="label">Día de pago (1-31)</label>
                <input type="number" min="1" max="31" className="input" value={form.dia_pago} onChange={e => setForm({...form, dia_pago: e.target.value})} placeholder="Opcional" />
              </div>
              <div>
                <label className="label">Tasa de interés (%)</label>
                <input type="number" step="0.01" min="0" className="input" value={form.tasa_interes} onChange={e => setForm({...form, tasa_interes: e.target.value})} placeholder="Opcional, informativa" />
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input h-16 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Condiciones, garantías, acuerdos..." />
              </div>
            </div>
            {form.monto_total && form.num_cuotas && (
              <p className="text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
                💡 {form.num_cuotas} cuota(s) de <b className="text-slate-200">{fmtMonto(Number(form.monto_cuota) || Number(form.monto_total) / (Number(form.num_cuotas) || 1), form.moneda)}</b> — la primera vence un mes después de la fecha del crédito.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal pagar cuota */}
      {modal === 'pagar' && seleccionado && formPago && (
        <Modal titulo="Pagar Cuota" onClose={cerrar}>
          <form onSubmit={pagarCuota} className="space-y-4">
            <div className="card !p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{seleccionado.acreedor}</p>
                <p className="text-xs text-slate-500">
                  Cuota {Math.min((seleccionado.cuotas_pagadas || 0) + 1, seleccionado.num_cuotas)} de {seleccionado.num_cuotas}
                </p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="font-mono text-xl font-bold text-red-400">{fmtMonto(saldoDe(seleccionado), seleccionado.moneda)}</p>
                <p className="text-[10px] text-slate-500">saldo actual</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monto a pagar ({seleccionado.moneda}) *</label>
                <input type="number" step="0.01" min="0.01" max={saldoDe(seleccionado)} className="input"
                  value={formPago.monto} onChange={e => setFormPago({...formPago, monto: e.target.value})} required />
              </div>
              <div>
                <label className="label">Fecha del pago *</label>
                <input type="date" className="input" value={formPago.fecha_pago}
                  onChange={e => setFormPago({...formPago, fecha_pago: e.target.value})} required />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="input" value={formPago.metodo_pago} onChange={e => setFormPago({...formPago, metodo_pago: e.target.value})}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Referencia</label>
                <input className="input" value={formPago.referencia} onChange={e => setFormPago({...formPago, referencia: e.target.value})} placeholder="Nº de comprobante" />
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-brand-500/[0.08] border border-brand-500/20 rounded-xl p-3">
              El pago se registra automáticamente como <b>gasto del mes</b> (categoría financiamiento),
              así aparece en Reportes y Dashboard. Cuando lo abonado cubra el total, el crédito pasa a <b>pagado</b>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={cerrar} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-success">
                {guardando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Registrar Pago</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal historial de pagos */}
      {modal === 'historial' && seleccionado && (
        <Modal titulo={`Pagos — ${seleccionado.acreedor}`} onClose={cerrar}>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Abonado: <b className="text-emerald-400 font-mono">{fmtMonto(seleccionado.abonado || 0, seleccionado.moneda)}</b></span>
              <span className="text-slate-400">Saldo: <b className="text-red-400 font-mono">{fmtMonto(saldoDe(seleccionado), seleccionado.moneda)}</b></span>
            </div>
            {pagos.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">Sin pagos registrados todavía</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {pagos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50">
                    <div>
                      <p className="text-sm text-slate-200">Cuota {p.numero_cuota}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {format(new Date(p.fecha_pago + 'T00:00:00'), 'dd MMM yyyy', { locale: es })} · {p.metodo_pago}{p.referencia ? ` · Ref: ${p.referencia}` : ''}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-emerald-400">{fmtMonto(p.monto, p.moneda)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button onClick={cerrar} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
