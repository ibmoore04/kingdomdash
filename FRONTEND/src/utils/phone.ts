/**
 * Phone Number Normalization & Validation Utility for KingdomDash.
 *
 * Implements E.164 canonical formatting with tailored support for Nigerian
 * mobile numbers (NCC prefixes: 070, 080, 081, 090, 091, 071) while preserving
 * international E.164 flexibility for expansion.
 */

// Common Nigerian mobile prefixes (without leading 0)
const NIGERIAN_MOBILE_PREFIXES = [
  '701', '702', '703', '704', '705', '706', '707', '708', '709',
  '802', '803', '804', '805', '806', '807', '808', '809',
  '810', '811', '812', '813', '814', '815', '816', '817', '818', '819',
  '901', '902', '903', '904', '905', '906', '907', '908', '909',
  '911', '912', '913', '914', '915', '916'
]

export interface PhoneValidationResult {
  isValid: boolean
  error?: string
  normalized?: string
}

/**
 * Normalizes a raw phone input into canonical E.164 format (+<country><digits>).
 * Defaults to Nigeria (+234) if local 11-digit or 10-digit number is provided.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode = '234'): string | null {
  if (!raw || typeof raw !== 'string') return null

  // Strip spaces, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-().]/g, '')
  if (!cleaned) return null

  // Check for disallowed characters (only digits and leading + are permitted)
  if (!/^\+?\d+$/.test(cleaned)) {
    return null
  }

  // Handle leading "+"
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1)
    if (digitsOnly.length < 8 || digitsOnly.length > 15) return null
    return `+${digitsOnly}`
  }

  // Handle Nigerian numbers without "+"
  // Case A: Starts with "234" (e.g. 2348031234567 -> 13 digits)
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+${cleaned}`
  }

  // Case B: Starts with "0" (e.g. 08031234567 -> 11 digits)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+${defaultCountryCode}${cleaned.slice(1)}`
  }

  // Case C: 10 digits without leading 0 (e.g. 8031234567)
  if (cleaned.length === 10) {
    return `+${defaultCountryCode}${cleaned}`
  }

  // Case D: Other international digits without plus (must be 10-15 digits)
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return `+${cleaned}`
  }

  return null
}

/**
 * Validates a phone number for registration.
 * Ensures the number is non-empty, well-formed, and meets length/carrier requirements.
 */
export function validatePhoneNumber(raw: string): PhoneValidationResult {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: 'Phone number is required' }
  }

  const cleaned = raw.trim().replace(/[\s\-().]/g, '')

  // Reject invalid characters
  if (!/^\+?\d+$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Phone number must contain only numbers and an optional leading "+"',
    }
  }

  const normalized = normalizePhoneNumber(raw)

  if (!normalized) {
    return {
      isValid: false,
      error: 'Please enter a valid phone number (e.g. 0801 234 5678 or +234 801 234 5678)',
    }
  }

  const digits = normalized.slice(1)

  // Minimum and maximum E.164 length
  if (digits.length < 8 || digits.length > 15) {
    return {
      isValid: false,
      error: 'Phone number length is invalid (must be between 8 and 15 digits)',
    }
  }

  // Specific check if it's a Nigerian number (+234...)
  if (normalized.startsWith('+234')) {
    const nigerianDigits = normalized.slice(4) // after +234
    if (nigerianDigits.length !== 10) {
      return {
        isValid: false,
        error: 'Nigerian phone numbers must be 10 digits after the country code or 11 digits starting with 0',
      }
    }

    const prefix = nigerianDigits.slice(0, 3)
    const matchesPrefix = NIGERIAN_MOBILE_PREFIXES.includes(prefix)
    if (!matchesPrefix) {
      // Still allow valid landline or new prefixes, but ensure valid format
      if (!/^[1-9]\d{9}$/.test(nigerianDigits)) {
        return {
          isValid: false,
          error: 'Please enter a valid Nigerian mobile phone number',
        }
      }
    }
  }

  return { isValid: true, normalized }
}

/**
 * Formats a phone number for user-friendly UI display.
 * Example: +2348031234567 -> +234 803 123 4567
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return ''
  const cleaned = phone.replace(/[\s\-()]/g, '')

  if (cleaned.startsWith('+234') && cleaned.length === 14) {
    // +234 803 123 4567
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`
  }

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 0803 123 4567
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }

  return phone
}
