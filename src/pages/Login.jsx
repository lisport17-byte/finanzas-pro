import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../lib/queries'
import useStore from '../store/useStore'
import { Lock, Mail, Eye, EyeOff, Sparkles, ShieldCheck, BarChart3, Wallet } from 'lucide-react'

const features = [
  { icon: BarChart3,   texto: 'Dashboard ejecutivo con gráficas en tiempo real' },
  { icon: Wallet,      texto: 'Control de ingresos, gastos y cuentas por cobrar' },
  { icon: ShieldCheck, texto: 'Datos cifrados y aislados por usuario (RLS)' },
]

export default function Login() {
  const user = useStore((s) => s.user)
  const addToast = useStore((s) => s.addToast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await auth.login(email, password)
    setLoading(false)
    if (error) {
      addToast(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : error.message,
        'error'
      )
    }
  }

  return (
    <div className="min-h-[100dvh] flex">
      {/* Panel de marca — solo desktop */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-60"
             style={{ backgroundImage: 'radial-gradient(ellipse 70% 60% at 20% 30%, rgba(99,102,241,0.25), transparent), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(16,185,129,0.12), transparent)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-glow-indigo"
               style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="font-display text-xl font-bold tracking-tight">
            Finanzas<span className="text-gradient">Pro</span>
          </p>
        </div>

        <div className="relative space-y-8">
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight">
            Tu negocio,<br />
            <span className="text-gradient">bajo control total.</span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            Clientes, servicios, renovaciones, ingresos y gastos — toda tu operación
            financiera en una sola plataforma, diseñada para prestadores de servicios profesionales.
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, texto }) => (
              <div key={texto} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-brand-300" />
                </span>
                {texto}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-600">© {new Date().getFullYear()} FinanzasPro · Suite Financiera Empresarial</p>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Logo móvil */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-indigo"
                 style={{ backgroundImage: 'linear-gradient(135deg, #6366f1, #4338ca)' }}>
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Finanzas<span className="text-gradient">Pro</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Control Financiero Empresarial</p>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-bold text-slate-100 mb-1">Bienvenido de nuevo</h2>
            <p className="text-xs text-slate-500 mb-6">Ingresa tus credenciales para continuar</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Entrar al Sistema'
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            FinanzasPro v2.0 · Sistema privado y cifrado
          </p>
        </div>
      </div>
    </div>
  )
}
