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
│   └── queries.js       # Todas las funciones de BD
├── store/
│   └── useStore.js      # Estado global con Zustand
├── components/
│   ├── Layout.jsx       # Contenedor principal con sidebar
│   ├── Sidebar.jsx      # Navegación lateral
│   ├── Header.jsx       # Barra superior
│   ├── Modal.jsx        # Modal reutilizable
│   └── Toast.jsx        # Notificaciones
├── pages/
│   ├── Login.jsx        # Autenticación
│   ├── Dashboard.jsx    # Resumen financiero
│   ├── Clientes.jsx     # CRUD de clientes
│   ├── Servicios.jsx    # Servicios por cliente + renovaciones
│   ├── NotasPago.jsx    # Cuentas por cobrar
│   ├── Ingresos.jsx     # Registro de pagos recibidos
│   ├── Gastos.jsx       # Libro de gastos mensuales
│   └── Alertas.jsx      # Servicios vencidos y por vencer
└── index.css            # Clases de Tailwind personalizadas
```

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

## Próximas funcionalidades a implementar
1. **Exportar a PDF**: Notas de pago y estados de cuenta por cliente
2. **Libro mayor**: Vista consolidada mes a mes con gráficas
3. **WhatsApp bot**: Notificaciones automáticas a clientes sobre vencimientos
4. **Multi-moneda**: Soporte para otras monedas (EUR, COP, etc.)
5. **Dashboard con gráficas**: Chart.js para tendencias de ingresos/gastos
6. **Backup automático**: Exportar datos a CSV/Excel
7. **Modo offline**: Caché completo con Service Worker
8. **Email reminders**: Avisos automáticos vía Supabase Edge Functions

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
