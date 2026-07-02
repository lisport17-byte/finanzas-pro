/**
 * Notificaciones Web Push — Fase 1
 * Suscribe el dispositivo (celular o PC) para recibir recordatorios
 * de vencimientos aunque la app esté cerrada.
 *
 * Requiere: VITE_VAPID_PUBLIC_KEY en .env y la tabla push_suscripciones
 * (ver supabase-push.sql). El envío lo hace la Edge Function
 * `enviar-recordatorios` cada mañana.
 */
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** Convierte la llave VAPID base64url al formato que exige PushManager */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export const push = {
  /** ¿El navegador soporta notificaciones push? */
  soportado: () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,

  /** ¿Este dispositivo ya está suscrito? */
  estaActivo: async () => {
    if (!push.soportado()) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      return !!sub
    } catch {
      return false
    }
  },

  /**
   * Activa las notificaciones en este dispositivo:
   * pide permiso → suscribe → guarda la suscripción en Supabase.
   * Devuelve { ok, mensaje }.
   */
  activar: async (userId) => {
    if (!push.soportado())
      return { ok: false, mensaje: 'Este navegador no soporta notificaciones push' }
    if (!VAPID_PUBLIC_KEY)
      return { ok: false, mensaje: 'Falta VITE_VAPID_PUBLIC_KEY en la configuración' }

    const permiso = await Notification.requestPermission()
    if (permiso !== 'granted')
      return { ok: false, mensaje: 'Permiso de notificaciones denegado. Actívalo en los ajustes del navegador.' }

    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const json = sub.toJSON()
      const { error } = await supabase
        .from('push_suscripciones')
        .upsert(
          {
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            dispositivo: navigator.userAgent.slice(0, 120),
          },
          { onConflict: 'endpoint' }
        )
      if (error) return { ok: false, mensaje: 'No se pudo guardar la suscripción: ' + error.message }
      return { ok: true, mensaje: '🔔 Notificaciones activadas en este dispositivo' }
    } catch (err) {
      return { ok: false, mensaje: 'Error al suscribir: ' + (err?.message || 'desconocido') }
    }
  },

  /** Desactiva las notificaciones en este dispositivo */
  desactivar: async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      return { ok: true, mensaje: 'Notificaciones desactivadas en este dispositivo' }
    } catch (err) {
      return { ok: false, mensaje: 'Error: ' + (err?.message || 'desconocido') }
    }
  },
}
