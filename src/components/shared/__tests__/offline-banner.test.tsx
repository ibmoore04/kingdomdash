import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineBanner } from '../offline-banner'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { renderHook } from '@testing-library/react'

describe('Offline Connectivity Status Banner (FLAW-05)', () => {
  const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine)
    }
  })

  it('useOnlineStatus hook tracks online and offline browser events correctly', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(typeof result.current).toBe('boolean')

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)
  })

  it('OfflineBanner does not render when online', () => {
    const { container } = render(<OfflineBanner />)
    // When online, nothing is rendered
    expect(container.firstChild).toBeNull()
  })

  it('OfflineBanner renders sticky notification banner when browser goes offline', () => {
    render(<OfflineBanner />)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
