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
├── lib/
│   ├── supabase.js      # Cliente Supabase (usa .env)
│   ├── queries.js       # Todas las funciones de BD (incluye `reportes` para analítica)
│   ├── format.js        # fmtUSD, fmtMonto, nombres de meses
│   ├── export.js        # descargarCSV() — exportación compatible con Excel
│   └── pdf.js           # imprimirNotaPago() — recibos imprimibles/PDF sin dependencias
├── store/
│   └── useStore.js      # Estado global con Zustand
├── components/
│   ├── Layout.jsx       # Contenedor principal con sidebar + bottom nav
│   ├── Sidebar.jsx      # Navegación lateral
│   ├── Header.jsx       # Barra superior
│   ├── BottomNav.jsx    # Navegación inferior móvil (estilo app nativa)
│   ├── Modal.jsx        # Modal reutilizable (bottom sheet en móvil)
│   └── Toast.jsx        # Notificaciones
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

## Próximas funcionalidades a implementar
1. **WhatsApp bot**: Notificaciones automáticas a clientes sobre vencimientos
2. **Multi-moneda**: Soporte para otras monedas (EUR, COP, etc.)
3. **Email reminders**: Avisos automáticos vía Supabase Edge Functions

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
