import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { mapAuthError, SAFE_ERROR_MESSAGES } from '@/utils/auth-errors'

describe('auth-errors unit tests (P3)', () => {
  it('maps invalid login credentials to safe message', () => {
    expect(mapAuthError(new Error('Invalid login credentials'))).toBe('Invalid email or password.')
    expect(mapAuthError('Invalid credentials')).toBe('Invalid email or password.')
  })

  it('maps unconfirmed email to safe message', () => {
    expect(mapAuthError(new Error('Email not confirmed'))).toBe(
      'Please confirm your email before signing in.'
    )
  })

  it('maps duplicate user to safe message', () => {
    expect(mapAuthError(new Error('User already registered'))).toBe(
      'An account with this email already exists.'
    )
  })

  it('maps short password error to safe message', () => {
    expect(mapAuthError(new Error('Password should be at least 6 characters'))).toBe(
      'Password must be at least 8 characters.'
    )
  })

  it('maps expired token/link to safe message', () => {
    expect(mapAuthError(new Error('Token has expired or is invalid'))).toBe(
      'Link expired or already used. Please request a new one.'
    )
  })

  it('maps inactive account error to safe message', () => {
    expect(mapAuthError(new Error('Account inactive'))).toBe(
      'Your account is inactive. Please contact support.'
    )
  })

  it('maps unknown error to safe fallback message', () => {
    expect(mapAuthError(new Error('PG: unique constraint violation on table public.profiles_foo_key'))).toBe(
      'Operation failed. Please try again.'
    )
    expect(mapAuthError(null, 'Login')).toBe('Login failed. Please try again.')
  })
})

describe('auth-errors Property-Based Tests (P3)', () => {
  it('P3: mapAuthError never exposes raw error string and always returns a safe string', () => {
    const defaultSafeList = [...SAFE_ERROR_MESSAGES]

    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.record({ message: fc.string() }),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (rawError) => {
          const result = mapAuthError(rawError)
          // Result must never be empty
          expect(result.length).toBeGreaterThan(0)
          // Result must be one of the known safe messages
          expect(defaultSafeList).toContain(result)
        }
      )
    )
  })
})
