export interface OperatingStatus {
  isOpen: boolean
  isClosingSoon: boolean
  minutesUntilClose?: number
  statusText: string
  detailText: string
  badgeVariant: 'success' | 'warning' | 'neutral' | 'destructive'
  canPreOrder: boolean
  formattedHours: string
}

/**
 * Parses time string like "8:00 AM", "08:00", "9:30 PM", "21:30" to minutes from midnight
 */
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null
  const cleaned = timeStr.trim().toLowerCase()
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const modifier = match[3]?.toLowerCase()

  if (modifier === 'pm' && hours < 12) hours += 12
  if (modifier === 'am' && hours === 12) hours = 0

  return hours * 60 + minutes
}

/**
 * Analyzes vendor operating hours and current time to return live dynamic status
 */
export function getVendorOperatingStatus(
  operatingHours: unknown,
  isActive: boolean = true,
  currentDate: Date = new Date()
): OperatingStatus {
  // If vendor is manually paused or deactivated by admin/merchant
  if (!isActive) {
    return {
      isOpen: false,
      isClosingSoon: false,
      statusText: 'Currently Closed',
      detailText: 'Not accepting live orders right now. Pre-orders open for tomorrow.',
      badgeVariant: 'neutral',
      canPreOrder: true,
      formattedHours: 'Opens 8:00 AM tomorrow',
    }
  }

  let rawDisplay = ''
  if (typeof operatingHours === 'string') {
    rawDisplay = operatingHours
  } else if (
    operatingHours &&
    typeof operatingHours === 'object' &&
    'display' in (operatingHours as Record<string, unknown>)
  ) {
    rawDisplay = String((operatingHours as Record<string, unknown>).display || '')
  }

  if (!rawDisplay) {
    rawDisplay = '8:00 AM - 9:00 PM'
  }

  // Check if string contains a range e.g. "8:00 AM - 9:00 PM"
  const rangeMatch = rawDisplay.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  )

  if (!rangeMatch) {
    return {
      isOpen: true,
      isClosingSoon: false,
      statusText: 'Open for orders',
      detailText: rawDisplay,
      badgeVariant: 'success',
      canPreOrder: true,
      formattedHours: rawDisplay,
    }
  }

  let startRaw = rangeMatch[1].trim()
  let endRaw = rangeMatch[2].trim()

  // Standardize single digit hours like "8 AM" to "8:00 AM"
  if (!startRaw.includes(':')) {
    startRaw = startRaw.replace(/(\d+)\s*(am|pm)/i, '$1:00 $2')
  }
  if (!endRaw.includes(':')) {
    endRaw = endRaw.replace(/(\d+)\s*(am|pm)/i, '$1:00 $2')
  }

  const startMinutes = parseTimeToMinutes(startRaw)
  const endMinutes = parseTimeToMinutes(endRaw)

  if (startMinutes === null || endMinutes === null) {
    return {
      isOpen: true,
      isClosingSoon: false,
      statusText: 'Open for orders',
      detailText: rawDisplay,
      badgeVariant: 'success',
      canPreOrder: true,
      formattedHours: rawDisplay,
    }
  }

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()

  // Case 1: Standard daytime schedule (e.g. 8:00 AM to 9:00 PM / 480 to 1260)
  if (startMinutes < endMinutes) {
    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      const minutesRemaining = endMinutes - currentMinutes
      if (minutesRemaining <= 45) {
        return {
          isOpen: true,
          isClosingSoon: true,
          minutesUntilClose: minutesRemaining,
          statusText: `Closing in ${minutesRemaining}m`,
          detailText: `Kitchen closes at ${endRaw}. Order soon!`,
          badgeVariant: 'warning',
          canPreOrder: true,
          formattedHours: rawDisplay,
        }
      }
      return {
        isOpen: true,
        isClosingSoon: false,
        statusText: 'Open for orders',
        detailText: `Open until ${endRaw}`,
        badgeVariant: 'success',
        canPreOrder: true,
        formattedHours: rawDisplay,
      }
    } else {
      const isBeforeOpen = currentMinutes < startMinutes
      return {
        isOpen: false,
        isClosingSoon: false,
        statusText: isBeforeOpen ? `Opens at ${startRaw}` : 'Closed for Today',
        detailText: isBeforeOpen
          ? `Kitchen opens at ${startRaw}. Pre-orders accepted.`
          : `Opens tomorrow at ${startRaw}.`,
        badgeVariant: 'neutral',
        canPreOrder: true,
        formattedHours: rawDisplay,
      }
    }
  }

  // Case 2: Overnight schedule (e.g. 6:00 PM to 2:00 AM)
  const isOpenOvernight = currentMinutes >= startMinutes || currentMinutes < endMinutes
  if (isOpenOvernight) {
    return {
      isOpen: true,
      isClosingSoon: false,
      statusText: 'Open for orders',
      detailText: `Open until ${endRaw}`,
      badgeVariant: 'success',
      canPreOrder: true,
      formattedHours: rawDisplay,
    }
  }

  return {
    isOpen: false,
    isClosingSoon: false,
    statusText: `Opens at ${startRaw}`,
    detailText: `Pre-orders accepted. Opens at ${startRaw}.`,
    badgeVariant: 'neutral',
    canPreOrder: true,
    formattedHours: rawDisplay,
  }
}
