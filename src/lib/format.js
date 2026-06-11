/**
 * Utilidades de formato para montos y fechas
 */

const usd = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** $1,234.56 — siempre con separador de miles */
export const fmtUSD = (n) => `$${usd.format(Number(n) || 0)}`

/** Formatea según la moneda del registro */
export const fmtMonto = (n, moneda = 'USD') =>
  moneda === 'USD' ? fmtUSD(n) : `Bs. ${usd.format(Number(n) || 0)}`

/** Monto equivalente en USD de un registro (ingresos con tasa BCV) */
export const montoUSD = (r) =>
  r.moneda === 'USD' ? Number(r.monto) : Number(r.monto_usd || 0)

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
