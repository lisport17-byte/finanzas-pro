/**
 * Service Worker personalizado de FinanzasPro
 * - Precachea la app (funciona offline)
 * - NO intercepta peticiones a Supabase (lección crítica #2 del CLAUDE.md)
 * - Recibe notificaciones Web Push (recordatorios de vencimientos)
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
clientsClaim()

// ── Precache de la app (generado por Vite en el build) ───────────────────────
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navegación offline → index.html, EXCEPTO peticiones a Supabase
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/supabase/],
  })
)

// ── Notificaciones Push ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = { body: event.data ? event.data.text() : '' }
  }

  const titulo = datos.title || '💼 FinanzasPro'
  const opciones = {
    body: datos.body || 'Tienes servicios próximos a vencer. Toca para revisar.',
    icon: 'pwa-192x192.png',
    badge: 'pwa-192x192.png',
    tag: datos.tag || 'finanzaspro-recordatorio', // reemplaza la anterior, no acumula
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: datos.url || './#/alertas' },
  }
  event.waitUntil(self.registration.showNotification(titulo, opciones))
})

// Al tocar la notificación → abrir/enfocar la app en la página de Alertas
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL(event.notification.data?.url || './', self.location.href).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url.startsWith(self.registration.scope)) {
          v.focus()
          if ('navigate' in v) v.navigate(destino)
          return
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
