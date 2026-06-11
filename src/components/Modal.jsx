import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ titulo, children, onClose, ancho = 'max-w-lg' }) {
  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Contenido — bottom sheet en móvil, modal centrado en desktop */}
      <div className={`relative glass rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${ancho} max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-scale-in`}>
        {/* Header */}
        <div className="sticky top-0 glass flex items-center justify-between px-5 py-4 border-b border-white/[0.07] rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="font-display text-base font-bold text-slate-100">{titulo}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-white/[0.08] rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="p-5" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
