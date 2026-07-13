import { useEffect, useState } from 'react'
import { notasPago as db, clientes as dbClientes, facturacion } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { imprimirNotaPago, imprimirFacturaMensual, numeroFactura } from '../lib/pdf'
import { abrirWhatsApp, mensajeFactura } from '../lib/whatsapp'
import { fmtMonto } from '../lib/format'
import { Plus, Search, CheckCircle, Trash2, FileText, Clock, Printer, Wallet, Users, List, MessageCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const METODOS_PAGO = ['transferencia', 'zelle', 'efectivo', 'paypal', 'binance', 'otro']
const FORM_PAGO_INICIAL = {
  fecha_pago: new Date().toISOString().split('T')[0],
  metodo_pago: 'transferencia',
  referencia: '',
  tasa_cambio: '',
  tipo_pago: 'total',
  monto_abono: '',
}

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
  const [vista, setVista] = useState('lista') // 'lista' | 'clientes'
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [clientesLista, setClientesLista] = useState([])
  const { addToast, user } = useStore()

  const cargar = async () => {
    try {
      const [, { data }, { data: cls }] = await Promise.all([
        db.actualizarVencidas(),
        db.obtenerTodas(),
        dbClientes.obtenerTodos(),
      ])
      setLista(data || [])
      setClientesLista(cls || [])
    } catch (err) {
      addToast('No se pudieron cargar las notas: ' + (err?.message || 'revisa tu conexión'), 'error')
    }
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

  const [notaPagar, setNotaPagar] = useState(null)
  const [formPago, setFormPago] = useState(FORM_PAGO_INICIAL)
  const [confirmando, setConfirmando] = useState(false)

  const abrirConfirmarPago = (n) => {
    setFormPago(FORM_PAGO_INICIAL)
    setNotaPagar(n)
  }

  const confirmarPago = async (e) => {
    e.preventDefault()
    setConfirmando(true)
    try {
      const { error, servicioRenovado, notaPagada, completo, saldoRestante } = await facturacion.confirmarPago(
        notaPagar,
        { ...formPago, monto_abono: formPago.tipo_pago === 'abono' ? formPago.monto_abono : null },
        user.id
      )
      if (error) {
        addToast(
          (notaPagada ? 'Nota pagada, pero falló el ingreso: ' : 'Error: ') + error.message,
          notaPagada ? 'warning' : 'error'
        )
        if (!notaPagada) return
      } else if (completo) {
        addToast('Pago confirmado: nota pagada + ingreso registrado ✓', 'success')
        if (servicioRenovado) {
          addToast(
            `🔄 Servicio renovado hasta ${format(new Date(servicioRenovado + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}`,
            'success'
          )
        }
      } else {
        addToast(`Abono registrado ✓ — saldo restante: ${fmtMonto(saldoRestante, notaPagar.moneda)}`, 'success')
      }
      setNotaPagar(null)
      cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'inténtalo de nuevo'), 'error')
    } finally {
      setConfirmando(false)
    }
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

  const saldoDe = (n) => Number(n.monto) - Number(n.abonado || 0)

  const totalPendiente = lista.filter(n => ['pendiente', 'vencida'].includes(n.estado))
    .reduce((s, n) => s + saldoDe(n), 0)

  const saldoNotaPagar = notaPagar ? saldoDe(notaPagar) : 0

  // Vista "Por cliente": agrupa las notas (sin anuladas) por cliente + mes de vencimiento
  const grupos = (() => {
    const mapa = {}
    for (const n of filtrados) {
      if (n.estado === 'anulada') continue
      const periodo = (n.fecha_vencimiento || '').slice(0, 7) // yyyy-MM
      const key = `${n.cliente_id}|${periodo}`
      if (!mapa[key]) mapa[key] = { cliente_id: n.cliente_id, nombre: n.clientes?.nombre || '—', periodo, notas: [] }
      mapa[key].notas.push(n)
    }
    return Object.values(mapa).sort((a, b) => b.periodo.localeCompare(a.periodo) || a.nombre.localeCompare(b.nombre))
  })()

  const notasAServicios = (notas) =>
    notas.map((n) => ({ nombre_servicio: n.concepto, tipo_renovacion: '', precio: n.monto, moneda: n.moneda }))

  const imprimirGrupo = (g) => {
    const cliente = clientesLista.find((c) => c.id === g.cliente_id) || { id: g.cliente_id, nombre: g.nombre }
    const ok = imprimirFacturaMensual(cliente, notasAServicios(g.notas), g.periodo, user?.email || '')
    if (!ok) addToast('Permite las ventanas emergentes para imprimir', 'warning')
  }

  const whatsappGrupo = (g) => {
    const cliente = clientesLista.find((c) => c.id === g.cliente_id)
    const numero = cliente?.whatsapp || cliente?.telefono
    if (!numero) { addToast(`${g.nombre} no tiene WhatsApp registrado. Agrégalo en Clientes.`, 'warning'); return }
    const texto = mensajeFactura(cliente, notasAServicios(g.notas), g.periodo, numeroFactura(cliente, g.periodo))
    abrirWhatsApp(numero, texto)
    addToast('Chat abierto con el resumen. Adjunta el PDF desde WhatsApp 📎', 'info')
  }

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
        <div className="flex rounded-xl overflow-hidden border border-slate-700 flex-shrink-0">
          <button
            onClick={() => setVista('lista')}
            className={`px-3 flex items-center gap-1.5 text-xs font-medium transition-colors ${
              vista === 'lista' ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
            title="Ver nota por nota"
          >
            <List className="w-3.5 h-3.5" /> Notas
          </button>
          <button
            onClick={() => setVista('clientes')}
            className={`px-3 flex items-center gap-1.5 text-xs font-medium transition-colors ${
              vista === 'clientes' ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
            }`}
            title="Agrupar por cliente y mes"
          >
            <Users className="w-3.5 h-3.5" /> Por Cliente
          </button>
        </div>
        <button onClick={() => { setForm(FORM_INICIAL); setModal(true) }} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nueva Nota
        </button>
      </div>

      {/* Vista agrupada por cliente + mes */}
      {vista === 'clientes' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="table-head text-left">Cliente</th>
                  <th className="table-head text-left">Mes</th>
                  <th className="table-head text-center hidden sm:table-cell">Notas</th>
                  <th className="table-head text-right">Total</th>
                  <th className="table-head text-right">Por cobrar</th>
                  <th className="table-head text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? (
                  <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-10">
                    Sin notas para agrupar
                  </td></tr>
                ) : grupos.map((g) => {
                  const totalUSD = g.notas.filter(n => n.moneda === 'USD').reduce((s, n) => s + Number(n.monto), 0)
                  const totalBS = g.notas.filter(n => n.moneda === 'BS').reduce((s, n) => s + Number(n.monto), 0)
                  const porCobrar = g.notas.filter(n => ['pendiente', 'vencida'].includes(n.estado))
                    .reduce((s, n) => s + saldoDe(n), 0)
                  const pagadas = g.notas.filter(n => n.estado === 'pagada').length
                  return (
                    <tr key={`${g.cliente_id}|${g.periodo}`} className="table-row">
                      <td className="table-cell font-medium text-slate-200">{g.nombre}</td>
                      <td className="table-cell text-slate-400 text-xs capitalize">
                        {format(new Date(g.periodo + '-01T00:00:00'), 'MMMM yyyy', { locale: es })}
                      </td>
                      <td className="table-cell text-center hidden sm:table-cell text-xs text-slate-400">
                        {g.notas.length} <span className="text-emerald-400">({pagadas} pagada{pagadas === 1 ? '' : 's'})</span>
                      </td>
                      <td className="table-cell text-right font-mono font-semibold text-slate-200">
                        {totalUSD > 0 && `$${totalUSD.toFixed(2)}`}
                        {totalUSD > 0 && totalBS > 0 && ' + '}
                        {totalBS > 0 && `Bs.${totalBS.toFixed(2)}`}
                      </td>
                      <td className="table-cell text-right font-mono font-semibold">
                        <span className={porCobrar > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                          {porCobrar > 0 ? `$${porCobrar.toFixed(2)}` : 'Al día ✓'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => imprimirGrupo(g)} className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg" title="Factura consolidada del mes (PDF)">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => whatsappGrupo(g)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Enviar resumen por WhatsApp">
                            <MessageCircle className="w-3.5 h-3.5" />
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
      )}

      {/* Tabla */}
      {vista === 'lista' && (
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
                    {Number(n.abonado) > 0 && n.estado !== 'pagada' && (
                      <span className="block text-[10px] font-normal text-emerald-400">
                        Abonado {fmtMonto(n.abonado, n.moneda)} · resta {fmtMonto(saldoDe(n), n.moneda)}
                      </span>
                    )}
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
                      <button
                        onClick={() => {
                          const ok = imprimirNotaPago(n, user?.email)
                          if (!ok) addToast('Permite las ventanas emergentes para imprimir', 'warning')
                        }}
                        className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg"
                        title="Imprimir / Guardar PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {n.estado !== 'pagada' && n.estado !== 'anulada' && (
                        <button onClick={() => abrirConfirmarPago(n)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg" title="Confirmar pago recibido">
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
      )}

      {/* Modal confirmar pago */}
      {notaPagar && (
        <Modal titulo="Confirmar Pago Recibido" onClose={() => setNotaPagar(null)}>
          <form onSubmit={confirmarPago} className="space-y-4">
            {/* Resumen de la nota */}
            <div className="card !p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-brand-300">{notaPagar.numero}</p>
                <p className="text-sm font-medium text-slate-200 truncate">{notaPagar.clientes?.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{notaPagar.concepto}</p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="font-mono text-xl font-bold text-emerald-400">
                  {fmtMonto(saldoNotaPagar, notaPagar.moneda)}
                </p>
                {Number(notaPagar.abonado) > 0 && (
                  <p className="text-[10px] text-slate-500">
                    de {fmtMonto(notaPagar.monto, notaPagar.moneda)} (abonado {fmtMonto(notaPagar.abonado, notaPagar.moneda)})
                  </p>
                )}
              </div>
            </div>

            {/* Pago total o abono parcial */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormPago({ ...formPago, tipo_pago: 'total' })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  formPago.tipo_pago === 'total'
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Pago total ({fmtMonto(saldoNotaPagar, notaPagar.moneda)})
              </button>
              <button
                type="button"
                onClick={() => setFormPago({ ...formPago, tipo_pago: 'abono' })}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  formPago.tipo_pago === 'abono'
                    ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                Abono parcial
              </button>
            </div>

            {formPago.tipo_pago === 'abono' && (
              <div>
                <label className="label">Monto del abono ({notaPagar.moneda}) *</label>
                <input
                  type="number" step="0.01" min="0.01" max={saldoNotaPagar} className="input"
                  value={formPago.monto_abono}
                  onChange={e => setFormPago({ ...formPago, monto_abono: e.target.value })}
                  placeholder={`Máx. ${saldoNotaPagar.toFixed(2)}`}
                  required autoFocus
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Fecha del pago *</label>
                <input type="date" className="input" value={formPago.fecha_pago}
                  onChange={e => setFormPago({ ...formPago, fecha_pago: e.target.value })} required />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select className="input" value={formPago.metodo_pago}
                  onChange={e => setFormPago({ ...formPago, metodo_pago: e.target.value })}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {notaPagar.moneda === 'BS' && (
                <div>
                  <label className="label">Tasa BCV (Bs./$)</label>
                  <input type="number" step="0.01" min="0" className="input" value={formPago.tasa_cambio}
                    onChange={e => setFormPago({ ...formPago, tasa_cambio: e.target.value })}
                    placeholder="Ej: 45.50" />
                  {formPago.tasa_cambio > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      ≈ {fmtMonto(
                        (formPago.tipo_pago === 'abono' ? Number(formPago.monto_abono || 0) : saldoNotaPagar) / Number(formPago.tasa_cambio),
                        'USD'
                      )}
                    </p>
                  )}
                </div>
              )}
              <div className={notaPagar.moneda === 'BS' ? '' : 'col-span-2'}>
                <label className="label">Referencia bancaria</label>
                <input className="input" value={formPago.referencia}
                  onChange={e => setFormPago({ ...formPago, referencia: e.target.value })}
                  placeholder="Nº de comprobante" />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-400 bg-brand-500/[0.08] border border-brand-500/20 rounded-xl p-3">
              <Wallet className="w-4 h-4 text-brand-300 flex-shrink-0 mt-0.5" />
              {formPago.tipo_pago === 'abono' ? (
                <p>
                  Al registrar el abono: se crea el <b>ingreso</b> por el monto abonado y la nota
                  queda <b>pendiente por el saldo restante</b>. Cuando el abono complete el total,
                  la nota pasa a pagada automáticamente.
                </p>
              ) : (
                <p>
                  Al confirmar: la nota pasa a <b>pagada</b>, se registra el <b>ingreso</b> automáticamente
                  {notaPagar.servicio_cliente_id && <> y la <b>renovación del servicio se extiende</b> al siguiente período</>}.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setNotaPagar(null)} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={confirmando} className="btn-success">
                {confirmando
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><CheckCircle className="w-4 h-4" /> {formPago.tipo_pago === 'abono' ? 'Registrar Abono' : 'Confirmar Pago'}</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal nueva nota */}
      {modal && (
        <Modal titulo="Nueva Nota de Pago" onClose={() => setModal(false)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Cliente *</label>
              <select className="input" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})} required>
                <option value="">— Selecciona —</option>
                {clientesLista.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
