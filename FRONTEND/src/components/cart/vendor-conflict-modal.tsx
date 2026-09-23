import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface VendorConflictModalProps {
  isOpen: boolean
  currentVendorName: string
  newVendorName?: string
  onConfirm: () => void
  onCancel: () => void
}

export function VendorConflictModal({
  isOpen,
  currentVendorName,
  newVendorName,
  onConfirm,
  onCancel,
}: VendorConflictModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    // Focus Cancel button on open for safety
    cancelBtnRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="vendor-conflict-title"
      aria-describedby="vendor-conflict-desc"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning mb-4">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="text-center">
          <h3 id="vendor-conflict-title" className="text-h4 font-bold text-text-primary">
            Start a new cart?
          </h3>
          <p id="vendor-conflict-desc" className="mt-2 text-body-small text-text-secondary">
            Your cart contains items from{' '}
            <span className="font-semibold text-text-primary">{currentVendorName}</span>.
            {newVendorName ? (
              <>
                {' '}
                Would you like to clear your cart and start an order from{' '}
                <span className="font-semibold text-text-primary">{newVendorName}</span> instead?
              </>
            ) : (
              ' You can only order from one vendor at a time. Creating a new cart will remove your existing items.'
            )}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Keep Existing Cart
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white"
          >
            Start New Cart
          </Button>
        </div>
      </div>
    </div>
  )
}
