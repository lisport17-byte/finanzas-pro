import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Usuario autenticado ──────────────────────────────────────────────────────
  user: null,
  setUser: (user) => set({ user }),

  // ── Estado de carga global ───────────────────────────────────────────────────
  loading: false,
  setLoading: (loading) => set({ loading }),

  // ── Notificaciones / toasts ──────────────────────────────────────────────────
  toasts: [],
  addToast: (mensaje, tipo = 'info') => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, mensaje, tipo }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  // ── Datos en caché ───────────────────────────────────────────────────────────
  clientes: [],
  setClientes: (clientes) => set({ clientes }),

  tiposServicio: [],
  setTiposServicio: (tiposServicio) => set({ tiposServicio }),

  // ── Contadores de alertas ────────────────────────────────────────────────────
  alertasCount: 0,
  setAlertasCount: (n) => set({ alertasCount: n }),
}))

export default useStore
