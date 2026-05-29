import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

const iconos = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error:   <AlertCircle className="w-4 h-4 text-red-400" />,
  info:    <Info className="w-4 h-4 text-indigo-400" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-400" />,
}

const colores = {
  success: 'border-emerald-700/50 bg-emerald-900/30',
  error:   'border-red-700/50 bg-red-900/30',
  info:    'border-indigo-700/50 bg-indigo-900/30',
  warning: 'border-amber-700/50 bg-amber-900/30',
}

export default function Toast({ toast, onClose }) {
  const tipo = toast.tipo || 'info'
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${colores[tipo]} backdrop-blur-sm shadow-lg animate-in slide-in-from-right`}>
      {iconos[tipo]}
      <p className="text-sm text-slate-200 flex-1">{toast.mensaje}</p>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
