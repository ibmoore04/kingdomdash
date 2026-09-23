import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  message?: string
  variant: ToastVariant
}

interface UiState {
  toasts: ToastItem[]
  mobileNavOpen: boolean
  pushToast: (toast: Omit<ToastItem, 'id'>) => void
  dismissToast: (id: string) => void
  setMobileNavOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  mobileNavOpen: false,
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))
