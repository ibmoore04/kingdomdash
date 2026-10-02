import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PersonalShopperPage from '../personal-shopper'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: 'mock-shopper-id-123',
      error: null,
    }),
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          order_id: 'mock-order-id-456',
          orders: {
            id: 'mock-order-id-456',
            delivery_pin: '7412',
          },
        },
        error: null,
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'mock-order-id-456', delivery_pin: '7412' },
            error: null,
          }),
        }),
      }),
    })),
  },
}))

describe('PersonalShopperPage', () => {
  it('renders market selection and default shopping checklist', () => {
    render(
      <MemoryRouter>
        <PersonalShopperPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/We Do Your Market Run in Ijebu-Ode/i)).toBeInTheDocument()
    expect(screen.getByText('Oke-Aje Market')).toBeInTheDocument()
    expect(screen.getByText('Ita Osu Market')).toBeInTheDocument()
    expect(screen.getByText(/Transparent Concierge Cost/i)).toBeInTheDocument()
  })

  it('allows adding custom items to the shopping checklist', () => {
    render(
      <MemoryRouter>
        <PersonalShopperPage />
      </MemoryRouter>
    )

    const inputName = screen.getByPlaceholderText(/Item name \(e\.g\. Medium Titus Fish\)/i)
    const addBtn = screen.getByRole('button', { name: /Add Item/i })

    fireEvent.change(inputName, { target: { value: 'Fresh Ewedu Leaves' } })
    fireEvent.click(addBtn)

    expect(screen.getByText('Fresh Ewedu Leaves')).toBeInTheDocument()
  })

  it('allows removing an item from the shopping checklist', () => {
    render(
      <MemoryRouter>
        <PersonalShopperPage />
      </MemoryRouter>
    )

    const inputName = screen.getByPlaceholderText(/Item name \(e\.g\. Medium Titus Fish\)/i)
    const addBtn = screen.getByRole('button', { name: /Add Item/i })

    fireEvent.change(inputName, { target: { value: 'Basket of Fresh Tomatoes & Tatashe' } })
    fireEvent.click(addBtn)
    expect(screen.getByText('Basket of Fresh Tomatoes & Tatashe')).toBeInTheDocument()
    const removeBtn = screen.getByLabelText(/Remove Basket of Fresh Tomatoes & Tatashe/i)
    fireEvent.click(removeBtn)

    expect(screen.queryByText('Basket of Fresh Tomatoes & Tatashe')).not.toBeInTheDocument()
  })

  it('displays the Delivery Confirmation PIN and tracking link once the concierge order is placed', async () => {
    render(
      <MemoryRouter>
        <PersonalShopperPage />
      </MemoryRouter>
    )

    // Add an item first
    const inputName = screen.getByPlaceholderText(/Item name \(e\.g\. Medium Titus Fish\)/i)
    const addBtn = screen.getByRole('button', { name: /Add Item/i })
    fireEvent.change(inputName, { target: { value: 'Ijebu Gari' } })
    fireEvent.click(addBtn)

    // Fill delivery form
    fireEvent.change(screen.getByPlaceholderText(/Ronke Adebayo/i), { target: { value: 'Ronke Adebayo' } })
    fireEvent.change(screen.getByPlaceholderText(/08012345678/i), { target: { value: '08012345678' } })
    fireEvent.change(screen.getByPlaceholderText(/Igbeba Road/i), { target: { value: '14 Hospital Road, Ijebu-Ode' } })

    const orderBtn = screen.getByRole('button', { name: /Send Personal Shopper/i })
    fireEvent.click(orderBtn)

    expect(await screen.findByText(/Market Run Initiated!/i)).toBeInTheDocument()
    expect(screen.getByText('7412')).toBeInTheDocument()
    expect(screen.getByText(/Delivery Confirmation PIN/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Track Run Live/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /My Orders/i })).toBeInTheDocument()
    expect(screen.getByText(/Start Another Run/i)).toBeInTheDocument()
  })
})


