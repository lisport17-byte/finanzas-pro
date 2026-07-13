# FinanzasPro — Documentación técnica para Claude Code

## Resumen del proyecto
Sistema de control financiero empresarial PWA (Progressive Web App). Permite gestionar clientes, servicios con renovaciones, ingresos (USD/Bs), gastos mensuales y cuentas por cobrar.

## Stack tecnológico
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **PWA**: vite-plugin-pwa (offline, instalable en móvil)
- **Deploy**: GitHub Pages via GitHub Actions
- **Estado global**: Zustand
- **Routing**: React Router v6 (HashRouter para GitHub Pages)
- **Fechas**: date-fns
- **Íconos**: lucide-react

## Estructura de archivos
```
src/
├── sw.js                # Service Worker propio (injectManifest): offline + Web Push
├── lib/
│   ├── supabase.js      # Cliente Supabase (usa .env)
│   ├── queries.js       # Todas las funciones de BD (incluye `reportes` para analítica)
│   ├── format.js        # fmtUSD, fmtMonto, nombres de meses
│   ├── export.js        # descargarCSV() — exportación compatible con Excel
│   ├── push.js          # Suscripción Web Push del dispositivo (tabla push_suscripciones)
│   ├── biometria.js     # Bloqueo con huella/rostro (WebAuthn, candado local)
│   └── pdf.js           # imprimirNotaPago() — recibos imprimibles/PDF sin dependencias
├── store/
│   └── useStore.js      # Estado global con Zustand
├── components/
│   ├── Layout.jsx       # Contenedor principal con sidebar + bottom nav
│   ├── Sidebar.jsx      # Navegación lateral
│   ├── Header.jsx       # Barra superior
│   ├── BottomNav.jsx    # Navegación inferior móvil (estilo app nativa)
│   ├── Modal.jsx        # Modal reutilizable (bottom sheet en móvil)
│   ├── Toast.jsx        # Notificaciones
│   ├── RestablecerClave.jsx   # Nueva contraseña (evento PASSWORD_RECOVERY)
│   └── BloqueoBiometrico.jsx  # Candado con huella al abrir la app
├── pages/
│   ├── Login.jsx        # Autenticación (split-screen con panel de marca)
│   ├── Dashboard.jsx    # Resumen financiero con gráficas (recharts)
│   ├── Clientes.jsx     # CRUD de clientes
│   ├── Servicios.jsx    # Servicios por cliente + renovaciones
│   ├── NotasPago.jsx    # Cuentas por cobrar + recibo imprimible
│   ├── Ingresos.jsx     # Registro de pagos recibidos + export CSV
│   ├── Gastos.jsx       # Libro de gastos mensuales + export CSV
│   ├── Reportes.jsx     # Libro mayor anual con gráficas + export CSV
│   └── Alertas.jsx      # Servicios vencidos y por vencer
└── index.css            # Sistema de diseño (clases utilitarias Tailwind)
```

## Sistema de diseño (v2)
- Tipografías: Inter (texto), Sora (`font-display`, títulos), JetBrains Mono (montos)
- Paleta de fondo `ink-*` (azul profundo) definida en `tailwind.config.js`; acentos `brand-*` (indigo)
- Clases compartidas en `index.css`: `card`, `card-hover`, `glass`, `btn-primary/secondary/danger/success/ghost`, `input`, `label`, `badge-*`, `table-*`, `skeleton`, `text-gradient`
- Animaciones: `animate-fade-up`, `animate-fade-in`, `animate-scale-in`, `animate-slide-in-right`
- Gráficas con **recharts** (chunk separado `charts` en el build)
- Montos siempre con `fmtUSD`/`fmtMonto` de `src/lib/format.js`

## Variables de entorno requeridas
```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_VAPID_PUBLIC_KEY=llave_publica_vapid   # Web Push (Fase 1)
```
Para GitHub Actions: agregar en Settings → Secrets → Actions

## Tablas de la base de datos
| Tabla | Propósito |
|-------|-----------|
| `clientes` | Datos de clientes |
| `tipos_servicio` | Catálogo de servicios (Web, Bot, IA, etc.) |
| `servicios_clientes` | Servicios contratados por cliente con renovaciones |
| `notas_pago` | Facturas/notas de cobro |
| `ingresos` | Pagos recibidos (USD o Bs con tasa BCV) |
| `gastos` | Gastos mensuales recurrentes o únicos |
| `configuracion` | Parámetros del sistema |
| `push_suscripciones` | Dispositivos suscritos a Web Push (ver `supabase-push.sql`) |

