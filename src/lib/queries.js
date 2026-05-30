/**
 * Funciones de acceso a la base de datos (Supabase)
 * Todas las consultas filtran por user_id automáticamente via RLS
 */
import { supabase } from './supabase'

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  logout: () => supabase.auth.signOut(),

  getUser: () => supabase.auth.getUser(),

  resetPassword: (email) =>
    supabase.auth.resetPasswordForEmail(email),
}

// ─── INICIALIZACIÓN ────────────────────────────────────────────────────────────

/** Inserta tipos de servicio predeterminados si el usuario es nuevo */
export async function inicializarDatos(userId) {
  // Filtra por user_id para evitar race conditions con múltiples llamadas
  const { data: existing } = await supabase
    .from('tipos_servicio')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (existing && existing.length === 0) {
    const tipos = [
      { nombre: 'Página Web', descripcion: 'Desarrollo y mantenimiento web', precio_base: 30, user_id: userId },
      { nombre: 'Bot', descripcion: 'Bot de WhatsApp, Telegram o redes sociales', precio_base: 20, user_id: userId },
      { nombre: 'Agente IA', descripcion: 'Agente de inteligencia artificial personalizado', precio_base: 50, user_id: userId },
      { nombre: 'Software', descripcion: 'Software o sistema personalizado', precio_base: 80, user_id: userId },
      { nombre: 'Automatización', descripcion: 'Flujos de automatización de procesos', precio_base: 40, user_id: userId },
    ]
    await supabase.from('tipos_servicio').insert(tipos)
  }
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

export const clientes = {
  obtenerTodos: () =>
    supabase
      .from('clientes')
      .select('*')
      .order('nombre'),

  obtenerUno: (id) =>
    supabase
      .from('clientes')
      .select(`
        *,
        servicios_clientes(*, tipos_servicio(nombre)),
        notas_pago(id, monto, moneda, estado, fecha_vencimiento)
      `)
      .eq('id', id)
      .single(),

  crear: (datos) =>
    supabase.from('clientes').insert(datos).select().single(),

  actualizar: (id, datos) =>
    supabase.from('clientes').update(datos).eq('id', id).select().single(),

  eliminar: (id) =>
    supabase.from('clientes').delete().eq('id', id),

  cambiarEstado: (id, estado) =>
    supabase.from('clientes').update({ estado }).eq('id', id),
}

// ─── TIPOS DE SERVICIO ────────────────────────────────────────────────────────

export const tiposServicio = {
  obtenerTodos: () =>
    supabase.from('tipos_servicio').select('*').order('nombre'),

  crear: (datos) =>
    supabase.from('tipos_servicio').insert(datos).select().single(),

  actualizar: (id, datos) =>
    supabase.from('tipos_servicio').update(datos).eq('id', id),

  eliminar: (id) =>
    supabase.from('tipos_servicio').delete().eq('id', id),
}

// ─── SERVICIOS DE CLIENTES ────────────────────────────────────────────────────

export const serviciosClientes = {
  obtenerTodos: () =>
    supabase
      .from('servicios_clientes')
      .select(`
        *,
        clientes(nombre, email),
        tipos_servicio(nombre)
      `)
      .order('fecha_renovacion'),

  obtenerPorCliente: (clienteId) =>
    supabase
      .from('servicios_clientes')
      .select('*, tipos_servicio(nombre)')
      .eq('cliente_id', clienteId)
      .order('fecha_renovacion'),

  obtenerProximosVencer: (dias = 7) => {
    const hoy = new Date()
    const limite = new Date(hoy)
    limite.setDate(hoy.getDate() + dias)
    return supabase
      .from('servicios_clientes')
      .select('*, clientes(nombre, email), tipos_servicio(nombre)')
      .eq('estado', 'activo')
      .lte('fecha_renovacion', limite.toISOString().split('T')[0])
      .gte('fecha_renovacion', hoy.toISOString().split('T')[0])
      .order('fecha_renovacion')
  },

  obtenerVencidos: () => {
    const hoy = new Date().toISOString().split('T')[0]
    return supabase
      .from('servicios_clientes')
      .select('*, clientes(nombre, email), tipos_servicio(nombre)')
      .eq('estado', 'activo')
      .lt('fecha_renovacion', hoy)
      .order('fecha_renovacion')
  },

  crear: (datos) =>
    supabase.from('servicios_clientes').insert(datos).select().single(),

  actualizar: (id, datos) =>
    supabase.from('servicios_clientes').update(datos).eq('id', id).select().single(),

  suspender: (id) =>
    supabase.from('servicios_clientes').update({ estado: 'suspendido' }).eq('id', id),

  reactivar: (id, nuevaFecha) =>
    supabase.from('servicios_clientes')
      .update({ estado: 'activo', fecha_renovacion: nuevaFecha })
      .eq('id', id),

  cancelar: (id) =>
    supabase.from('servicios_clientes').update({ estado: 'cancelado' }).eq('id', id),

  eliminar: (id) =>
    supabase.from('servicios_clientes').delete().eq('id', id),
}

// ─── NOTAS DE PAGO ────────────────────────────────────────────────────────────

export const notasPago = {
  obtenerTodas: () =>
    supabase
      .from('notas_pago')
      .select('*, clientes(nombre)')
      .order('fecha_vencimiento'),

  obtenerPendientes: () =>
    supabase
      .from('notas_pago')
      .select('*, clientes(nombre)')
      .in('estado', ['pendiente', 'vencida'])
      .order('fecha_vencimiento'),

  crear: async (datos) => {
    // Auto-generar número de nota
    const { count } = await supabase
      .from('notas_pago')
      .select('id', { count: 'exact', head: true })
    const numero = `NP-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
    return supabase.from('notas_pago').insert({ ...datos, numero }).select().single()
  },

  actualizar: (id, datos) =>
    supabase.from('notas_pago').update(datos).eq('id', id).select().single(),

  marcarPagada: (id) =>
    supabase.from('notas_pago').update({ estado: 'pagada' }).eq('id', id),

  eliminar: (id) =>
    supabase.from('notas_pago').delete().eq('id', id),

  /** Actualizar notas vencidas automáticamente */
  actualizarVencidas: async () => {
    const hoy = new Date().toISOString().split('T')[0]
    return supabase
      .from('notas_pago')
      .update({ estado: 'vencida' })
      .eq('estado', 'pendiente')
      .lt('fecha_vencimiento', hoy)
  },
}

// ─── INGRESOS ─────────────────────────────────────────────────────────────────

export const ingresos = {
  obtenerTodos: (limite = 100) =>
    supabase
      .from('ingresos')
      .select('*, clientes(nombre)')
      .order('fecha_pago', { ascending: false })
      .limit(limite),

  obtenerPorMes: (mes, anio) => {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
    const fin = new Date(anio, mes, 0).toISOString().split('T')[0]
    return supabase
      .from('ingresos')
      .select('*, clientes(nombre)')
      .gte('fecha_pago', inicio)
      .lte('fecha_pago', fin)
      .order('fecha_pago', { ascending: false })
  },

  crear: (datos) =>
    supabase.from('ingresos').insert(datos).select().single(),

  actualizar: (id, datos) =>
    supabase.from('ingresos').update(datos).eq('id', id),

  eliminar: (id) =>
    supabase.from('ingresos').delete().eq('id', id),

  totalMes: async (mes, anio) => {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
    const fin = new Date(anio, mes, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('ingresos')
      .select('monto, moneda, monto_usd')
      .gte('fecha_pago', inicio)
      .lte('fecha_pago', fin)
    return data?.reduce((sum, r) =>
      sum + (r.moneda === 'USD' ? Number(r.monto) : Number(r.monto_usd || 0)), 0) || 0
  },
}

// ─── GASTOS ───────────────────────────────────────────────────────────────────

export const gastos = {
  obtenerTodos: () =>
    supabase.from('gastos').select('*').order('nombre'),

  obtenerPorMes: (mes, anio) =>
    supabase
      .from('gastos')
      .select('*')
      .eq('mes', mes)
      .eq('anio', anio)
      .order('nombre'),

  crear: (datos) =>
    supabase.from('gastos').insert(datos).select().single(),

  actualizar: (id, datos) =>
    supabase.from('gastos').update(datos).eq('id', id),

  marcarPagado: (id) =>
    supabase.from('gastos').update({ estado: 'pagado' }).eq('id', id),

  eliminar: (id) =>
    supabase.from('gastos').delete().eq('id', id),

  /** Clonar gastos recurrentes al nuevo mes */
  clonarRecurrentes: async (mesOrigen, anioOrigen, mesDestino, anioDestino) => {
    const { data: gastosOrigen } = await supabase
      .from('gastos')
      .select('*')
      .eq('mes', mesOrigen)
      .eq('anio', anioOrigen)
      .eq('es_recurrente', true)

    if (!gastosOrigen || gastosOrigen.length === 0) return null

    const nuevos = gastosOrigen.map(({ id, created_at, updated_at, ...g }) => ({
      ...g,
      mes: mesDestino,
      anio: anioDestino,
      estado: 'pendiente',
    }))
    return supabase.from('gastos').insert(nuevos)
  },

  totalMes: async (mes, anio) => {
    const { data } = await supabase
      .from('gastos')
      .select('monto, moneda')
      .eq('mes', mes)
      .eq('anio', anio)
    return data?.reduce((sum, g) => sum + Number(g.monto), 0) || 0
  },
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

export async function obtenerResumenDashboard() {
  const hoy = new Date()
  const mes = hoy.getMonth() + 1
  const anio = hoy.getFullYear()
  const enDias = (d) => {
    const f = new Date(hoy); f.setDate(hoy.getDate() + d)
    return f.toISOString().split('T')[0]
  }

  const [
    { count: totalClientes },
    { count: clientesActivos },
    { data: notasPendientes },
    { data: serviciosVencer },
    { data: serviciosVencidos },
    totalIngresosMes,
    totalGastosMes,
  ] = await Promise.all([
    supabase.from('clientes').select('id', { count: 'exact', head: true }),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('estado', 'activo'),
    supabase.from('notas_pago').select('monto, moneda').in('estado', ['pendiente', 'vencida']),
    supabase.from('servicios_clientes')
      .select('id, nombre_servicio, fecha_renovacion, clientes(nombre)')
      .eq('estado', 'activo')
      .lte('fecha_renovacion', enDias(10))
      .gte('fecha_renovacion', hoy.toISOString().split('T')[0])
      .order('fecha_renovacion').limit(5),
    supabase.from('servicios_clientes')
      .select('id, nombre_servicio, fecha_renovacion, clientes(nombre)')
      .eq('estado', 'activo')
      .lt('fecha_renovacion', hoy.toISOString().split('T')[0])
      .order('fecha_renovacion').limit(5),
    ingresos.totalMes(mes, anio),
    gastos.totalMes(mes, anio),
  ])

  const totalCobrar = notasPendientes?.reduce((s, n) => s + Number(n.monto), 0) || 0

  return {
    totalClientes: totalClientes || 0,
    clientesActivos: clientesActivos || 0,
    totalCobrar,
    serviciosVencer: serviciosVencer || [],
    serviciosVencidos: serviciosVencidos || [],
    totalIngresosMes,
    totalGastosMes,
    utilidadMes: totalIngresosMes - totalGastosMes,
  }
}
