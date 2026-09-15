import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect } from 'react'
import { useUiStore } from '@/stores/ui-store'

const iconMap = {
  success: CircleCheck,
  error: CircleAlert,
  warning: CircleAlert,
  info: Info,
}

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const Icon = iconMap[toast.variant]
        return (
          <ToastCard
            key={toast.id}
            id={toast.id}
            title={toast.title}
            message={toast.message}
            variant={toast.variant}
            onDismiss={() => dismissToast(toast.id)}
            icon={Icon}
          />
        )
      })}
    </div>
  )
}

function ToastCard({
  id,
  title,
  message,
  variant,
  onDismiss,
  icon: Icon,
}: {
  id: string
  title: string
  message?: string
  variant: 'info' | 'success' | 'warning' | 'error'
  onDismiss: () => void
  icon: typeof Info
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000)
    return () => window.clearTimeout(timer)
  }, [id, onDismiss])

  return (
    <div
      className="pointer-events-auto flex gap-3 rounded-md border border-border bg-white p-4 shadow-card"
      role="status"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-hover" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-label">{title}</p>
        {message ? <p className="mt-1 text-body-small text-text-secondary">{message}</p> : null}
        <p className="sr-only">{variant}</p>
      </div>
      <button
        type="button"
        className="text-text-muted hover:text-text-primary"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
