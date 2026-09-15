import { describe, it, expect } from 'vitest'
import { mapRiderRpcError } from '../error-mapper'

describe('Rider Error Mapper', () => {
  it('maps KD400 to invalid parameter message', () => {
    const error = { code: 'KD400', message: 'Invalid issue type' }
    expect(mapRiderRpcError(error)).toBe('Invalid issue type')
  })

  it('maps KD403 unverified message clearly', () => {
    const error = { code: 'KD403', message: 'Rider is not verified or active' }
    expect(mapRiderRpcError(error)).toContain('not yet verified or has been suspended')
  })

  it('maps KD404 to not found message', () => {
    const error = { code: 'KD404', message: 'Delivery assignment not found' }
    expect(mapRiderRpcError(error)).toBe('Delivery assignment not found')
  })

  it('maps KD409 preparing order message to vendor preparation alert', () => {
    const error = {
      code: 'KD409',
      message: 'Cannot pick up food/grocery order in status preparing; still being prepared',
    }
    expect(mapRiderRpcError(error)).toContain('vendor is still preparing')
  })

  it('maps KD409 active delivery conflict message clearly', () => {
    const error = {
      code: 'KD409',
      message: 'Rider already has an active in-flight delivery',
    }
    expect(mapRiderRpcError(error)).toContain('already have an active delivery')
  })

  it('maps KD409 in-flight availability conflict message clearly', () => {
    const error = {
      code: 'KD409',
      message: 'Cannot become available while active delivery is in flight',
    }
    expect(mapRiderRpcError(error)).toContain('Cannot set status to available while an active delivery is currently in flight')
  })

  it('falls back to generic error message when error is unexpected or null', () => {
    expect(mapRiderRpcError(null)).toBe('An unexpected error occurred. Please retry.')
    expect(mapRiderRpcError(undefined)).toBe('An unexpected error occurred. Please retry.')
    expect(mapRiderRpcError('random string')).toBe('An unexpected error occurred. Please retry.')
    expect(mapRiderRpcError({ code: 'UNKNOWN_CODE', message: 'Custom network glitch' })).toBe(
      'Custom network glitch'
    )
  })
})
