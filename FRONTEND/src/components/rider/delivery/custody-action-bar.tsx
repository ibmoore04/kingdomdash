import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PackageCheck, Bike, CheckCircle, AlertTriangle, Loader2, WifiOff, Check } from 'lucide-react'
import { enqueueOfflineDeliveryAction } from '@/services/rider/offline-delivery-queue'
import { playDispatchAlertChime, playLockoutAlertBeep } from '@/utils/audio-chime'

interface CustodyActionBarProps {
  orderId?: string
  deliveryStatus: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  orderStatus: string
  serviceType: 'food' | 'grocery' | 'courier' | 'custom' | 'personal_shopper'
  isMutating: boolean
  hasDeliveryPin?: boolean
  onPickup: (notes?: string) => Promise<void>
  onTransit: (notes?: string) => Promise<void>
  onDelivered: (notes?: string, pin?: string) => Promise<void>
  onOpenIssueModal: () => void
}

export function CustodyActionBar({
  orderId,
  deliveryStatus,
  orderStatus,
  serviceType,
  isMutating,
  hasDeliveryPin = false,
  onPickup,
  onTransit,
  onDelivered,
  onOpenIssueModal,
}: CustodyActionBarProps) {
  const [confirmingDelivered, setConfirmingDelivered] = useState(false)
  const [pin, setPin] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const MAX_ATTEMPTS = 3
  const isLocked = failedAttempts >= MAX_ATTEMPTS

  // Vendor readiness gate — courier/custom/personal_shopper bypass vendor prep entirely
  const isCourierType =
    serviceType === 'courier' || serviceType === 'custom' || serviceType === 'personal_shopper'
  const canPickup =
    deliveryStatus === 'assigned' &&
    (isCourierType || orderStatus === 'ready_for_pickup')

  const handlePickup = async () => {
    setErrorMessage(null)
    setOfflineNotice(null)
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    if (isOffline && orderId) {
      enqueueOfflineDeliveryAction({ orderId, actionType: 'pickup' })
      setOfflineNotice('📶 Pickup recorded offline. Will sync automatically once back in coverage.')
      playDispatchAlertChime()
      return
    }
    try {
      await onPickup()
      playDispatchAlertChime()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm pickup. Please retry.'
      if ((msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || isOffline) && orderId) {
        enqueueOfflineDeliveryAction({ orderId, actionType: 'pickup' })
        setOfflineNotice('📶 Pickup recorded offline. Will sync automatically once back in coverage.')
        playDispatchAlertChime()
      } else {
        setErrorMessage(msg)
      }
    }
  }

  const handleTransit = async () => {
    setErrorMessage(null)
    setOfflineNotice(null)
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    if (isOffline && orderId) {
      enqueueOfflineDeliveryAction({ orderId, actionType: 'transit' })
      setOfflineNotice('📶 Transit recorded offline. Will sync automatically once back in coverage.')
      playDispatchAlertChime()
      return
    }
    try {
      await onTransit()
      playDispatchAlertChime()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start transit. Please retry.'
      if ((msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || isOffline) && orderId) {
        enqueueOfflineDeliveryAction({ orderId, actionType: 'transit' })
        setOfflineNotice('📶 Transit recorded offline. Will sync automatically once back in coverage.')
        playDispatchAlertChime()
      } else {
        setErrorMessage(msg)
      }
    }
  }

  const handleDelivered = async () => {
    setErrorMessage(null)
    setOfflineNotice(null)
    if (isLocked) {
      setErrorMessage('PIN verification is locked due to 3 failed attempts. Please request a supervisor override.')
      return
    }
    if (hasDeliveryPin && !pin.trim()) {
      setErrorMessage('Please enter the customer confirmation PIN.')
      return
    }
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine
    if (isOffline && orderId) {
      enqueueOfflineDeliveryAction({ orderId, actionType: 'delivered', pin: pin.trim() || undefined })
      setOfflineNotice('📶 Delivery recorded offline. Will sync automatically once back in coverage.')
      setConfirmingDelivered(false)
      setPin('')
      playDispatchAlertChime()
      return
    }
    try {
      await onDelivered(undefined, pin.trim() || undefined)
      setConfirmingDelivered(false)
      setPin('')
      setFailedAttempts(0)
      playDispatchAlertChime()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete delivery. Please retry.'
      const isPinError = msg.toLowerCase().includes('pin')
      if (isPinError) {
        const nextAttempts = failedAttempts + 1
        setFailedAttempts(nextAttempts)
        if (nextAttempts >= MAX_ATTEMPTS) {
          playLockoutAlertBeep()
          setErrorMessage('🔒 PIN verification locked (3 failed attempts). Please tap "Request Override" to alert dispatch.')
        } else {
          setErrorMessage(`Incorrect PIN. ${MAX_ATTEMPTS - nextAttempts} attempt(s) remaining before security lockout.`)
        }
      } else if ((msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || isOffline) && orderId) {
        enqueueOfflineDeliveryAction({ orderId, actionType: 'delivered', pin: pin.trim() || undefined })
        setOfflineNotice('📶 Delivery recorded offline. Will sync automatically once back in coverage.')
        setConfirmingDelivered(false)
        setPin('')
        playDispatchAlertChime()
      } else {
        setErrorMessage(msg)
      }
    }
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-border bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] backdrop-blur-md shadow-lg">
      <div className="mx-auto max-w-lg space-y-3">
        {offlineNotice && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-body-small text-emerald-800">
            <WifiOff className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{offlineNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg bg-error/10 p-2.5 text-body-small text-error">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Stage 1: Pickup */}
        {deliveryStatus === 'assigned' && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={handlePickup}
              disabled={!canPickup || isMutating}
              className="h-14 w-full gap-2.5 text-body font-bold shadow-md bg-success hover:bg-success/90 text-white"
            >
              {isMutating ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <PackageCheck className="h-5 w-5" aria-hidden="true" />
              )}
              {canPickup ? 'Confirm Physical Pickup' : 'Waiting for Vendor to Finish Prep'}
            </Button>
            {!canPickup && !isCourierType && (
              <p className="text-center text-caption text-text-muted">
                Pickup unlocks automatically when vendor marks order ready
              </p>
            )}
          </div>
        )}

        {/* Stage 2: Start Transit */}
        {deliveryStatus === 'picked_up' && (
          <Button
            type="button"
            variant="primary"
            onClick={handleTransit}
            disabled={isMutating}
            className="h-14 w-full gap-2.5 text-body font-bold shadow-md text-white bg-primary hover:bg-primary-hover"
          >
            {isMutating ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Bike className="h-5 w-5" aria-hidden="true" />
            )}
            Start Transit (Heading to Destination)
          </Button>
        )}

        {/* Stage 3: Confirm Delivered */}
        {deliveryStatus === 'in_transit' && (
          <div>
            {!confirmingDelivered ? (
              <Button
                type="button"
                variant="primary"
                onClick={() => setConfirmingDelivered(true)}
                disabled={isMutating}
                className="h-14 w-full gap-2.5 text-body font-bold shadow-md bg-success hover:bg-success/90 text-white"
              >
                <CheckCircle className="h-5 w-5" aria-hidden="true" />
                Confirm Order Delivered
              </Button>
            ) : (
              <div className="rounded-xl border border-success/40 bg-success/10 p-3.5 space-y-3">
                <p className="text-body-small font-semibold text-text-primary text-center">
                  Confirm physical handoff to customer?
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="delivery-pin-input" className="block text-center text-caption font-semibold text-text-secondary">
                    {hasDeliveryPin
                      ? 'Ask customer for 4-digit Delivery PIN:'
                      : 'Delivery Confirmation PIN (if assigned):'}
                  </label>
                  <input
                    id="delivery-pin-input"
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 1234"
                    value={pin}
                    disabled={isLocked || isMutating}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg font-mono tracking-widest rounded-lg border border-border bg-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-success disabled:opacity-50 disabled:bg-neutral-100"
                  />
                  {failedAttempts > 0 && !isLocked && (
                    <p className="text-center text-[11px] font-bold text-amber-600">
                      ⚠️ {MAX_ATTEMPTS - failedAttempts} attempt(s) remaining before lockout
                    </p>
                  )}
                  {isLocked && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-center text-[11px] font-bold text-rose-700">
                      🔒 PIN verification locked (3 failed attempts)
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConfirmingDelivered(false)
                      setPin('')
                    }}
                    disabled={isMutating}
                  >
                    Cancel
                  </Button>
                  {isLocked ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        setConfirmingDelivered(false)
                        onOpenIssueModal()
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Request Override
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleDelivered}
                      disabled={isMutating || isLocked}
                      className="bg-success hover:bg-success/90 text-white font-bold"
                    >
                      {isMutating ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        'Yes, Delivered'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Issue Reporting Trigger */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onOpenIssueModal}
            className="flex items-center gap-1.5 text-caption font-semibold text-text-muted hover:text-error transition-colors"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Report Delay or Operational Issue
          </button>
        </div>
      </div>
    </div>
  )
}
