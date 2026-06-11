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
      .neq('tipo_renovacion', 'pago_unico')
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
      .neq('tipo_renovacion', 'pago_unico')
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

  obtenerPorCliente: (clienteId) =>
    supabase
      .from('notas_pago')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_emision', { ascending: false }),

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

  obtenerPorCliente: (clienteId) =>
    supabase
      .from('ingresos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_pago', { ascending: false }),

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

// ─── REPORTES / ANALÍTICA ─────────────────────────────────────────────────────

const aUSD = (r) => (r.moneda === 'USD' ? Number(r.monto) : Number(r.monto_usd || 0))

export const reportes = {
  /**
   * Serie mensual de ingresos vs gastos (en USD) para los últimos N meses.
   * Devuelve [{ anio, mes, ingresos, gastos, utilidad }]
   */
  serieMensual: async (meses = 12) => {
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1)
    const inicioISO = inicio.toISOString().split('T')[0]

    const [{ data: ing }, { data: gas }] = await Promise.all([
      supabase.from('ingresos')
        .select('fecha_pago, monto, moneda, monto_usd')
        .gte('fecha_pago', inicioISO),
      supabase.from('gastos')
        .select('mes, anio, monto, moneda'),
    ])

    const serie = []
    for (let i = 0; i < meses; i++) {
      const f = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
      serie.push({ anio: f.getFullYear(), mes: f.getMonth() + 1, ingresos: 0, gastos: 0 })
    }
    const buscar = (anio, mes) => serie.find((s) => s.anio === anio && s.mes === mes)

    for (const r of ing || []) {
      const f = new Date(r.fecha_pago + 'T00:00:00')
      const punto = buscar(f.getFullYear(), f.getMonth() + 1)
      if (punto) punto.ingresos += aUSD(r)
    }
    for (const g of gas || []) {
      const punto = buscar(g.anio, g.mes)
      if (punto) punto.gastos += Number(g.monto)
    }
    return serie.map((s) => ({ ...s, utilidad: s.ingresos - s.gastos }))
  },

  /** Serie de los 12 meses de un año específico (libro mayor) */
  serieAnio: async (anio) => {
    const [{ data: ing }, { data: gas }] = await Promise.all([
      supabase.from('ingresos')
        .select('fecha_pago, monto, moneda, monto_usd')
        .gte('fecha_pago', `${anio}-01-01`)
        .lte('fecha_pago', `${anio}-12-31`),
      supabase.from('gastos')
        .select('mes, monto')
        .eq('anio', anio),
    ])

    const serie = Array.from({ length: 12 }, (_, i) => ({ anio, mes: i + 1, ingresos: 0, gastos: 0 }))
    for (const r of ing || []) {
      const mes = Number(r.fecha_pago.split('-')[1])
      serie[mes - 1].ingresos += aUSD(r)
    }
    for (const g of gas || []) {
      if (g.mes >= 1 && g.mes <= 12) serie[g.mes - 1].gastos += Number(g.monto)
    }
    return serie.map((s) => ({ ...s, utilidad: s.ingresos - s.gastos }))
  },

  /** Gastos del mes agrupados por categoría: [{ categoria, total }] */
  gastosPorCategoria: async (mes, anio) => {
    const { data } = await supabase
      .from('gastos')
      .select('categoria, monto')
      .eq('mes', mes)
      .eq('anio', anio)
    const mapa = {}
    for (const g of data || []) {
      mapa[g.categoria] = (mapa[g.categoria] || 0) + Number(g.monto)
    }
    return Object.entries(mapa)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total)
  },

  /** Top clientes por ingresos (USD) de los últimos N meses */
  topClientes: async (meses = 12, limite = 5) => {
    const inicio = new Date()
    inicio.setMonth(inicio.getMonth() - meses)
    const { data } = await supabase
      .from('ingresos')
      .select('monto, moneda, monto_usd, clientes(nombre)')
      .gte('fecha_pago', inicio.toISOString().split('T')[0])
    const mapa = {}
    for (const r of data || []) {
      const nombre = r.clientes?.nombre || 'Sin cliente'
      mapa[nombre] = (mapa[nombre] || 0) + aUSD(r)
    }
    return Object.entries(mapa)
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limite)
  },

  /**
   * Ingreso recurrente mensual (MRR) proyectado de servicios activos en USD:
   * mensual = precio, anual = precio / 12. Pago único no cuenta.
   */
  mrr: async () => {
    const { data } = await supabase
      .from('servicios_clientes')
      .select('precio, moneda, tipo_renovacion')
      .eq('estado', 'activo')
      .neq('tipo_renovacion', 'pago_unico')
    let total = 0
    let activos = 0
    for (const s of data || []) {
      if (s.moneda !== 'USD') continue
      activos++
      total += s.tipo_renovacion === 'anual' ? Number(s.precio) / 12 : Number(s.precio)
    }
    return { mrr: total, serviciosActivos: (data || []).length, serviciosUSD: activos }
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
