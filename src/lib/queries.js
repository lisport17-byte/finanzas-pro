/**
 * Funciones de acceso a la base de datos (Supabase)
 * Todas las consultas filtran por user_id automáticamente via RLS
 */
import { supabase } from './supabase'
import { addMonths, addYears, format as fmtFecha } from 'date-fns'

/**
 * Convierte cadenas vacías a NULL antes de insertar/actualizar.
 * Los <select> opcionales envían '' y PostgreSQL rechaza '' en columnas
 * uuid/integer/date ("invalid input syntax for type uuid").
 */
const limpiar = (datos) => {
  const out = {}
  for (const [k, v] of Object.entries(datos)) out[k] = v === '' ? null : v
  return out
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const auth = {
  login: (email, password) =>
    supabase.auth.signInWithPassword({ email, password }),

  logout: () => supabase.auth.signOut(),

  getUser: () => supabase.auth.getUser(),

  /** Envía el correo de recuperación; el enlace vuelve a esta misma app */
  resetPassword: (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    }),

  /** Cambia la contraseña del usuario ya autenticado (flujo de recuperación) */
  actualizarPassword: (password) => supabase.auth.updateUser({ password }),
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
    supabase.from('clientes').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('clientes').update(limpiar(datos)).eq('id', id).select().single(),

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
    supabase.from('tipos_servicio').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('tipos_servicio').update(limpiar(datos)).eq('id', id),

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
    supabase.from('servicios_clientes').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('servicios_clientes').update(limpiar(datos)).eq('id', id).select().single(),

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
    return supabase.from('notas_pago').insert(limpiar({ ...datos, numero })).select().single()
  },

  obtenerPorCliente: (clienteId) =>
    supabase
      .from('notas_pago')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('fecha_emision', { ascending: false }),

  actualizar: (id, datos) =>
    supabase.from('notas_pago').update(limpiar(datos)).eq('id', id).select().single(),

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
    supabase.from('ingresos').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('ingresos').update(limpiar(datos)).eq('id', id),

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
    supabase.from('gastos').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('gastos').update(limpiar(datos)).eq('id', id),

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

// ─── FACTURACIÓN AUTOMÁTICA ───────────────────────────────────────────────────

