/**
 * URL Sanitization & Protocol Validation Utility
 *
 * Defends against XSS via javascript:, data:, and vbscript: URI schemes.
 * Ensures user-controllable links and URLs only permit safe web schemes (http: or https:)
 * or relative root-anchored internal routes.
 */

export function isSafeUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false

  // Strip ASCII control characters and whitespace
  // eslint-disable-next-line no-control-regex
  const sanitized = url.replace(/[\x00-\x1F\x7F-\x9F\s]/g, '').trim()
  if (!sanitized) return false

  // Reject dangerous schemes
  if (/^(javascript|data|vbscript|file):/i.test(sanitized)) {
    return false
  }

  // Allow relative URLs starting with / (excluding protocol-relative //)
  const trimmed = url.trim()
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function sanitizeSafeUrl(
  url: string | null | undefined,
  fallback: string = ''
): string {
  if (!url || typeof url !== 'string') {
    return fallback
  }

  if (isSafeUrl(url)) {
    const trimmed = url.trim()
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed
    }
    try {
      const parsed = new URL(trimmed)
      return parsed.href
    } catch {
      return fallback
    }
  }

  return fallback
}
