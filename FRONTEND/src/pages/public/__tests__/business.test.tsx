import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BusinessPage from '../business'

describe('BusinessPage', () => {
  it('renders enterprise headline and calculator', () => {
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Scale Your Business Deliveries in Ijebu-Ode/i)).toBeInTheDocument()
    expect(screen.getByText(/Corporate Rate & Savings Calculator/i)).toBeInTheDocument()
    expect(screen.getByText(/Open a Business Account/i)).toBeInTheDocument()
  })

  it('updates discount and monthly savings when clicking a volume tier', () => {
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>
    )

    // Click 400+ tier
    const topTierButton = screen.getByText('400+')
    fireEvent.click(topTierButton)

    expect(screen.getAllByText(/32% Off/i).length).toBeGreaterThanOrEqual(1)
  })

  it('validates required fields on business inquiry form', () => {
    render(
      <MemoryRouter>
        <BusinessPage />
      </MemoryRouter>
    )

    const submitBtn = screen.getByText(/Request Corporate Account/i)
    fireEvent.click(submitBtn)

    // Ensure form is still on the screen (not submitted without inputs)
    expect(screen.getByText(/Open a Business Account/i)).toBeInTheDocument()
  })
})
