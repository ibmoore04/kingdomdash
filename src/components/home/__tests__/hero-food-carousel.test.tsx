import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HeroFoodCarousel } from '../hero-food-carousel'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('HeroFoodCarousel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })
  })

  it('renders with curated vendor food items by default', () => {
    render(
      <MemoryRouter>
        <HeroFoodCarousel />
      </MemoryRouter>
    )

    // Jollof Rice from Chicken & Co should be visible initially
    expect(screen.getByText('Jollof Rice')).toBeInTheDocument()
    expect(screen.getByText('Chicken & Co')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /order now/i })).toHaveAttribute('href', '/food')
  })

  it('cycles to the next food dish when clicking the next arrow button', () => {
    render(
      <MemoryRouter>
        <HeroFoodCarousel />
      </MemoryRouter>
    )

    const nextBtn = screen.getByRole('button', { name: /next food dish/i })
    fireEvent.click(nextBtn)

    // Second dish Shawarma & BBQ Wings should become active
    expect(screen.getByText(/Shawarma & BBQ Wings/i)).toBeInTheDocument()
    expect(screen.getByText('Chicken & Co')).toBeInTheDocument()
  })

  it('cycles back to previous dish when clicking previous arrow button', () => {
    render(
      <MemoryRouter>
        <HeroFoodCarousel />
      </MemoryRouter>
    )

    const prevBtn = screen.getByRole('button', { name: /previous food dish/i })
    fireEvent.click(prevBtn)

    // Last dish should become active
    expect(screen.getByText(/Crusty Meat Pies & Pastries/i)).toBeInTheDocument()
  })

  it('switches directly to a dish when clicking a story progress bar or thumbnail', () => {
    render(
      <MemoryRouter>
        <HeroFoodCarousel />
      </MemoryRouter>
    )

    const egusiBtn = screen.getByRole('button', { name: /show pounded yam/i })
    fireEvent.click(egusiBtn)

    expect(screen.getByText(/Pounded Yam & Egusi Feast/i)).toBeInTheDocument()
  })

  it('incorporates live scanned products from database when available', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'prod-live-1',
                name: 'Suya Peppered Goat Meat',
                description: 'Hot spicy tender goat suya bites',
                price: 3500,
                image_url: null,
                vendor_id: 'v-1',
                vendors: { id: 'v-1', business_name: 'Suya Palace' },
              },
            ],
            error: null,
          }),
        }),
      }),
    })

    render(
      <MemoryRouter>
        <HeroFoodCarousel />
      </MemoryRouter>
    )

    // Switch to the live scanned Suya dish
    await waitFor(() => {
      const suyaBtn = screen.getByRole('button', { name: /show suya peppered/i })
      expect(suyaBtn).toBeInTheDocument()
      fireEvent.click(suyaBtn)
    })

    expect(screen.getByText('Suya Peppered Goat Meat')).toBeInTheDocument()
    expect(screen.getByText('Suya Palace')).toBeInTheDocument()
  })
})
