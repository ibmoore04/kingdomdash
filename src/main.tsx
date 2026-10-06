import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { ToastViewport } from '@/components/ui/toast'
import { supabase } from '@/services/supabase/client'
import App from './App.tsx'
import '@/styles/index.css'

import { playNotificationChime, unlockAudioContext } from '@/utils/audio-chime'
import { registerServiceWorker } from '@/utils/pwa-service-worker'
import { useUiStore } from '@/stores/ui-store'

// Initialize PWA service worker shell
registerServiceWorker().catch(() => {})

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const win = window as unknown as Record<string, unknown>
  win.supabase = supabase
  win.testChime = (variant: 'info' | 'success' | 'warning' | 'error' = 'success') =>
    playNotificationChime(variant)
  win.playChime = (variant: 'info' | 'success' | 'warning' | 'error' = 'success') =>
    playNotificationChime(variant)
  win.unlockAudio = unlockAudioContext
  win.pushToast = (toast: {
    title: string
    message?: string
    variant?: 'info' | 'success' | 'warning' | 'error'
  }) => useUiStore.getState().pushToast({ variant: 'info', ...toast })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <App />
        <ToastViewport />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