export const facturacion = {
  /**
   * Genera notas de cobro para servicios activos (mensual/anual) cuya renovación
   * vence dentro de `diasAnticipacion` días o ya venció. Idempotente: una sola
   * nota por servicio y período (clave: servicio_cliente_id + fecha_vencimiento).
   * Se ejecuta al abrir la app — no requiere servidor.
   */
  generarNotasRenovacion: async (userId, diasAnticipacion = 7) => {
    const hoy = new Date()
    // Regla de facturación: desde el día 1 del mes ya se emiten las CXC de
    // TODOS los servicios que renuevan dentro del mes en curso (aunque el
    // período aún no venza). Además cubre los próximos `diasAnticipacion`
    // días, para renovaciones de los primeros días del mes siguiente.
    const finDeMes = fmtFecha(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0), 'yyyy-MM-dd')
    const inicioMes = fmtFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1), 'yyyy-MM-dd')
    const porAnticipacion = fmtFecha(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasAnticipacion), 'yyyy-MM-dd')
    const limite = porAnticipacion > finDeMes ? porAnticipacion : finDeMes

    const [{ data: renovaciones }, { data: contratados }] = await Promise.all([
      supabase
        .from('servicios_clientes')
        .select('id, cliente_id, nombre_servicio, precio, moneda, tipo_renovacion, fecha_renovacion')
        .eq('estado', 'activo')
        .in('tipo_renovacion', ['mensual', 'anual'])
        .lte('fecha_renovacion', limite),
      // Primer período: servicios contratados este mes (incluye pago único) —
      // la venta se cobra al inicio, no hay que esperar a la renovación
      supabase
        .from('servicios_clientes')
        .select('id, cliente_id, nombre_servicio, precio, moneda, tipo_renovacion, fecha_inicio')
        .eq('estado', 'activo')
        .gte('fecha_inicio', inicioMes)
        .lte('fecha_inicio', finDeMes),
    ])

    const ids = [...new Set([...(renovaciones || []), ...(contratados || [])].map((s) => s.id))]
    if (!ids.length) return { creadas: 0 }

    // Notas ya emitidas para esos servicios (cualquier estado, incluso anuladas:
    // si el usuario anuló una, no se la volvemos a generar)
    const { data: notas } = await supabase
      .from('notas_pago')
      .select('servicio_cliente_id, fecha_vencimiento')
      .in('servicio_cliente_id', ids)

    const yaEmitidas = new Set((notas || []).map((n) => `${n.servicio_cliente_id}|${n.fecha_vencimiento}`))
    const porFacturar = [
      ...(contratados || [])
        .filter((s) => Number(s.precio) > 0 && !yaEmitidas.has(`${s.id}|${s.fecha_inicio}`))
        .map((s) => ({ ...s, concepto: `Contratación — ${s.nombre_servicio}`, vence: s.fecha_inicio })),
      ...(renovaciones || [])
        .filter((s) => Number(s.precio) > 0 && !yaEmitidas.has(`${s.id}|${s.fecha_renovacion}`))
        .map((s) => ({ ...s, concepto: `Renovación ${s.tipo_renovacion} — ${s.nombre_servicio}`, vence: s.fecha_renovacion })),
    ]

    let creadas = 0
    // Secuencial para que la numeración NP-AAAA-NNN no se repita
    for (const s of porFacturar) {
      const { error } = await notasPago.crear({
        cliente_id: s.cliente_id,
        servicio_cliente_id: s.id,
        concepto: s.concepto,
        monto: Number(s.precio),
        moneda: s.moneda,
        fecha_emision: fmtFecha(hoy, 'yyyy-MM-dd'),
        fecha_vencimiento: s.vence,
        estado: 'pendiente',
        user_id: userId,
      })
      if (!error) creadas++
    }
    return { creadas }
  },

  /**
   * Confirma un pago (total o abono parcial) de una nota en un solo paso:
   * 1) acumula el abono; si cubre el monto, marca la nota como pagada
   * 2) registra el ingreso por lo pagado (con tasa BCV si fue en Bs)
   * 3) si quedó pagada y viene de un servicio, extiende su fecha_renovacion
   *    al siguiente período (anclado al vencimiento, no a la fecha de pago)
   * `monto_abono`: null/vacío = pago total del saldo restante.
   */
  confirmarPago: async (nota, { fecha_pago, metodo_pago, referencia, tasa_cambio, monto_abono }, userId) => {
    const total = Number(nota.monto)
    const abonadoPrevio = Number(nota.abonado || 0)
    const saldo = total - abonadoPrevio
    const pago = monto_abono ? Math.min(Number(monto_abono), saldo) : saldo
    const nuevoAbonado = abonadoPrevio + pago
    const completo = nuevoAbonado >= total - 0.009

    const { error: errNota } = await supabase
      .from('notas_pago')
      .update({ abonado: nuevoAbonado, ...(completo ? { estado: 'pagada' } : {}) })
      .eq('id', nota.id)
    if (errNota) return { error: errNota }

    const esBS = nota.moneda === 'BS'
    const tasa = tasa_cambio ? Number(tasa_cambio) : null
    const esAbono = !completo || abonadoPrevio > 0
    const { error: errIngreso } = await supabase.from('ingresos').insert(limpiar({
      cliente_id: nota.cliente_id,
      nota_pago_id: nota.id,
      concepto: `${esAbono ? 'Abono ' : ''}${nota.numero || 'Pago'} — ${nota.concepto}`,
      monto: pago,
      moneda: nota.moneda,
      tasa_cambio: esBS ? tasa : null,
      monto_usd: esBS ? (tasa ? Number((pago / tasa).toFixed(2)) : null) : pago,
      fecha_pago,
      metodo_pago,
      referencia: referencia || null,
      user_id: userId,
    }))
    if (errIngreso) return { error: errIngreso, notaPagada: completo }

    // Si fue solo un abono parcial, no se renueva el servicio todavía
    if (!completo) return { error: null, completo: false, saldoRestante: total - nuevoAbonado }

    // Extender la renovación del servicio vinculado
    let servicioRenovado = null
    if (nota.servicio_cliente_id) {
      const { data: s } = await supabase
        .from('servicios_clientes')
        .select('id, fecha_renovacion, tipo_renovacion')
        .eq('id', nota.servicio_cliente_id)
        .single()
      // Solo si el servicio sigue en el período de esta nota (evita doble extensión
      // si ya se renovó manualmente desde Alertas)
      if (s && s.tipo_renovacion !== 'pago_unico' && s.fecha_renovacion <= nota.fecha_vencimiento) {
        const base = new Date(s.fecha_renovacion + 'T00:00:00')
        const nueva = s.tipo_renovacion === 'anual' ? addYears(base, 1) : addMonths(base, 1)
        const nuevaFecha = fmtFecha(nueva, 'yyyy-MM-dd')
        const { error: errSvc } = await supabase
          .from('servicios_clientes')
          .update({ fecha_renovacion: nuevaFecha, estado: 'activo' })
          .eq('id', s.id)
        if (!errSvc) servicioRenovado = nuevaFecha
      }
    }
    return { error: null, servicioRenovado, completo: true, saldoRestante: 0 }
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
    supabase.from('notas_pago').select('monto, moneda, abonado').in('estado', ['pendiente', 'vencida']),
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

  const totalCobrar = notasPendientes?.reduce((s, n) => s + Number(n.monto) - Number(n.abonado || 0), 0) || 0

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
