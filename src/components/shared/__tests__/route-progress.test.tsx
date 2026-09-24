import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
})
