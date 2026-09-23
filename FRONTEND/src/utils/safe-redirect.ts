import type { Database } from '@/types/database.types'

export type UserRole = Database['public']['Enums']['user_role']

export interface ProfileSummary {
  role: UserRole
}

export const ROLE_DASHBOARD_MAP: Record<UserRole, string> = {
  customer: '/dashboard',
  vendor: '/vendor',
  rider: '/rider',
  admin: '/admin',
  super_admin: '/admin',
}

export const roleDashboardPath = (role: UserRole): string =>
  ROLE_DASHBOARD_MAP[role] ?? '/dashboard'

/**
 * Validates a redirect path against open redirect vulnerabilities and dangerous schemes.
 * Injectable currentOrigin allows this function to be pure and deterministic in tests and SSR.
 */
export function validateRedirectPath(
  path: string | null | undefined,
  currentOrigin?: string
): string | null {
  if (!path || typeof path !== 'string') return null

  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }

  // Must be relative starting with /
  if (!decoded.startsWith('/')) return null
  // Reject protocol-relative URLs (e.g. //evil.com)
  if (decoded.startsWith('//')) return null
  // Reject dangerous schemes
  if (/javascript:|data:|vbscript:/i.test(decoded)) return null
  // Reject any embedded scheme pattern (e.g. /http:// or scheme:)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/i.test(decoded.slice(1))) return null

  const origin =
    currentOrigin ??
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000')

  try {
    const url = new URL(decoded, origin)
    if (url.origin !== origin) return null
  } catch {
    return null
  }

  return decoded
}

/**
 * Resolves post-login navigation target while verifying that cross-role redirects are blocked.
 */
export function resolvePostLoginTarget(
  redirectParam: string | null | undefined,
  profile: ProfileSummary,
  currentOrigin?: string
): string {
  const safe = validateRedirectPath(redirectParam, currentOrigin)
  const ownDashboard = roleDashboardPath(profile.role)
  if (!safe) return '/'

  // If redirect points to a dashboard belonging to another role, block cross-role redirect
  const allDashboardRoots = ['/dashboard', '/vendor', '/rider', '/admin']
  const pointsToDashboard = allDashboardRoots.some(
    (d) => safe === d || safe.startsWith(d + '/')
  )
  if (pointsToDashboard && !safe.startsWith(ownDashboard)) {
    return ownDashboard
  }

  return safe
}
