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

// ─── CRÉDITOS / FINANCIAMIENTO ────────────────────────────────────────────────
// Deudas propias: giros de tarjeta de crédito, préstamos bancarios y préstamos
// de personas naturales, pagaderos en cuotas. Cada cuota pagada se registra
// automáticamente como GASTO (categoría "financiamiento") para que fluya a
// Reportes y Dashboard sin doble contabilidad.

export const creditos = {
  obtenerTodos: () =>
    supabase
      .from('creditos')
      .select('*')
      .order('estado')
      .order('fecha_inicio', { ascending: false }),

  obtenerPagos: (creditoId) =>
    supabase
      .from('creditos_pagos')
      .select('*')
      .eq('credito_id', creditoId)
      .order('fecha_pago', { ascending: false }),

  crear: (datos) =>
    supabase.from('creditos').insert(limpiar(datos)).select().single(),

  actualizar: (id, datos) =>
    supabase.from('creditos').update(limpiar(datos)).eq('id', id).select().single(),

  eliminar: (id) =>
    supabase.from('creditos').delete().eq('id', id),

  /**
   * Registra el pago de una cuota en un solo paso:
   * 1) crea el GASTO del mes (categoría financiamiento) → entra a Reportes
   * 2) guarda el pago en el historial del crédito (vinculado al gasto)
   * 3) acumula lo abonado; si cubre el total, el crédito pasa a "pagado"
   */
  pagarCuota: async (credito, { monto, fecha_pago, metodo_pago, referencia }, userId) => {
    const pago = Number(monto)
    const f = new Date(fecha_pago + 'T00:00:00')
    const numeroCuota = Math.min((credito.cuotas_pagadas || 0) + 1, credito.num_cuotas)

    const { data: gasto, error: errGasto } = await supabase.from('gastos').insert(limpiar({
      nombre: `Cuota ${numeroCuota}/${credito.num_cuotas} — ${credito.acreedor}`,
      categoria: 'financiamiento',
      monto: pago,
      moneda: credito.moneda,
      mes: f.getMonth() + 1,
      anio: f.getFullYear(),
      es_recurrente: false,
      estado: 'pagado',
      proveedor: credito.acreedor,
      user_id: userId,
    })).select().single()
    if (errGasto) return { error: errGasto }

    const { error: errPago } = await supabase.from('creditos_pagos').insert(limpiar({
      credito_id: credito.id,
      numero_cuota: numeroCuota,
      monto: pago,
      moneda: credito.moneda,
      fecha_pago,
      metodo_pago,
      referencia: referencia || null,
      gasto_id: gasto?.id || null,
      user_id: userId,
    }))
    if (errPago) return { error: errPago }

    const abonado = Number(credito.abonado || 0) + pago
    const saldado = abonado >= Number(credito.monto_total) - 0.009
    const { error: errCred } = await supabase
      .from('creditos')
      .update({
        abonado,
        cuotas_pagadas: (credito.cuotas_pagadas || 0) + 1,
        ...(saldado ? { estado: 'pagado' } : {}),
      })
      .eq('id', credito.id)
    if (errCred) return { error: errCred }

    return { error: null, saldado, saldoRestante: Math.max(0, Number(credito.monto_total) - abonado) }
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

    let { error: errNota } = await supabase
      .from('notas_pago')
      .update({ abonado: nuevoAbonado, ...(completo ? { estado: 'pagada' } : {}) })
      .eq('id', nota.id)
    // Compatibilidad: si la columna `abonado` aún no existe en la BD
    // (migración supabase-pendiente.sql sin ejecutar), el pago total
    // funciona igual que antes y el abono avisa qué falta.
    if (errNota && /abonado/i.test(errNota.message || '')) {
      if (!completo) {
        return { error: { message: 'Para abonos parciales ejecuta primero supabase-pendiente.sql en Supabase (falta la columna "abonado").' } }
      }
      ;({ error: errNota } = await supabase
        .from('notas_pago').update({ estado: 'pagada' }).eq('id', nota.id))
    }
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

// ─── PROYECCIÓN Y SALUD FINANCIERA ────────────────────────────────────────────
// Responde: ¿puedo asumir otra cuota? ¿en qué mes se aprieta el flujo?
// Todo el análisis va en USD; los compromisos en Bs se reportan aparte para
// no mezclar monedas sin una tasa confiable.

// Helpers locales de formato (queries.js no importa la capa de presentación)
const fmtUSD_ = (n) => `$${Number(n || 0).toFixed(2)}`
const MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** Umbrales de la banca para evaluar capacidad de endeudamiento */
export const UMBRALES = {
  DSCR_SANO: 1.5,      // cobertura del servicio de deuda (holgura del 50%)
  DSCR_MINIMO: 1.2,    // por debajo: riesgo de impago
  CARGA_SANA: 0.30,    // cuotas / ingreso recurrente
  CARGA_MAXIMA: 0.40,  // por encima: sobreendeudamiento
  USO_FLUJO_LIBRE: 0.70, // % del flujo libre que es prudente comprometer
  CONCENTRACION_RIESGO: 0.40, // un cliente con más de esto es riesgo
}

export const proyeccion = {
  analizar: async (meses = 6) => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes0 = hoy.getMonth() // 0-based
    const inicioMes = new Date(anio, mes0, 1)
    const finHorizonte = new Date(anio, mes0 + meses, 0)
    const inicioMesISO = fmtFecha(inicioMes, 'yyyy-MM-dd')
    const finISO = fmtFecha(finHorizonte, 'yyyy-MM-dd')
    const finMesActualISO = fmtFecha(new Date(anio, mes0 + 1, 0), 'yyyy-MM-dd')

    const [
      { data: notasHorizonte },
      { data: notasAtrasadas },
      { data: servicios },
      { data: gastosMes },
      { data: creds },
      { data: ingresosMes },
    ] = await Promise.all([
      supabase.from('notas_pago')
        .select('servicio_cliente_id, fecha_vencimiento, estado, monto, moneda, abonado, clientes(nombre)')
        .gte('fecha_vencimiento', inicioMesISO).lte('fecha_vencimiento', finISO),
      supabase.from('notas_pago')
        .select('monto, moneda, abonado, fecha_vencimiento, clientes(nombre)')
        .in('estado', ['pendiente', 'vencida']).lt('fecha_vencimiento', inicioMesISO),
      supabase.from('servicios_clientes')
        .select('id, nombre_servicio, precio, moneda, tipo_renovacion, fecha_renovacion, clientes(nombre)')
        .eq('estado', 'activo'),
      supabase.from('gastos')
        .select('nombre, categoria, monto, moneda, es_recurrente')
        .eq('mes', mes0 + 1).eq('anio', anio),
      supabase.from('creditos').select('*').eq('estado', 'activo'),
      supabase.from('ingresos')
        .select('monto, moneda, monto_usd')
        .gte('fecha_pago', inicioMesISO).lte('fecha_pago', finMesActualISO),
    ])

    const enUSD = (monto, moneda) => (moneda === 'USD' ? Number(monto) : 0)
    const enBS = (monto, moneda) => (moneda === 'BS' ? Number(monto) : 0)

    // ── Buckets mensuales del horizonte ────────────────────────────────────
    const buckets = Array.from({ length: meses }, (_, i) => {
      const f = new Date(anio, mes0 + i, 1)
      return {
        anio: f.getFullYear(), mes: f.getMonth() + 1, clave: fmtFecha(f, 'yyyy-MM'),
        cobrado: 0, porCobrar: 0, recurrente: 0, gastos: 0, cuotas: 0,
        gastosBS: 0, cuotasBS: 0, compromisos: [],
      }
    })
    const bucketDe = (iso) => buckets.find((b) => b.clave === (iso || '').slice(0, 7))

    // Ya cobrado este mes (el mes en curso se ve completo, no solo lo futuro)
    buckets[0].cobrado = (ingresosMes || [])
      .reduce((s, r) => s + (r.moneda === 'USD' ? Number(r.monto) : Number(r.monto_usd || 0)), 0)

    // Cartera atrasada: se espera cobrar en el mes en curso
    const carteraAtrasada = (notasAtrasadas || [])
      .reduce((s, n) => s + enUSD(Number(n.monto) - Number(n.abonado || 0), n.moneda), 0)
    buckets[0].porCobrar += carteraAtrasada

    // Notas ya emitidas dentro del horizonte
    const emitidas = new Set()
    for (const n of notasHorizonte || []) {
      emitidas.add(`${n.servicio_cliente_id}|${n.fecha_vencimiento}`)
      if (!['pendiente', 'vencida'].includes(n.estado)) continue
      const b = bucketDe(n.fecha_vencimiento)
      if (b) b.porCobrar += enUSD(Number(n.monto) - Number(n.abonado || 0), n.moneda)
    }

    // Renovaciones futuras aún sin nota emitida (misma clave que la
    // facturación automática: servicio + fecha de vencimiento del período)
    for (const s of servicios || []) {
      if (s.tipo_renovacion === 'pago_unico' || Number(s.precio) <= 0) continue
      let f = new Date(s.fecha_renovacion + 'T00:00:00')
      for (let i = 0; i < 60 && f <= finHorizonte; i++) {
        const iso = fmtFecha(f, 'yyyy-MM-dd')
        if (f >= inicioMes && !emitidas.has(`${s.id}|${iso}`)) {
          const b = bucketDe(iso)
          if (b) b.recurrente += enUSD(s.precio, s.moneda)
        }
        f = s.tipo_renovacion === 'anual' ? addYears(f, 1) : addMonths(f, 1)
      }
    }

    // ── Egresos ────────────────────────────────────────────────────────────
    // Mes en curso: TODOS los gastos del mes (incluye cuotas ya pagadas como
    // gasto "financiamiento"). Meses futuros: solo la base recurrente, porque
    // las cuotas futuras se calculan del cronograma de créditos (sin duplicar).
    const gastosDelMes = gastosMes || []
    buckets[0].gastos = gastosDelMes.reduce((s, g) => s + enUSD(g.monto, g.moneda), 0)
    buckets[0].gastosBS = gastosDelMes.reduce((s, g) => s + enBS(g.monto, g.moneda), 0)

    const baseRecurrente = gastosDelMes
      .filter((g) => g.es_recurrente && g.categoria !== 'financiamiento')
    const gastoFijo = baseRecurrente.reduce((s, g) => s + enUSD(g.monto, g.moneda), 0)
    const gastoFijoBS = baseRecurrente.reduce((s, g) => s + enBS(g.monto, g.moneda), 0)
    for (let i = 1; i < buckets.length; i++) {
      buckets[i].gastos = gastoFijo
      buckets[i].gastosBS = gastoFijoBS
    }

    // Cronograma de cuotas PENDIENTES de cada crédito activo
    const creditos = creds || []
    const cuotaDe = (c) => {
      const saldo = Math.max(0, Number(c.monto_total) - Number(c.abonado || 0))
      return Math.min(Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas), saldo)
    }
    let servicioDeuda = 0, servicioDeudaBS = 0, deudaTotal = 0, deudaTotalBS = 0
    for (const c of creditos) {
      const saldo = Math.max(0, Number(c.monto_total) - Number(c.abonado || 0))
      deudaTotal += enUSD(saldo, c.moneda)
      deudaTotalBS += enBS(saldo, c.moneda)
      servicioDeuda += enUSD(cuotaDe(c), c.moneda)
      servicioDeudaBS += enBS(cuotaDe(c), c.moneda)

      const restantes = Math.max(0, Number(c.num_cuotas) - Number(c.cuotas_pagadas || 0))
      let pendiente = saldo
      for (let k = 1; k <= restantes && pendiente > 0.009; k++) {
        const f = addMonths(new Date(c.fecha_inicio + 'T00:00:00'), Number(c.cuotas_pagadas || 0) + k)
        if (c.dia_pago) {
          const ultimo = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()
          f.setDate(Math.min(c.dia_pago, ultimo))
        }
        const cuota = Math.min(Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas), pendiente)
        pendiente -= cuota
        if (f > finHorizonte) break
        const b = bucketDe(fmtFecha(f, 'yyyy-MM-dd'))
        if (!b) continue
        if (c.moneda === 'USD') b.cuotas += cuota
        else b.cuotasBS += cuota
        b.compromisos.push({
          acreedor: c.acreedor, monto: cuota, moneda: c.moneda,
          fecha: fmtFecha(f, 'yyyy-MM-dd'),
          cuota: Number(c.cuotas_pagadas || 0) + k, total: Number(c.num_cuotas),
        })
      }
    }

    // ── Flujo y acumulado ──────────────────────────────────────────────────
    let acumulado = 0
    const serie = buckets.map((b) => {
      const ingresos = b.cobrado + b.porCobrar + b.recurrente
      const egresos = b.gastos + b.cuotas
      const flujo = ingresos - egresos
      acumulado += flujo
      return { ...b, ingresos, egresos, flujo, acumulado }
    })

    // ── Indicadores de capacidad ───────────────────────────────────────────
    const mrr = (servicios || []).reduce((s, sv) => {
      if (sv.tipo_renovacion === 'pago_unico') return s
      const v = enUSD(sv.precio, sv.moneda)
      return s + (sv.tipo_renovacion === 'anual' ? v / 12 : v)
    }, 0)

    const capacidadPago = mrr - gastoFijo // flujo libre antes del servicio de deuda
    const dscr = servicioDeuda > 0 ? capacidadPago / servicioDeuda : null
    const cargaDeuda = mrr > 0 ? servicioDeuda / mrr : 0
    const porCobrarTotal = serie.reduce((s, b) => s + b.porCobrar, 0)

    // Cuota adicional segura: debe cumplir las TRES restricciones a la vez, así
    // que manda la más estricta. Si solo se mirara el flujo libre, la app podría
    // sugerir una cuota que luego el simulador marca en rojo por carga de deuda.
    const topes = {
      flujo: capacidadPago * UMBRALES.USO_FLUJO_LIBRE - servicioDeuda,
      carga: mrr * UMBRALES.CARGA_SANA - servicioDeuda,
      cobertura: capacidadPago / UMBRALES.DSCR_SANO - servicioDeuda,
    }
    const [limitante, topeMin] = Object.entries(topes).sort((a, b) => a[1] - b[1])[0]
    // Se redondea hacia abajo: en deuda, equivocarse por defecto es lo seguro
    const capacidadAdicional = Math.max(0, Math.floor(topeMin * 100) / 100)
    const ETIQUETA_LIMITE = {
      flujo: 'tu flujo libre disponible',
      carga: `el techo de carga de deuda (${UMBRALES.CARGA_SANA * 100}% del ingreso recurrente)`,
      cobertura: `la cobertura mínima sana (${UMBRALES.DSCR_SANO}×)`,
    }

    // Concentración de ingreso recurrente por cliente
    const porCliente = {}
    for (const sv of servicios || []) {
      if (sv.tipo_renovacion === 'pago_unico') continue
      const v = enUSD(sv.precio, sv.moneda)
      const mensual = sv.tipo_renovacion === 'anual' ? v / 12 : v
      const nombre = sv.clientes?.nombre || 'Sin cliente'
      porCliente[nombre] = (porCliente[nombre] || 0) + mensual
    }
    const top = Object.entries(porCliente).sort((a, b) => b[1] - a[1])[0]
    const concentracion = top && mrr > 0
      ? { nombre: top[0], monto: top[1], pct: top[1] / mrr }
      : null

    const mesesFlujoNegativo = serie.filter((b) => b.flujo < 0)
    const mesesSinCaja = serie.filter((b) => b.acumulado < 0)

    // ── Semáforo ───────────────────────────────────────────────────────────
    const razonesRojas = []
    if (capacidadPago <= 0)
      razonesRojas.push('tus gastos fijos ya consumen todo el ingreso recurrente')
    if (dscr !== null && dscr < UMBRALES.DSCR_MINIMO)
      razonesRojas.push(`la cobertura de deuda es ${dscr.toFixed(2)}× (mínimo sano ${UMBRALES.DSCR_MINIMO}×)`)
    if (cargaDeuda > UMBRALES.CARGA_MAXIMA)
      razonesRojas.push(`las cuotas consumen ${(cargaDeuda * 100).toFixed(0)}% del ingreso recurrente (máximo ${UMBRALES.CARGA_MAXIMA * 100}%)`)
    if (mesesSinCaja.length > 0)
      razonesRojas.push(`el flujo acumulado se vuelve negativo en ${mesesSinCaja.length} mes(es) del horizonte`)

    const razonesAmarillas = []
    if (dscr !== null && dscr >= UMBRALES.DSCR_MINIMO && dscr < UMBRALES.DSCR_SANO)
      razonesAmarillas.push(`la cobertura de deuda es ${dscr.toFixed(2)}× (holgura ideal ${UMBRALES.DSCR_SANO}×)`)
    if (cargaDeuda > UMBRALES.CARGA_SANA && cargaDeuda <= UMBRALES.CARGA_MAXIMA)
      razonesAmarillas.push(`las cuotas ya son ${(cargaDeuda * 100).toFixed(0)}% del ingreso recurrente (recomendado ≤ ${UMBRALES.CARGA_SANA * 100}%)`)
    if (mesesFlujoNegativo.length > 0)
      razonesAmarillas.push(`${mesesFlujoNegativo.length} mes(es) cierran con flujo negativo`)
    if (concentracion && concentracion.pct > UMBRALES.CONCENTRACION_RIESGO)
      razonesAmarillas.push(`${concentracion.nombre} concentra ${(concentracion.pct * 100).toFixed(0)}% de tu ingreso recurrente`)

    const nivel = razonesRojas.length ? 'rojo' : razonesAmarillas.length ? 'amarillo' : 'verde'
    const semaforo = {
      nivel,
      titulo: nivel === 'rojo' ? 'No tomes más créditos ahora'
        : nivel === 'amarillo' ? 'Puedes endeudarte, pero con cuidado'
        : 'Tienes margen para financiarte',
      razones: nivel === 'rojo' ? razonesRojas : razonesAmarillas,
      cuotaMaximaSugerida: nivel === 'rojo' ? 0 : capacidadAdicional,
    }

    // ── Recomendaciones accionables ────────────────────────────────────────
    const rec = []
    if (nivel === 'rojo') {
      rec.push({
        nivel: 'critico', titulo: 'Prioriza liberar flujo antes de endeudarte',
        texto: `Primero baja el servicio de deuda actual (${fmtUSD_(servicioDeuda)}/mes) o sube el ingreso recurrente. Con los números de hoy, una cuota nueva se pagaría con dinero que no tienes.`,
      })
    } else {
      rec.push({
        nivel: 'ok', titulo: `Cuota nueva máxima: ${fmtUSD_(capacidadAdicional)} al mes`,
        texto: `Tu flujo libre es ${fmtUSD_(capacidadPago)}/mes y hoy el límite lo marca ${ETIQUETA_LIMITE[limitante]}. Por encima de ese monto entras en zona de riesgo, aunque el dinero del mes te alcance.`,
      })
    }
    if (porCobrarTotal > 0) {
      const mesesEquivalentes = mrr > 0 ? porCobrarTotal / mrr : 0
      rec.push({
        nivel: 'info', titulo: `Cobra tu cartera antes de pedir prestado: ${fmtUSD_(porCobrarTotal)}`,
        texto: `Equivale a ${mesesEquivalentes.toFixed(1)} mes(es) de ingreso recurrente${carteraAtrasada > 0 ? `, de los cuales ${fmtUSD_(carteraAtrasada)} ya está atrasado` : ''}. Es financiamiento sin intereses que ya te pertenece.`,
      })
    }
    for (const b of mesesSinCaja.slice(0, 2)) {
      rec.push({
        nivel: 'critico', titulo: `${MESES_[b.mes - 1]} ${b.anio}: te quedarías sin caja`,
        texto: `Flujo acumulado ${fmtUSD_(b.acumulado)}. Compromisos del mes: ${fmtUSD_(b.egresos)} contra ${fmtUSD_(b.ingresos)} de ingreso esperado. Adelanta cobros o reprograma cuotas de ese mes.`,
      })
    }
    for (const b of mesesFlujoNegativo.filter((m) => m.acumulado >= 0).slice(0, 2)) {
      rec.push({
        nivel: 'aviso', titulo: `${MESES_[b.mes - 1]} ${b.anio}: mes apretado`,
        texto: `Cierra en ${fmtUSD_(b.flujo)}. Lo cubres con el acumulado (${fmtUSD_(b.acumulado)}), pero no asumas cuotas nuevas que caigan en ese mes.`,
      })
    }
    if (concentracion && concentracion.pct > UMBRALES.CONCENTRACION_RIESGO) {
      const sinCliente = capacidadPago - concentracion.monto
      rec.push({
        nivel: 'aviso', titulo: `Dependes demasiado de ${concentracion.nombre}`,
        texto: `Aporta ${(concentracion.pct * 100).toFixed(0)}% de tu ingreso recurrente. Si se va, tu flujo libre pasaría a ${fmtUSD_(sinCliente)}/mes${sinCliente < servicioDeuda ? ' — no alcanzaría para las cuotas actuales' : ''}. Evita cuotas a largo plazo apoyadas en un solo cliente.`,
      })
    }
    if (servicioDeudaBS > 0 || gastoFijoBS > 0) {
      rec.push({
        nivel: 'info', titulo: 'Tienes compromisos en bolívares',
        texto: `Cuotas por Bs.${servicioDeudaBS.toFixed(2)} y gastos fijos por Bs.${gastoFijoBS.toFixed(2)} al mes. No se suman al análisis en USD: revísalos con la tasa del día porque la devaluación los encarece.`,
      })
    }
    if (mrr > 0 && gastoFijo / mrr > 0.7) {
      rec.push({
        nivel: 'aviso', titulo: 'Tus gastos fijos son muy altos',
        texto: `Consumen ${((gastoFijo / mrr) * 100).toFixed(0)}% del ingreso recurrente. Cada punto que recortes es capacidad de pago directa.`,
      })
    }

    return {
      serie,
      indicadores: {
        mrr, gastoFijo, gastoFijoBS, capacidadPago, servicioDeuda, servicioDeudaBS,
        dscr, cargaDeuda, capacidadAdicional, deudaTotal, deudaTotalBS,
        porCobrarTotal, carteraAtrasada, concentracion,
        creditosActivos: creditos.length,
      },
      semaforo,
      recomendaciones: rec,
    }
  },

  /**
   * Simula el impacto de una cuota nueva sobre los indicadores actuales.
   * Se usa en el formulario de créditos para avisar ANTES de firmar.
   */
  simular: (indicadores, cuotaNueva) => {
    const cuota = Number(cuotaNueva) || 0
    if (!cuota) return null
    const { mrr, capacidadPago, servicioDeuda } = indicadores
    const nuevoServicio = servicioDeuda + cuota
    const nuevoDscr = nuevoServicio > 0 ? capacidadPago / nuevoServicio : null
    const nuevaCarga = mrr > 0 ? nuevoServicio / mrr : 0
    const flujoRestante = capacidadPago - nuevoServicio
    const nivel =
      flujoRestante < 0 || (nuevoDscr !== null && nuevoDscr < UMBRALES.DSCR_MINIMO) || nuevaCarga > UMBRALES.CARGA_MAXIMA
        ? 'rojo'
        : (nuevoDscr !== null && nuevoDscr < UMBRALES.DSCR_SANO) || nuevaCarga > UMBRALES.CARGA_SANA
          ? 'amarillo'
          : 'verde'
    return { cuota, nuevoServicio, nuevoDscr, nuevaCarga, flujoRestante, nivel }
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
    { data: creditosActivos },
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
    supabase.from('creditos').select('*').eq('estado', 'activo').order('fecha_inicio'),
  ])

  const totalCobrar = notasPendientes?.reduce((s, n) => s + Number(n.monto) - Number(n.abonado || 0), 0) || 0

  // Pasivos: créditos activos (giros de tarjeta, préstamos). Si la tabla no
  // existe aún (migración pendiente), data llega null y todo queda en cero.
  const listaCreditos = creditosActivos || []
  const saldoCredito = (c) => Math.max(0, Number(c.monto_total) - Number(c.abonado || 0))
  const deudaPorPagar = listaCreditos
    .filter((c) => c.moneda === 'USD')
    .reduce((s, c) => s + saldoCredito(c), 0)
  const cuotasMesUSD = listaCreditos
    .filter((c) => c.moneda === 'USD')
    .reduce((s, c) => s + Math.min(Number(c.monto_cuota) || Number(c.monto_total) / Number(c.num_cuotas), saldoCredito(c)), 0)
  const creditos = listaCreditos.map((c) => {
    const prox = addMonths(new Date(c.fecha_inicio + 'T00:00:00'), (c.cuotas_pagadas || 0) + 1)
    if (c.dia_pago) {
      const ultimoDia = new Date(prox.getFullYear(), prox.getMonth() + 1, 0).getDate()
      prox.setDate(Math.min(c.dia_pago, ultimoDia))
    }
    return {
      ...c,
      saldo: saldoCredito(c),
      progreso: Math.min(100, (Number(c.abonado || 0) / Number(c.monto_total)) * 100),
      proxima_cuota: fmtFecha(prox, 'yyyy-MM-dd'),
    }
  })

  return {
    totalClientes: totalClientes || 0,
    clientesActivos: clientesActivos || 0,
    totalCobrar,
    serviciosVencer: serviciosVencer || [],
    serviciosVencidos: serviciosVencidos || [],
    totalIngresosMes,
    totalGastosMes,
    utilidadMes: totalIngresosMes - totalGastosMes,
    deudaPorPagar,
    cuotasMesUSD,
    creditos,
  }
}
