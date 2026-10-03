import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
  contentClassName?: string
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  role?: 'dialog' | 'alertdialog'
  dataTestId?: string
  ariaLabel?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  contentClassName,
  showCloseButton = true,
  closeOnBackdropClick = true,
  role = 'dialog',
  dataTestId = 'bottom-sheet',
  ariaLabel,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when open and handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const titleId = title ? 'bottom-sheet-title' : undefined
  const descriptionId = description ? 'bottom-sheet-desc' : undefined

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4"
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-label={ariaLabel}
      data-testid={dataTestId}
    >
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={() => {
          if (closeOnBackdropClick) {
            onClose()
          }
        }}
      />

      {/* Sheet Content Container */}
      <div
        ref={sheetRef}
        className={cn(
          'relative z-10 flex w-full max-h-[90vh] flex-col rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl transition-all',
          'sm:max-w-lg sm:max-h-[85vh]',
          'animate-in slide-in-from-bottom duration-250 sm:slide-in-from-bottom-2 sm:zoom-in-95',
          'pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0',
          className
        )}
      >
        {/* Pull-down drag indicator handle for mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div
            className="h-1.5 w-12 rounded-full bg-neutral-300 transition-colors hover:bg-neutral-400"
            aria-hidden="true"
          />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between border-b border-border/80 px-5 sm:px-6 py-3.5">
            <div className="space-y-0.5 pr-6">
              {title && (
                <div id={titleId} className="text-base sm:text-lg font-bold text-text-primary">
                  {title}
                </div>
              )}
              {description && (
                <p id={descriptionId} className="text-xs text-text-secondary">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-full p-1.5 text-text-secondary hover:bg-neutral-100 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Scrollable Body Content */}
        <div
          className={cn(
            'flex-1 overflow-y-auto px-5 sm:px-6 py-4 overscroll-contain',
            contentClassName
          )}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="border-t border-border/80 bg-neutral-50/70 px-5 sm:px-6 py-3 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
