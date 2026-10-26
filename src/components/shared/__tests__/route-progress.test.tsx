import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { RoutePreloader } from '../route-progress'

describe('RoutePreloader Component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders full-screen preloader on route mount and unmounts after minDurationMs', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RoutePreloader minDurationMs={3000} />
      </MemoryRouter>
    )

    // Preloader status should be present immediately
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByAltText(/KingdomDash Logo/i)).toBeInTheDocument()

    // Fast forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Should disappear after 3 seconds
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show full-screen preloader on subsequent route transitions', () => {
    let navigateFn: (to: string) => void = () => {}

    function TestRouteTracker() {
      const navigate = useNavigate()
      navigateFn = navigate
      return <RoutePreloader minDurationMs={1000} />
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <TestRouteTracker />
      </MemoryRouter>
    )

    // Initially present
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Fast forward initial load
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // Navigate to /food
    act(() => {
      navigateFn('/food')
    })

    // Full screen preloader must NOT be shown
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // Modern top progress bar should be active
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
