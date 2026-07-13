# 🔔 FASE 1 — Notificaciones Push + Recuperar clave + Huella

Todo el código ya está escrito y probado (el build compila ✅).
Solo faltan estos pasos de configuración que debes hacer tú (≈15 minutos).

## 🔑 Tus llaves (guárdalas, no las compartas)

```
VAPID PÚBLICA  (va en GitHub Secrets y en tu .env local):
BMdncuVmVXVIFZcP2D4PDs5HJDLbPj9lQyJEG2GAn4Gf68tzUxgK2PA5XCUzg4Yoavc466AkVPEqBemcIEc8lrE

VAPID PRIVADA  (va SOLO en los secretos de la Edge Function):
TTerMbcE8Aw1UPuVAmhyiSUMDkSslu11eQH6x-IAWAA

CRON_SECRET  (va en la Edge Function y en el SQL del cron):
EOBF_l_diJcM5RiKKB2c2k6sHTKt1toc
```

---

## PASO 1 — Crear la tabla y el cron en Supabase (3 min)

1. Ve a https://supabase.com/dashboard → tu proyecto → **SQL Editor**
2. Abre el archivo `supabase-push.sql` de esta carpeta
3. **Antes de ejecutarlo**: reemplaza `TU_CRON_SECRET` por el CRON_SECRET de arriba
4. Pega todo y haz clic en **Run**

Esto crea la tabla `push_suscripciones` (con RLS) y programa el envío
diario a las **8:00 am hora Venezuela** (12:00 UTC).

---

## PASO 2 — Crear la Edge Function (5 min)

1. En Supabase → **Edge Functions** → **Deploy a new function** → "Via Editor"
2. Nombre: `enviar-recordatorios`
3. Borra el código de ejemplo y pega TODO el contenido de
   `supabase/functions/enviar-recordatorios/index.ts`
4. Haz clic en **Deploy**
5. Entra a la función → pestaña **Details** → desactiva **"Verify JWT"**
   (el cron no envía JWT; la función se protege con el CRON_SECRET)
6. Ve a **Edge Functions → Secrets** (o Settings → Edge Functions) y agrega:

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la llave pública de arriba |
| `VAPID_PRIVATE_KEY` | la llave privada de arriba |
| `CRON_SECRET` | el CRON_SECRET de arriba |

---

## PASO 3 — Secret en GitHub (1 min)

Ve a: https://github.com/lisport17-byte/finanzas-pro/settings/secrets/actions

Agrega un secret nuevo:
- **Name:** `VITE_VAPID_PUBLIC_KEY`
- **Value:** la llave pública de arriba

---

## PASO 4 — Subir el código y desplegar (3 min)

En PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
git add .
git commit -m "Fase 1: notificaciones push, recuperar clave y huella"
git push
```

GitHub Actions hace el deploy solo (2-3 min). Verifica en:
https://github.com/lisport17-byte/finanzas-pro/actions

> Para probar en local, agrega también a tu archivo `.env`:
> `VITE_VAPID_PUBLIC_KEY=` + la llave pública

---

## PASO 5 — Activar en tu teléfono (2 min)

1. Abre la app en el teléfono (o reinstala la PWA si no se actualiza:
   mantén presionado el ícono → desinstalar → volver a "Agregar a pantalla de inicio")
2. Entra a **Alertas** → abajo verás **"Avisos y seguridad de este dispositivo"**
3. Toca **Activar** en "Recordatorios push" → acepta el permiso
4. (Opcional) Toca **Activar** en "Bloqueo con huella" → registra tu huella

### Probar el envío sin esperar a mañana

En PowerShell:

```powershell
curl -X POST "https://qrevajldlzskbigjebmo.supabase.co/functions/v1/enviar-recordatorios" -H "x-cron-secret: EOBF_l_diJcM5RiKKB2c2k6sHTKt1toc"
```

Si tienes servicios que vencen en ≤7 días, te llegará la notificación al teléfono
aunque la app esté cerrada. La respuesta muestra `{"ok":true,"enviadas":N}`.

---

## 🔐 ¿Olvidaste tu contraseña? (nuevo)

En la pantalla de login ahora hay un enlace **"¿Olvidaste tu contraseña?"**:
1. Escribe tu correo (lisport17@gmail.com) en el campo de arriba
2. Toca el enlace → te llega un email de Supabase
3. Abre el enlace **desde el mismo dispositivo** → la app te muestra
   la pantalla "Nueva contraseña" → listo

Alternativa inmediata (sin esperar el deploy): Supabase Dashboard →
**Authentication → Users** → tu correo → menú **⋯** → "Send password recovery",
o cámbiala directo con "Update password".

## 👆 ¿Cómo funciona la huella?

- La sesión queda guardada en el teléfono; la huella es un **candado local**
  que se pide cada vez que abres la app (WebAuthn — la huella nunca sale
  del chip seguro de tu teléfono).
- Si la huella falla o cambias de teléfono, toca "Entrar con correo y
  contraseña" y entras normal.
- Se activa/desactiva por dispositivo en **Alertas → Bloqueo con huella**.

---

## Archivos nuevos/modificados en esta fase

| Archivo | Qué hace |
|---|---|
| `src/sw.js` | Service worker propio: offline + recepción de push |
| `src/lib/push.js` | Suscribir/desuscribir el dispositivo |
| `src/lib/biometria.js` | Registro y verificación de huella (WebAuthn) |
| `src/components/RestablecerClave.jsx` | Pantalla de nueva contraseña |
| `src/components/BloqueoBiometrico.jsx` | Pantalla de candado con huella |
| `src/pages/Alertas.jsx` | Panel "Avisos y seguridad" |
| `src/pages/Login.jsx` | Enlace "¿Olvidaste tu contraseña?" |
| `src/App.jsx` | Flujo de recuperación + candado biométrico |
| `supabase-push.sql` | Tabla + cron diario |
| `supabase/functions/enviar-recordatorios/index.ts` | Envío de push |
| `vite.config.js`, `package.json`, `deploy.yml`, `.env.example` | Config |
