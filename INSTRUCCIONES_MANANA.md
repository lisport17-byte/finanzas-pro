# 🚀 FinanzasPro — Instrucciones para mañana (5 minutos)

## ✅ Lo que ya está hecho (hecho esta noche)
- [x] Repositorio GitHub creado: https://github.com/lisport17-byte/finanzas-pro
- [x] GitHub Pages configurado en "GitHub Actions"
- [x] Actions habilitado con todos los permisos
- [x] Todo el código fuente completo y listo

---

## 📋 PASO 1 — Agregar 2 Secrets en GitHub (2 minutos)

Abre este enlace en tu navegador:
👉 https://github.com/lisport17-byte/finanzas-pro/settings/secrets/actions

Haz clic en **"New repository secret"** y agrega estos dos:

### Secret #1
- **Name:** `VITE_SUPABASE_URL`
- **Value:** `https://qrevajldlzskbigjebmo.supabase.co`

### Secret #2
- **Name:** `VITE_SUPABASE_ANON_KEY`
- **Value:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyZXZhamxkbHpza2JpZ2plYm1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDM4MjIsImV4cCI6MjA5NTU3OTgyMn0.4fAmmlkRa_Ydrl0sfUrEdgGj6ShaFfFpRsa8HR2ktK4
```

---

## 📋 PASO 2 — Subir el código (3 minutos)

Abre **PowerShell** y ejecuta estos comandos **uno por uno**:

```powershell
# 1. Ir a la carpeta del proyecto
cd "C:\Users\Usuario\OneDrive\Documentos\Claude\Projects\app para cuentas"

# 2. Instalar dependencias (solo la primera vez)
npm install

# 3. Iniciar git y subir a GitHub
git init
git add .
git commit -m "FinanzasPro v1.0 - Sistema financiero empresarial"
git branch -M main
git remote add origin https://github.com/lisport17-byte/finanzas-pro.git
git push -u origin main
```

> **Si pide usuario/contraseña de GitHub:** usa tu usuario `lisport17-byte` y un token de acceso personal (o usa GitHub Desktop si lo tienes instalado)

---

## 📋 PASO 3 — Verificar el deploy (automático)

1. Ve a: https://github.com/lisport17-byte/finanzas-pro/actions
2. Verás el workflow **"Deploy FinanzasPro to GitHub Pages"** ejecutándose
3. Espera 2-3 minutos hasta que aparezca ✅ verde

**Tu app estará en:**
🌐 https://lisport17-byte.github.io/finanzas-pro/

---

## 📱 PASO 4 — Instalar en el celular (PWA)

1. Abre la URL de arriba en Chrome (Android) o Safari (iPhone)
2. **Android:** menú ⋮ → "Agregar a pantalla de inicio"
3. **iPhone:** botón compartir → "Añadir a pantalla de inicio"

¡Listo! Tendrás FinanzasPro instalada como app nativa 🎉

---

## 🧪 PASO OPCIONAL — Probar localmente antes de subir

```powershell
cd "C:\Users\Usuario\OneDrive\Documentos\Claude\Projects\app para cuentas"
npm install
npm run dev
```
Abre: http://localhost:5173
Login: lisport17@gmail.com + tu contraseña

---

## ⚠️ Si el git push pide autenticación

GitHub ya no acepta contraseña normal. Necesitas un **Personal Access Token**:
1. Ve a: https://github.com/settings/tokens/new
2. Nombre: `finanzas-pro-deploy`
3. Expiration: 90 days
4. Selecciona: ✅ `repo` (todas las casillas)
5. Clic en **"Generate token"** — copia el token
6. Úsalo como contraseña al hacer git push

---

*Preparado el 28/05/2026 🌙 — ¡Descansa bien, colega!*
