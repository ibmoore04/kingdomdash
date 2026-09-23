import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Radio, Power, Loader2 } from 'lucide-react'

interface AvailabilitySwitchProps {
  isAvailable: boolean
  isVerified: boolean
  isActive: boolean
  inFlightCount?: number
  onToggle: (nextState: boolean) => Promise<void>
  compact?: boolean
}

export function AvailabilitySwitch({
  isAvailable,
  isVerified,
  isActive,
  inFlightCount = 0,
  onToggle,
  compact = false,
}: AvailabilitySwitchProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canToggle = isVerified && isActive && !isUpdating

  const handleToggle = async (checked: boolean) => {
    if (!canToggle) return

    setErrorMessage(null)
    setIsUpdating(true)

    try {
      await onToggle(checked)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update availability. Please retry.'
      )
    } finally {
      setIsUpdating(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor="rider-availability-toggle-compact"
          className="flex items-center gap-1.5 cursor-pointer select-none"
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              isAvailable ? 'bg-emerald-500/10 text-emerald-600' : 'bg-border text-text-muted'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : isAvailable ? (
              <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-600" aria-hidden="true" />
            ) : (
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </div>
          <span className="hidden sm:inline text-caption font-semibold text-text-primary">
            {isAvailable ? 'Online' : 'Offline'}
          </span>
        </label>

        <Switch
          id="rider-availability-toggle-compact"
          checked={isAvailable}
          onCheckedChange={handleToggle}
          disabled={!canToggle}
          aria-label="Toggle rider online availability"
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <label
          htmlFor="rider-availability-toggle"
          className="flex items-center gap-2 cursor-pointer select-none"
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isAvailable ? 'bg-primary/10 text-primary' : 'bg-border text-text-muted'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : isAvailable ? (
              <Radio className="h-4 w-4 animate-pulse" aria-hidden="true" />
            ) : (
              <Power className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-body-small font-semibold text-text-primary">
              {isAvailable ? 'Online (Available)' : 'Offline (Unavailable)'}
            </span>
            <span className="text-caption text-text-secondary">
              {isAvailable
                ? inFlightCount > 0
                  ? `On Delivery (${inFlightCount} active)`
                  : 'Ready for dispatches'
                : 'Not accepting dispatches'}
            </span>
          </div>
        </label>

        <Switch
          id="rider-availability-toggle"
          checked={isAvailable}
          onCheckedChange={handleToggle}
          disabled={!canToggle}
          aria-label="Toggle rider online availability"
        />
      </div>

      {!isVerified && (
        <Badge variant="warning" className="w-fit text-caption">
          Verification required to go online
        </Badge>
      )}

      {errorMessage && (
        <span className="text-caption text-error font-medium" role="alert">
          {errorMessage}
        </span>
      )}
    </div>
  )
}