Todas las tablas tienen RLS habilitado — solo el `user_id` dueño ve sus datos.

## Comandos
```bash
npm install      # Instalar dependencias
npm run dev      # Desarrollo local (http://localhost:5173)
npm run build    # Build de producción → carpeta dist/
npm run preview  # Preview del build
```

## Convenciones de código
- Funciones de BD en `src/lib/queries.js`, agrupadas por entidad
- Toasts: `addToast(mensaje, tipo)` donde tipo = success|error|info|warning
- Colores CSS definidos en `src/index.css` como clases utilitarias (`btn-primary`, `card`, `input`, `badge-active`, etc.)
- Modales: componente `<Modal titulo="..." onClose={fn}>` reutilizable
- Las páginas manejan su propio estado local + llaman a `queries.js`
- Nunca hardcodear `user_id` — siempre tomarlo de `useStore().user.id`

## Facturación automática (ciclo de cobro recurrente)
- Al abrir la app, `facturacion.generarNotasRenovacion(userId, 7)` (disparada una vez
  por sesión desde `Layout.jsx` y también al crear un servicio en Servicios) emite:
  1. **Contrataciones**: servicios activos con `fecha_inicio` en el mes en curso
     (incluye pago único) — la venta se cobra al inicio, vencimiento = `fecha_inicio`.
  2. **Renovaciones**: servicios mensual/anual cuya `fecha_renovacion` cae dentro del
     mes en curso o en los próximos 7 días.
- **Idempotente**: la clave es `servicio_cliente_id + fecha_vencimiento` (el período).
  Las notas anuladas también cuentan como emitidas (no se regeneran).
- `facturacion.confirmarPago(nota, datosPago, userId)` acepta pago total o **abono
  parcial** (`monto_abono`): acumula en `notas_pago.abonado` (migración
  `supabase-abonos.sql`), registra el ingreso por lo pagado (concepto "Abono NP-…"),
  y solo cuando `abonado >= monto` marca la nota pagada y extiende `fecha_renovacion`
  del servicio al siguiente período (anclado al vencimiento; solo si
  `fecha_renovacion <= nota.fecha_vencimiento` para evitar doble extensión).
  El pago de una nota de contratación NO extiende la renovación (vencimiento < renovación).
- UI en NotasPago: modal "Confirmar Pago" con toggle Pago total / Abono parcial;
  vista conmutables "Notas" / "Por Cliente" (agrupa por cliente + mes de vencimiento,
  con factura consolidada en PDF y envío por WhatsApp desde cada grupo).
- Los totales "por cobrar" (Dashboard y CXC) descuentan lo abonado.

## Factura mensual consolidada + envío por WhatsApp
- Botón "Factura Mensual" en Servicios: modal para elegir cliente, mes y servicios
  (preselección: mensuales siempre; anuales solo si renuevan ese mes; pago único solo
  si inició ese mes). Genera el PDF con `imprimirFacturaMensual()` en `src/lib/pdf.js`.
- Número determinístico `FAC-YYYYMM-XXXXXX` (`numeroFactura()`): mismo cliente+mes = mismo número.
- Envío por WhatsApp vía `wa.me` (`src/lib/whatsapp.js`): abre el chat del cliente con el
  resumen prellenado (servicios + total); el PDF se adjunta manualmente en el chat.
  `normalizarNumero()` asume Venezuela (+58) si el número empieza por 0.
- Campo `clientes.whatsapp` (migración en `supabase-whatsapp.sql`); si falta, se usa `telefono`.
- Envío 100% automático con PDF adjunto requiere la API de WhatsApp Business (Meta) — pendiente.

## Lógica de renovaciones
- `fecha_renovacion` se calcula automáticamente: inicio + 1 mes (mensual) o + 1 año (anual)
- Al reactivar un servicio suspendido, la nueva renovación parte de HOY
- La función `obtenerProximosVencer(dias)` y `obtenerVencidos()` alimentan las Alertas
- El badge del sidebar muestra el conteo de alertas activas

