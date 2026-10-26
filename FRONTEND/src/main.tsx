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

// Auto-recover from stale deployment chunks when new versions deploy to Vercel
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[KingdomDash] Stale chunk detected after deployment. Reloading for latest release...', event)
    const key = 'kd_preload_reload_' + window.location.pathname
    const lastReload = Number(sessionStorage.getItem(key) || 0)
    const now = Date.now()
    if (now - lastReload > 8000) {
      sessionStorage.setItem(key, String(now))
      window.location.reload()
    }
  })
}

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
