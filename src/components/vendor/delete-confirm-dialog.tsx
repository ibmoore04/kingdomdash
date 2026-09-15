import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  title: string
  description: string
  warning?: string
  isDeleting?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteConfirmDialog({
  isOpen,
  title,
  description,
  warning,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 text-status-error">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-error/10">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-h4 font-bold text-text-primary">{title}</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-body text-text-secondary">{description}</p>

        {warning && (
          <div className="mt-3 rounded-lg border border-status-warning/20 bg-status-warning/10 p-3 text-body-small text-text-primary">
            <strong>Warning:</strong> {warning}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-status-error hover:bg-status-error/90 text-white"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
