import { useUiStore } from '@/stores/ui-store'

export function useToast() {
  const pushToast = useUiStore((state) => state.pushToast)
  const dismissToast = useUiStore((state) => state.dismissToast)
  return { pushToast, dismissToast }
}
