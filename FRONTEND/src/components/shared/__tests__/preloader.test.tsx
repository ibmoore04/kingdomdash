import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Preloader } from '../preloader'

describe('Preloader Component', () => {
  it('renders floatingCircle variant with accessibility role and status', () => {
    render(<Preloader variant="floatingCircle" />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toBeInTheDocument()
    expect(statusElement).toHaveAttribute('aria-label', 'Loading KingdomDash')
    expect(screen.getByAltText(/KingdomDash Logo/i)).toBeInTheDocument()
  })

  it('renders fullScreen variant with tagline and message', () => {
    render(<Preloader variant="fullScreen" message="Fetching your orders..." />)

    expect(screen.getByText('Fetching your orders...')).toBeInTheDocument()
    expect(screen.getByText(/SWIFT IN MOTION/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Fetching your orders...')
  })

  it('renders inline container variant when fullScreen is false', () => {
    const { container } = render(<Preloader fullScreen={false} className="custom-class" />)

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveClass('custom-class')
    expect(statusElement).not.toHaveClass('fixed')
    expect(container.querySelector('img')).toBeInTheDocument()
  })

  it('renders different size variants correctly', () => {
    render(<Preloader size="sm" />)

    expect(screen.getByAltText(/KingdomDash Logo/i)).toBeInTheDocument()
  })
})
