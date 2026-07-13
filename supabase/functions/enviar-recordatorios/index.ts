/**
 * Edge Function: enviar-recordatorios
 * Se ejecuta cada mañana (via pg_cron) y envía una notificación push
 * a cada usuario que tenga servicios vencidos o por vencer en ≤7 días.
 *
 * Desplegar con:  supabase functions deploy enviar-recordatorios --no-verify-jwt
 * Secretos requeridos (supabase secrets set):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
 * (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo)
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  // Seguridad: solo el cron (o tú manualmente) puede invocarla
  const secreto = req.headers.get('x-cron-secret')
  if (secreto !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  webpush.setVapidDetails(
    'mailto:lisport17@gmail.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  // Cliente con service_role: puede leer datos de todos los usuarios (ignora RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Servicios activos que vencen en ≤7 días o ya vencieron
  const hoy = new Date()
  const limite = new Date(hoy.getTime() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: servicios, error } = await supabase
    .from('servicios_clientes')
    .select('id, user_id, nombre_servicio, fecha_renovacion, precio, moneda, clientes(nombre)')
    .eq('estado', 'activo')
    .in('tipo_renovacion', ['mensual', 'anual'])
    .lte('fecha_renovacion', limite)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  if (!servicios || servicios.length === 0) {
    return new Response(JSON.stringify({ ok: true, mensaje: 'Sin vencimientos próximos' }))
  }

  // Agrupar por usuario → un resumen por persona, no una lluvia de avisos
  const porUsuario = new Map<string, typeof servicios>()
  for (const s of servicios) {
    if (!porUsuario.has(s.user_id)) porUsuario.set(s.user_id, [])
    porUsuario.get(s.user_id)!.push(s)
  }

  let enviadas = 0
  let eliminadas = 0

  for (const [userId, lista] of porUsuario) {
    const { data: subs } = await supabase
      .from('push_suscripciones')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (!subs || subs.length === 0) continue

    const hoyStr = hoy.toISOString().slice(0, 10)
    const vencidos = lista.filter((s) => s.fecha_renovacion < hoyStr).length
    const porVencer = lista.length - vencidos

    // Detalle de los 3 más urgentes
    const detalle = lista
      .sort((a, b) => a.fecha_renovacion.localeCompare(b.fecha_renovacion))
      .slice(0, 3)
      .map((s) => {
        const [, m, d] = s.fecha_renovacion.split('-')
        return `${(s.clientes as { nombre?: string })?.nombre ?? 'Cliente'} · ${s.nombre_servicio} (${d}/${m})`
      })
      .join('\n')

    const partes = []
    if (vencidos > 0) partes.push(`${vencidos} vencido${vencidos > 1 ? 's' : ''}`)
    if (porVencer > 0) partes.push(`${porVencer} por vencer`)

    const payload = JSON.stringify({
      title: `⚠️ FinanzasPro: ${partes.join(' y ')}`,
      body: detalle + (lista.length > 3 ? `\n…y ${lista.length - 3} más` : ''),
      url: './#/alertas',
      tag: 'vencimientos-' + hoyStr,
    })

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        enviadas++
      } catch (err) {
        // 404/410 = el dispositivo canceló la suscripción → limpiarla
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
          eliminadas++
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, usuarios: porUsuario.size, enviadas, eliminadas }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
