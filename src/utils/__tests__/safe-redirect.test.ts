import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateRedirectPath,
  resolvePostLoginTarget,
  roleDashboardPath,
  type UserRole,
} from '@/utils/safe-redirect'

describe('safe-redirect unit tests', () => {
  const origin = 'https://app.kingdomdash.com'

  it('accepts valid relative paths', () => {
    expect(validateRedirectPath('/dashboard', origin)).toBe('/dashboard')
    expect(validateRedirectPath('/vendor/settings', origin)).toBe('/vendor/settings')
    expect(validateRedirectPath('/food?category=1', origin)).toBe('/food?category=1')
  })

  it('rejects external URLs and absolute schemes', () => {
    expect(validateRedirectPath('https://evil.example/path', origin)).toBeNull()
    expect(validateRedirectPath('http://app.kingdomdash.com/dashboard', origin)).toBeNull()
    expect(validateRedirectPath('ftp://files.example.com', origin)).toBeNull()
  })

  it('rejects protocol-relative URLs', () => {
    expect(validateRedirectPath('//evil.example', origin)).toBeNull()
    expect(validateRedirectPath('///evil.example', origin)).toBeNull()
  })

  it('rejects dangerous script schemes', () => {
    expect(validateRedirectPath('javascript:alert(1)', origin)).toBeNull()
    expect(validateRedirectPath('data:text/html,<script>alert(1)</script>', origin)).toBeNull()
    expect(validateRedirectPath('vbscript:msgbox(1)', origin)).toBeNull()
  })

  it('rejects URL-encoded dangerous variations', () => {
    expect(validateRedirectPath('%2F%2Fevil.example', origin)).toBeNull()
    expect(validateRedirectPath('http:%2F%2Fevil.example', origin)).toBeNull()
    expect(validateRedirectPath('%6aavascript:alert(1)', origin)).toBeNull()
  })

  it('rejects empty, whitespace-only, null, or undefined values', () => {
    expect(validateRedirectPath('', origin)).toBeNull()
    expect(validateRedirectPath('   ', origin)).toBeNull()
    expect(validateRedirectPath(null, origin)).toBeNull()
    expect(validateRedirectPath(undefined, origin)).toBeNull()
  })

  it('resolvePostLoginTarget respects user own dashboard or permitted paths (P4)', () => {
    const customer = { role: 'customer' as UserRole }
    expect(resolvePostLoginTarget('/dashboard/orders', customer, origin)).toBe('/dashboard/orders')
    expect(resolvePostLoginTarget('/food', customer, origin)).toBe('/food')
    expect(resolvePostLoginTarget(null, customer, origin)).toBe('/dashboard')
  })

  it('resolvePostLoginTarget blocks cross-role redirects (P16)', () => {
    const customer = { role: 'customer' as UserRole }
    expect(resolvePostLoginTarget('/admin', customer, origin)).toBe('/dashboard')
    expect(resolvePostLoginTarget('/vendor/dashboard', customer, origin)).toBe('/dashboard')
    expect(resolvePostLoginTarget('/rider', customer, origin)).toBe('/dashboard')

    const rider = { role: 'rider' as UserRole }
    expect(resolvePostLoginTarget('/vendor', rider, origin)).toBe('/rider')
    expect(resolvePostLoginTarget('/admin', rider, origin)).toBe('/rider')
    expect(resolvePostLoginTarget('/dashboard', rider, origin)).toBe('/rider')

    const admin = { role: 'admin' as UserRole }
    expect(resolvePostLoginTarget('/admin/fleet', admin, origin)).toBe('/admin/fleet')
    expect(resolvePostLoginTarget('/dashboard', admin, origin)).toBe('/admin')
    expect(resolvePostLoginTarget('/vendor', admin, origin)).toBe('/admin')
  })
})

describe('safe-redirect Property-Based Tests (P12 & P16)', () => {
  const origin = 'https://app.kingdomdash.com'

  it('P12: validateRedirectPath rejects all absolute web URLs', () => {
    fc.assert(
      fc.property(fc.webUrl(), (url) => {
        return validateRedirectPath(url, origin) === null
      }),
      { numRuns: 20 }
    )
  }, 60000)

  it('P12: validateRedirectPath rejects all protocol-relative URLs', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const protocolRelative = '//' + s
        return validateRedirectPath(protocolRelative, origin) === null
      })
    )
  })

  it('P12: validateRedirectPath rejects all dangerous schemes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('javascript:', 'data:', 'vbscript:').chain((scheme) =>
          fc.string().map((s) => scheme + s)
        ),
        (dangerous) => {
          return validateRedirectPath(dangerous, origin) === null
        }
      )
    )
  })

  it('P12: validateRedirectPath accepts valid safe relative paths', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1 })
          .filter((s) => !s.startsWith('/') && !s.includes(':') && !s.includes('\\')),
        (segment) => {
          const safePath = '/' + encodeURIComponent(segment)
          const result = validateRedirectPath(safePath, origin)
          return (
            result !== null &&
            result.startsWith('/') &&
            !result.startsWith('//')
          )
        }
      )
    )
  })

  it('P16: resolvePostLoginTarget prevents any cross-role redirect across all roles', () => {
    const roles: UserRole[] = ['customer', 'vendor', 'rider', 'admin', 'super_admin']
    const dashboardPrefixes = ['/dashboard', '/vendor', '/rider', '/admin']

    fc.assert(
      fc.property(
        fc.constantFrom(...roles),
        fc.constantFrom(...dashboardPrefixes),
        fc.string({ maxLength: 20 }).filter((s) => !s.includes('/') && !s.includes('\\') && !s.includes('%')),
        (role, targetDashboard, suffix) => {
          const profile = { role }
          const path = suffix ? `${targetDashboard}/${suffix}` : targetDashboard
          const target = resolvePostLoginTarget(path, profile, origin)
          const ownDashboard = roleDashboardPath(role)

          if (path === ownDashboard || path.startsWith(ownDashboard + '/')) {
            return target === path
          } else {
            return target === ownDashboard
          }
        }
      )
    )
  })
})
