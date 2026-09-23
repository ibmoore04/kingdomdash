import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PersonalShopperPage from '../personal-shopper'

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

    expect(screen.getByText('Basket of Fresh Tomatoes & Tatashe')).toBeInTheDocument()
    const removeBtn = screen.getByLabelText(/Remove Basket of Fresh Tomatoes & Tatashe/i)
    fireEvent.click(removeBtn)

    expect(screen.queryByText('Basket of Fresh Tomatoes & Tatashe')).not.toBeInTheDocument()
  })
})
