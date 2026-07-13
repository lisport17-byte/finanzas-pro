import { useState } from 'react'
import { auth } from '../lib/queries'
import useStore from '../store/useStore'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

/**
 * Pantalla que aparece cuando el usuario llega desde el enlace de
 * recuperación del correo (evento PASSWORD_RECOVERY de Supabase).
 * Aquí define su nueva contraseña sin necesidad de recordar la anterior.
 */
export default function RestablecerClave({ onListo }) {
  const addToast = useStore((s) => s.addToast)
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [show, setShow] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (pass1.length < 6) {
      addToast('La contraseña debe tener al menos 6 caracteres', 'warning')
      return
    }
    if (pass1 !== pass2) {
      addToast('Las contraseñas no coinciden', 'error')
      return
    }
    setGuardando(true)
    const { error } = await auth.actualizarPassword(pass1)
    setGuardando(false)
    if (error) {
      addToast('No se pudo cambiar: ' + error.message, 'error')
    } else {
      addToast('✓ Contraseña actualizada — ya puedes usar la app', 'success')
      onListo()
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">Nueva contraseña</h2>
              <p className="text-xs text-slate-500">Define tu nueva clave de acceso</p>
            </div>
          </div>

          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label className="label">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={pass1}
                  onChange={(e) => setPass1(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Repite la contraseña</label>
              <input
                type={show ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <button type="submit" disabled={guardando} className="btn-primary w-full py-3">
              {guardando ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Guardar nueva contraseña'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