## Funcionalidades implementadas en v2
- ✅ Recibos imprimibles/PDF de notas de pago (`src/lib/pdf.js`)
- ✅ Estado de cuenta por cliente en PDF (servicios + notas + pagos, botón en Clientes)
- ✅ Renovación en un clic con nota de cobro automática (página Alertas)
- ✅ Libro mayor anual con gráficas y acumulado (página Reportes)
- ✅ Dashboard con gráficas: flujo de caja 12 meses, gastos por categoría, top clientes, MRR
- ✅ Exportar a CSV/Excel: ingresos, gastos y libro mayor
- ✅ Navegación inferior móvil + modales tipo bottom sheet

## Lecciones críticas de estabilidad (NO romper)
1. **Nunca llamar a Supabase con `await` dentro del callback `onAuthStateChange`** — la
   librería mantiene un lock interno y se produce un deadlock que congela TODAS las
   consultas (skeletons infinitos, guardados que nunca responden). Usar `setTimeout(fn, 0)`.
2. **El Service Worker NO debe interceptar/cachear peticiones a Supabase** — con
   `credentials: 'include'` rompe CORS (Supabase responde `ACAO: *`) y añade segundos de
   espera. Los datos contables siempre van directo a la red.
3. El cliente Supabase (`src/lib/supabase.js`) tiene un **fetch con timeout de 20s** para
   que ninguna operación cuelgue en silencio.
4. Toda carga de datos lleva `try/catch` con toast de error (y botón Reintentar en Dashboard).
5. `window.open` para PDFs debe llamarse ANTES de cualquier `await` (popup blockers);
   usar `abrirVentanaImpresion()` y pasar la ventana a la función de impresión.
6. **Todo insert/update pasa por `limpiar()`** en `queries.js`: convierte `''` a NULL.
   Los `<select>` opcionales envían `''` y PostgreSQL lo rechaza en columnas
   uuid/integer/date (`invalid input syntax for type uuid: ""`). No insertar/actualizar
   directo con `supabase.from(...)` desde las páginas — siempre vía `queries.js`.
7. **No editar archivos con regex de PowerShell** (`-replace` + `Set-Content`): corrompe
   los acentos UTF-8. Usar las herramientas de edición del agente.

## Fase 1 implementada (v2.1) — Notificaciones y acceso
- ✅ **Web Push**: SW propio (`src/sw.js`, estrategia `injectManifest` en vite.config).
  La Edge Function `supabase/functions/enviar-recordatorios/index.ts` corre a diario
  (pg_cron, 12:00 UTC) y envía un resumen de vencimientos por usuario (VAPID).
  Protegida con header `x-cron-secret`. Suscripción por dispositivo en Alertas.
- ✅ **Recuperar contraseña**: enlace en Login → email → evento `PASSWORD_RECOVERY`
  → pantalla `RestablecerClave`. `redirectTo` apunta a origin+pathname (compatible
  con HashRouter/GitHub Pages).
- ✅ **Bloqueo con huella**: WebAuthn como candado local (no reemplaza el login).
  Flag y credencial en localStorage; toggle en Alertas.
- Ver `GUIA_FASE1_NOTIFICACIONES.md` para la configuración (llaves VAPID, secrets).

## Próximas funcionalidades a implementar
1. **WhatsApp bot**: Notificaciones automáticas a clientes sobre vencimientos
2. **Multi-moneda**: Soporte para otras monedas (EUR, COP, etc.)
3. **Email reminders**: Avisos automáticos vía Supabase Edge Functions
4. **Fase 2 — Capacitor**: empaquetar como APK nativo para Play Store (FCM)

## Seguridad
- Row Level Security (RLS) activo en Supabase — datos completamente aislados por usuario
- Variables de entorno en `.env` (nunca en el código)
- GitHub Secrets para el deploy en CI/CD
- La `anon_key` de Supabase es pública — la seguridad real está en RLS

## Deploy en GitHub Pages
1. Crear repo en GitHub llamado `finanzas-pro`
2. Cambiar `REPO_NAME` en `vite.config.js` al nombre exacto del repo
3. Settings → Pages → Source: GitHub Actions
4. Settings → Secrets → Actions → agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
5. Hacer push a `main` — GitHub Actions hace el build y deploy automáticamente
6. La URL será: `https://tu-usuario.github.io/finanzas-pro/`
