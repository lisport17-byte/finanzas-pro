/**
 * Exportación de datos a CSV (compatible con Excel)
 */

const escapar = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Descarga un CSV.
 * @param {string} nombreArchivo - sin extensión
 * @param {string[]} cabeceras - títulos de columnas
 * @param {Array<Array>} filas - matriz de valores
 */
export function descargarCSV(nombreArchivo, cabeceras, filas) {
  const lineas = [cabeceras, ...filas].map((fila) => fila.map(escapar).join(','))
  // BOM para que Excel reconozca UTF-8 (acentos, ñ)
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
