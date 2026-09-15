import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore, type UserRole } from '@/stores/auth-store'
import { roleDashboardPath, ROLE_DASHBOARD_MAP } from '@/utils/safe-redirect'

export { roleDashboardPath, ROLE_DASHBOARD_MAP }

export function AuthSpinner({ label = 'Verifying authorization…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-[60vh] w-full items-center justify-center p-8"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        <span className="text-body-small text-text-secondary">{label}</span>
      </div>
    </div>
  )
}

export interface RouteGuardProps {
  allowedRoles?: UserRole[]
}

export function RouteGuard({ allowedRoles }: RouteGuardProps) {
  const { session, profile, isLoading, profileError, signOut } = useAuthStore()
  const location = useLocation()
  const signOutInitiated = useRef(false)

  const isResolvingProfile = session !== null && profile === null && profileError === null

  // Inactive profile or unresolvable profile error: trigger sign-out once
  useEffect(() => {
    if (!signOutInitiated.current) {
      if (profile && !profile.is_active) {
        signOutInitiated.current = true
        signOut()
      } else if (session !== null && profile === null && profileError !== null) {
        signOutInitiated.current = true
        signOut()
      }
    }
  }, [session, profile, profileError, signOut])

  // 1. Auth resolving -> spinner (P9)
  if (isLoading || isResolvingProfile) {
    return <AuthSpinner />
  }

  // 2. Unauthenticated -> redirect to login with encoded redirect param (P10)
  if (!session) {
    const redirectParam = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth/login?redirect=${redirectParam}`} replace />
  }

  // 3. Unresolvable profile error (P9)
  if (profile === null && profileError !== null) {
    return <Navigate to="/auth/login" replace />
  }

  // 4. Inactive account (P13)
  if (profile && !profile.is_active) {
    return <Navigate to="/auth/login?error=inactive" replace />
  }

  // 5. Wrong role -> redirect to own dashboard (P11)
  if (profile && allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={roleDashboardPath(profile.role)} replace />
  }

  // 6. Authorized -> render outlet (P9)
  return <Outlet />
}
