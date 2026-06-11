/**
 * Generación de documentos imprimibles / PDF (vía diálogo de impresión del navegador).
 * Sin dependencias: abre una ventana con HTML profesional y lanza window.print().
 * En móvil y escritorio el usuario puede "Guardar como PDF".
 */
import { fmtMonto } from './format'

const fechaLarga = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })

const ESTADO_LABEL = {
  pendiente: { texto: 'PENDIENTE DE PAGO', color: '#b45309', fondo: '#fef3c7' },
  pagada:    { texto: 'PAGADA',            color: '#047857', fondo: '#d1fae5' },
  vencida:   { texto: 'VENCIDA',           color: '#b91c1c', fondo: '#fee2e2' },
  anulada:   { texto: 'ANULADA',           color: '#475569', fondo: '#e2e8f0' },
}

function abrirImpresion(titulo, cuerpo) {
  const win = window.open('', '_blank', 'width=820,height=900')
  if (!win) return false
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1e293b; background: #fff; padding: 48px 56px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #4f46e5; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #4338ca); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 800; }
  .brand h1 { font-size: 20px; letter-spacing: -0.5px; }
  .brand h1 span { color: #4f46e5; }
  .brand p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
  .doc-info { text-align: right; }
  .doc-info .tipo { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; }
  .doc-info .numero { font-size: 22px; font-weight: 800; font-family: 'Consolas', monospace; margin-top: 2px; }
  .meta { display: flex; justify-content: space-between; gap: 24px; margin: 28px 0; }
  .meta-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; }
  .meta-box .titulo { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
  .meta-box .valor { font-size: 15px; font-weight: 600; }
  .meta-box .sub { font-size: 12px; color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; padding: 12px 16px; background: #f1f5f9; }
  th.right, td.right { text-align: right; }
  td { padding: 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
  .total-row { display: flex; justify-content: flex-end; margin-top: 20px; }
  .total-box { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; border-radius: 14px; padding: 18px 32px; text-align: right; min-width: 260px; }
  .total-box .label { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
  .total-box .monto { font-size: 30px; font-weight: 800; font-family: 'Consolas', monospace; margin-top: 4px; }
  .estado { display: inline-block; padding: 6px 16px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; margin-top: 24px; }
  .notas { margin-top: 28px; padding: 16px 20px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; font-size: 12px; color: #78350f; }
  .notas .titulo { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 1.5px; margin-bottom: 4px; }
  .footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 24px 32px; } }
</style>
</head>
<body>${cuerpo}
<script>window.onload = function() { setTimeout(function() { window.print() }, 250) }</scr${''}ipt>
</body>
</html>`)
  win.document.close()
  return true
}

/** Imprime una nota de cobro / recibo profesional. */
export function imprimirNotaPago(nota, emisorEmail = '') {
  const estado = ESTADO_LABEL[nota.estado] || ESTADO_LABEL.pendiente
  const cuerpo = `
  <div class="header">
    <div class="brand">
      <div class="brand-mark">F</div>
      <div>
        <h1>Finanzas<span>Pro</span></h1>
        <p>Servicios Profesionales</p>
      </div>
    </div>
    <div class="doc-info">
      <p class="tipo">Nota de Cobro</p>
      <p class="numero">${nota.numero || '—'}</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <p class="titulo">Cliente</p>
      <p class="valor">${nota.clientes?.nombre || '—'}</p>
      ${emisorEmail ? `<p class="sub">Emitido por: ${emisorEmail}</p>` : ''}
    </div>
    <div class="meta-box">
      <p class="titulo">Fechas</p>
      <p class="valor">Emisión: ${fechaLarga(nota.fecha_emision)}</p>
      <p class="sub">Vencimiento: ${fechaLarga(nota.fecha_vencimiento)}</p>
    </div>
  </div>

  <table>
    <thead><tr><th>Concepto</th><th class="right">Monto</th></tr></thead>
    <tbody>
      <tr>
        <td>${nota.concepto}</td>
        <td class="right" style="font-family: Consolas, monospace; font-weight: 700;">${fmtMonto(nota.monto, nota.moneda)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-row">
    <div class="total-box">
      <p class="label">Total a Pagar</p>
      <p class="monto">${fmtMonto(nota.monto, nota.moneda)}</p>
    </div>
  </div>

  <span class="estado" style="color: ${estado.color}; background: ${estado.fondo};">${estado.texto}</span>

  ${nota.notas ? `<div class="notas"><p class="titulo">Observaciones</p><p>${nota.notas}</p></div>` : ''}

  <div class="footer">
    <span>Documento generado por FinanzasPro</span>
    <span>${new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
  </div>`
  return abrirImpresion(`Nota ${nota.numero || ''}`, cuerpo)
}
