/**
 * Envío por WhatsApp vía enlaces wa.me (sin API de pago).
 * Abre el chat del cliente con un mensaje prellenado; el PDF se adjunta
 * desde el propio chat (WhatsApp no permite adjuntar archivos por enlace).
 */
import { fmtMonto } from './format'

/**
 * Normaliza un número a formato internacional sin símbolos.
 * "0412-1234567" → "584121234567" (asume Venezuela si empieza por 0).
 */
export function normalizarNumero(numero) {
  if (!numero) return ''
  let d = String(numero).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '58' + d.slice(1)
  return d
}

/** Abre el chat de WhatsApp del número con el texto prellenado. */
export function abrirWhatsApp(numero, texto = '') {
  const n = normalizarNumero(numero)
  if (!n) return false
  const url = `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}`
  window.open(url, '_blank', 'noopener')
  return true
}

/** Mensaje de factura mensual consolidada listo para enviar al cliente. */
export function mensajeFactura(cliente, servicios, periodo, numero) {
  const nombreMes = new Date(periodo + '-01T00:00:00')
    .toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
  const totalUSD = servicios.filter((s) => s.moneda === 'USD').reduce((a, s) => a + Number(s.precio), 0)
  const totalBS = servicios.filter((s) => s.moneda === 'BS').reduce((a, s) => a + Number(s.precio), 0)
  const lineas = servicios
    .map((s) => `▫️ ${s.nombre_servicio} — ${fmtMonto(s.precio, s.moneda)}`)
    .join('\n')
  const total = totalBS > 0
    ? `${fmtMonto(totalUSD, 'USD')} + ${fmtMonto(totalBS, 'BS')}`
    : fmtMonto(totalUSD, 'USD')

  return `Hola ${cliente.nombre} 👋

Le compartimos su factura *${numero}* correspondiente a *${nombreMes}*:

${lineas}

*Total a pagar: ${total}*

En breve le adjuntamos el PDF de la factura. ¡Gracias por su confianza!`
}
