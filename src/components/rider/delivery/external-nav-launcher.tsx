import { Navigation, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExternalNavLauncherProps {
  latitude: number | null
  longitude: number | null
  destinationName: string
  className?: string
}

export function ExternalNavLauncher({
  latitude,
  longitude,
  destinationName,
  className = '',
}: ExternalNavLauncherProps) {
  const isValidCoords =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180

  if (!isValidCoords) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        className={`w-full gap-2 text-text-muted ${className}`}
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        Navigation Unavailable (No GPS)
      </Button>
    )
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
  const appleMapsUrl = `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`

  return (
    <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
      <Button
        asChild
        variant="outline"
        className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
      >
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open turn-by-turn route to ${destinationName} in Google Maps`}
        >
          <Navigation className="h-4 w-4 text-primary" aria-hidden="true" />
          Navigate in Google Maps
          <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        </a>
      </Button>

      <Button
        asChild
        variant="ghost"
        className="gap-1.5 text-caption text-text-muted hover:text-text-primary"
      >
        <a
          href={appleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open turn-by-turn route to ${destinationName} in Apple Maps`}
        >
          Apple Maps
        </a>
      </Button>
    </div>
  )
}
