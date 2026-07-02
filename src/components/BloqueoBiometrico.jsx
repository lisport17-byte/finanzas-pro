import { useEffect, useState, useRef } from 'react'
import { biometria } from '../lib/biometria'
import { auth } from '../lib/queries'
import { Fingerprint, LogOut } from 'lucide-react'

/**
 * Candado biométrico: cubre la app al abrirla y pide la huella
 * (o rostro) antes de mostrar los datos financieros.
 */
export default function BloqueoBiometrico({ onDesbloqueado }) {
  const [verificando, setVerificando] = useState(false)
  const [fallo, setFallo] = useState(false)
  const intentoAuto = useRef(false)

  const pedirHuella = async () => {
    setVerificando(true)
    setFallo(false)
    const ok = await biometria.verificar()
    setVerificando(false)
    if (ok) onDesbloqueado()
    else setFallo(true)
  }

  // Intento automático al abrir (si el navegador lo permite)
  useEffect(() => {
    if (intentoAuto.current) return
    intentoAuto.current = true
    pedirHuella()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const salir = async () => {
    biometria.desactivar()
    await auth.logout()
    window.location.reload()
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 text-center">
      <div className="animate-fade-up flex flex-col items-center max-w-xs">
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center mb-6 shadow-glow-indigo">
          <Fingerprint className={`w-10 h-10 text-indigo-300 ${verificando ? 'animate-pulse' : ''}`} />
        </div>
        <h1 className="font-display text-xl font-bold text-slate-100">
          Finanzas<span className="text-gradient">Pro</span> bloqueado
        </h1>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          {verificando
            ? 'Verificando tu identidad...'
            : fallo
              ? 'No se pudo verificar. Inténtalo de nuevo.'
              : 'Usa tu huella o rostro para entrar'}
        </p>

        <button onClick={pedirHuella} disabled={verificando} className="btn-primary w-full py-3">
          <Fingerprint className="w-4 h-4" />
          {verificando ? 'Esperando huella...' : 'Desbloquear'}
        </button>

        <button
          onClick={salir}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mt-6"
        >
          <LogOut className="w-3.5 h-3.5" />
          Entrar con correo y contraseña
        </button>
      </div>
    </div>
  )
}
