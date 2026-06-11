import { useEffect, useState } from 'react'
import { clientes as db, serviciosClientes as dbServicios, notasPago as dbNotas, ingresos as dbIngresos } from '../lib/queries'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import { imprimirEstadoCuenta, abrirVentanaImpresion } from '../lib/pdf'
import { Plus, Search, Edit2, Trash2, UserCheck, UserX, Phone, Mail, Building, FileText } from 'lucide-react'

const ESTADO_BADGE = {
  activo:     'badge-active',
  suspendido: 'badge-suspended',
  inactivo:   'badge-inactive',
}

const FORM_INICIAL = {
  nombre: '', email: '', telefono: '', empresa: '', pais: 'Venezuela', notas: '', estado: 'activo'
}

export default function Clientes() {
  const [lista, setLista] = useState([])
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null) // null | 'crear' | 'editar'
  const [seleccionado, setSeleccionado] = useState(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const { addToast, setClientes, user } = useStore()

  const cargar = async () => {
    try {
      const { data } = await db.obtenerTodos()
      setLista(data || [])
      setClientes(data || [])
    } catch (err) {
      addToast('No se pudieron cargar los clientes: ' + (err?.message || 'revisa tu conexión'), 'error')
    }
  }

  const estadoCuenta = async (c) => {
    // Abrir la ventana ANTES de los await — los navegadores bloquean
    // popups que no son respuesta directa al clic del usuario
    const win = abrirVentanaImpresion()
    if (!win) { addToast('Permite las ventanas emergentes para imprimir', 'warning'); return }
    win.document.write('<p style="font-family:sans-serif;color:#475569;padding:40px;">Generando estado de cuenta...</p>')
    try {
      const [{ data: servicios }, { data: notas }, { data: pagos }] = await Promise.all([
        dbServicios.obtenerPorCliente(c.id),
        dbNotas.obtenerPorCliente(c.id),
        dbIngresos.obtenerPorCliente(c.id),
      ])
      imprimirEstadoCuenta(c, servicios || [], notas || [], pagos || [], win)
    } catch (err) {
      win.close()
      addToast('Error al generar: ' + (err?.message || 'inténtalo de nuevo'), 'error')
    }
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => {
    setForm(FORM_INICIAL)
    setSeleccionado(null)
    setModal('crear')
  }

  const abrirEditar = (c) => {
    setForm({ nombre: c.nombre, email: c.email || '', telefono: c.telefono || '',
      empresa: c.empresa || '', pais: c.pais || 'Venezuela', notas: c.notas || '', estado: c.estado })
    setSeleccionado(c)
    setModal('editar')
  }

  const cerrar = () => { setModal(null); setSeleccionado(null) }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
      const datos = { ...form, user_id: user.id }
      const { error } = modal === 'crear'
        ? await db.crear(datos)
        : await db.actualizar(seleccionado.id, form)
      if (error) { addToast('Error al guardar: ' + error.message, 'error'); return }
      addToast(modal === 'crear' ? 'Cliente creado ✓' : 'Cliente actualizado ✓', 'success')
      cerrar()
      cargar()
    } catch (err) {
      addToast('Error de conexión: ' + (err?.message || 'Inténtalo de nuevo'), 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar cliente "${c.nombre}"? Esto eliminará todos sus servicios y datos.`)) return
    const { error } = await db.eliminar(c.id)
    if (error) { addToast('Error al eliminar: ' + error.message, 'error'); return }
    addToast('Cliente eliminado', 'info')
    cargar()
  }

  const toggleEstado = async (c) => {
    const nuevo = c.estado === 'activo' ? 'suspendido' : 'activo'
    await db.cambiarEstado(c.id, nuevo)
    addToast(`Cliente ${nuevo === 'activo' ? 'reactivado' : 'suspendido'}`, 'info')
    cargar()
  }

  const filtrados = lista.filter((c) =>
    `${c.nombre} ${c.email} ${c.empresa}`.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre, email o empresa..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button onClick={abrirCrear} className="btn-primary whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', valor: lista.length, color: 'text-slate-300' },
          { label: 'Activos', valor: lista.filter(c => c.estado === 'activo').length, color: 'text-emerald-400' },
          { label: 'Suspendidos', valor: lista.filter(c => c.estado === 'suspendido').length, color: 'text-amber-400' },
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
                <th className="table-head text-left">Cliente</th>
                <th className="table-head text-left hidden md:table-cell">Contacto</th>
                <th className="table-head text-left hidden lg:table-cell">Empresa</th>
                <th className="table-head text-center">Estado</th>
                <th className="table-head text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-slate-500 py-10">
                    {filtro ? 'Sin resultados para la búsqueda' : 'Aún no hay clientes registrados'}
                  </td>
                </tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-900/50 border border-indigo-700/30 flex items-center justify-center text-indigo-400 text-sm font-bold flex-shrink-0">
                          {c.nombre[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{c.nombre}</p>
                          <p className="text-xs text-slate-500">{c.pais}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <div className="space-y-0.5">
                        {c.email && (
                          <p className="flex items-center gap-1 text-xs text-slate-400">
                            <Mail className="w-3 h-3" /> {c.email}
                          </p>
                        )}
                        {c.telefono && (
                          <p className="flex items-center gap-1 text-xs text-slate-400">
                            <Phone className="w-3 h-3" /> {c.telefono}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell hidden lg:table-cell text-slate-400">
                      {c.empresa && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" /> {c.empresa}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <span className={ESTADO_BADGE[c.estado] || 'badge-inactive'}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => estadoCuenta(c)}
                          className="p-1.5 text-slate-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors"
                          title="Estado de cuenta (PDF)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => abrirEditar(c)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleEstado(c)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            c.estado === 'activo'
                              ? 'text-slate-400 hover:text-amber-400 hover:bg-amber-900/30'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30'
                          }`}
                          title={c.estado === 'activo' ? 'Suspender' : 'Reactivar'}
                        >
                          {c.estado === 'activo' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => eliminar(c)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <Modal titulo={modal === 'crear' ? 'Nuevo Cliente' : 'Editar Cliente'} onClose={cerrar}>
          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Nombre completo *</label>
                <input className="input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="label">Correo electrónico</label>
                <input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="juan@email.com" />
              </div>
              <div>
                <label className="label">Teléfono / WhatsApp</label>
                <input className="input" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} placeholder="+58 412..." />
              </div>
              <div>
                <label className="label">Empresa</label>
                <input className="input" value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})} placeholder="Mi Empresa C.A." />
              </div>
              <div>
                <label className="label">País</label>
                <input className="input" value={form.pais} onChange={e => setForm({...form, pais: e.target.value})} placeholder="Venezuela" />
              </div>
              <div className="col-span-2">
                <label className="label">Estado</label>
                <select className="input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  <option value="activo">Activo</option>
                  <option value="suspendido">Suspendido</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input h-20 resize-none" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Observaciones sobre el cliente..." />
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
