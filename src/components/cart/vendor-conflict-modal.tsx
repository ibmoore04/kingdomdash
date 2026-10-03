import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'

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
    if (isOpen) {
      // Focus Cancel button on open for safety
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      role="alertdialog"
      showCloseButton={false}
      dataTestId="vendor-conflict-modal"
      className="p-6 text-center sm:text-left"
    >
      <div className="flex flex-col items-center sm:items-start">
        <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/15 text-warning mb-4">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>

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

        <div className="mt-6 flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelBtnRef}
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto h-11"
          >
            Keep Existing Cart
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            className="w-full sm:w-auto h-11 bg-primary hover:bg-primary-hover text-white shadow-sm"
          >
            Start New Cart
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
