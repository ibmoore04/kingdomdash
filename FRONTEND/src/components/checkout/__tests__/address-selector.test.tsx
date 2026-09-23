import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AddressSelector } from '../address-selector'
import type { Address } from '@/types'

const mockAddresses: Address[] = [
  {
    id: 'addr-1',
    profile_id: 'user-1',
    label: 'Home',
    recipient_name: 'Adeola Adeleke',
    phone: '08012345678',
    address_line_1: '14 Stadium Road',
    address_line_2: 'Flat 2B',
    city: 'Ijebu-Ode',
    state: 'Ogun State',
    postal_code: '120101',
    latitude: 6.820556,
    longitude: 3.920833,
    service_area_id: null,
    is_default: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'addr-2',
    profile_id: 'user-1',
    label: 'Office',
    recipient_name: 'Adeola Adeleke',
    phone: '08098765432',
    address_line_1: '5 Ibadan Road',
    address_line_2: null,
    city: 'Ijebu-Ode',
    state: 'Ogun State',
    postal_code: null,
    latitude: null,
    longitude: null,
    service_area_id: null,
    is_default: false,
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
  },
]

describe('AddressSelector component', () => {
  it('renders empty state when no addresses exist', () => {
    render(
      <AddressSelector
        addresses={[]}
        selectedAddressId={null}
        onSelectAddress={vi.fn()}
        onAddressCreated={vi.fn()}
      />
    )

    expect(screen.getByText(/No saved addresses found/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Add Delivery Address/i })).toBeDefined()
  })

  it('renders list of addresses and marks default badge', () => {
    render(
      <AddressSelector
        addresses={mockAddresses}
        selectedAddressId="addr-1"
        onSelectAddress={vi.fn()}
        onAddressCreated={vi.fn()}
      />
    )

    expect(screen.getByText('Home')).toBeDefined()
    expect(screen.getByText('Office')).toBeDefined()
    expect(screen.getByText('Default')).toBeDefined()
    expect(screen.getByText(/14 Stadium Road/i)).toBeDefined()
    expect(screen.getByText(/5 Ibadan Road/i)).toBeDefined()
  })

  it('selects address on click', () => {
    const onSelect = vi.fn()
    render(
      <AddressSelector
        addresses={mockAddresses}
        selectedAddressId="addr-1"
        onSelectAddress={onSelect}
        onAddressCreated={vi.fn()}
      />
    )

    const officeRadio = screen.getByText('Office').closest('[role="radio"]')!
    fireEvent.click(officeRadio)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(mockAddresses[1])
  })

  it('selects address on Enter key press', () => {
    const onSelect = vi.fn()
    render(
      <AddressSelector
        addresses={mockAddresses}
        selectedAddressId="addr-1"
        onSelectAddress={onSelect}
        onAddressCreated={vi.fn()}
      />
    )

    const officeRadio = screen.getByText('Office').closest('[role="radio"]')!
    fireEvent.keyDown(officeRadio, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(mockAddresses[1])
  })

  it('opens address form modal on clicking Add New', () => {
    render(
      <AddressSelector
        addresses={mockAddresses}
        selectedAddressId="addr-1"
        onSelectAddress={vi.fn()}
        onAddressCreated={vi.fn()}
      />
    )

    const addBtn = screen.getByRole('button', { name: /Add New/i })
    fireEvent.click(addBtn)

    expect(screen.getByText('Add New Delivery Address')).toBeDefined()
    expect(screen.getByLabelText(/Address Label/i)).toBeDefined()
  })
})
