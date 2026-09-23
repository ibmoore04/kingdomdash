import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CheckoutPage from '../checkout'
import { useCartStore, type CartVendor } from '@/stores/cart-store'
import * as addressService from '@/services/supabase/addresses'
import * as orderService from '@/services/supabase/orders'
import { getDeliveryFeePreview } from '@/services/supabase/pricing'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/services/supabase/pricing', () => ({
  getDeliveryFeePreview: vi.fn(),
}))

vi.mock('@/services/paystack/paystack', () => ({
  initializePaystackPayment: vi.fn().mockRejectedValue(new Error('Gateway redirect mock')),
}))

vi.mock('@/services/supabase/addresses', () => ({
  getCustomerAddresses: vi.fn(),
  createCustomerAddress: vi.fn(),
  updateCustomerAddress: vi.fn(),
  deleteCustomerAddress: vi.fn(),
}))

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-uuid-1' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { latitude: 6.820556, longitude: 3.920833 },
            error: null,
          }),
        })),
      })),
    })),
    rpc: vi.fn(),
  },
}))

const mockVendor: CartVendor = {
  id: 'vendor-uuid-1',
  name: 'Bisi Eatery',
  address: '22 Molipa Expressway, Ijebu-Ode',
  serviceType: 'food',
  latitude: 6.820556,
  longitude: 3.920833,
}

const mockAddress = {
  id: 'addr-uuid-1',
  profile_id: 'user-uuid-1',
  label: 'Home',
  recipient_name: 'Adeola Adeleke',
  phone: '08012345678',
  address_line_1: '14 Stadium Road',
  address_line_2: 'Flat 2B',
  city: 'Ijebu-Ode',
  state: 'Ogun State',
  postal_code: '120101',
  is_default: true,
  latitude: 6.820556,
  longitude: 3.920833,
  service_area_id: 'area-uuid-1',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    mockNavigate.mockClear()
    vi.clearAllMocks()

    vi.mocked(addressService.getCustomerAddresses).mockResolvedValue({
      data: [mockAddress],
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(getDeliveryFeePreview).mockResolvedValue({
      data: {
        is_serviceable: true,
        distance_km: 3.5,
        base_fee: 500,
        distance_rate: 100,
        min_fee: null,
        max_fee: null,
        raw_fee: 850,
        delivery_fee: 850,
        pricing_tier: 4,
        pricing_rule_id: 'rule-uuid-1',
        service_area_id: 'area-uuid-1',
        service_area_name: 'Ijebu-Ode Central',
      },
      error: null,
    })
  })

  it('renders empty cart view when cart has no items', () => {
    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Your cart is empty')).toBeDefined()
    expect(screen.getByText(/There are no items in your cart to checkout/i)).toBeDefined()
  })

  it('renders items review, delivery address, and distance delivery fee when cart has items', async () => {
    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Checkout & Order Review')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText('Egusi with Pounded Yam')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText('Bisi Eatery')).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getByText(/14 Stadium Road/)).toBeDefined()
    })
    await waitFor(() => {
      expect(screen.getAllByText(/850/).length).toBeGreaterThan(0)
    })
  })

  it('successfully invokes createOrderSecure with deliveryAddressId, clears cart, and navigates', async () => {
    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    const createOrderSpy = vi.spyOn(orderService, 'createOrderSecure').mockResolvedValue({
      data: 'order-uuid-999',
      error: null,
    })

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    // Wait until pricing resolves and button becomes enabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Place Order/i })
      expect(btn.hasAttribute('disabled')).toBe(false)
    })

    const policyCheckbox = screen.getByLabelText(/Accept Cancellation and Refund Policy/i)
    fireEvent.click(policyCheckbox)

    const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })
    fireEvent.click(placeOrderBtn)

    await waitFor(() => {
      expect(createOrderSpy).toHaveBeenCalledTimes(1)
      expect(createOrderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: mockVendor.id,
          serviceType: 'food',
          pickupAddress: mockVendor.address,
          deliveryAddressId: 'addr-uuid-1',
          items: [{ product_id: 'prod-item-1', quantity: 1 }],
        })
      )
      // Cart must be cleared upon success
      expect(useCartStore.getState().items).toHaveLength(0)
      // Navigate to confirmation page
      expect(mockNavigate).toHaveBeenCalledWith('/order/order-uuid-999/confirmation')
    })
  })

  it('requires accepting the Cancellation and Refund Policy before placing order', async () => {
    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    const createOrderSpy = vi.spyOn(orderService, 'createOrderSecure')

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Place Order/i })
      expect(btn.hasAttribute('disabled')).toBe(false)
    })

    const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })
    fireEvent.click(placeOrderBtn)

    await waitFor(() => {
      expect(screen.getByText(/Please accept the Cancellation and Refund Policy/i)).toBeInTheDocument()
      expect(createOrderSpy).not.toHaveBeenCalled()
    })
  })

  it('preserves cart and displays error when createOrderSecure fails', async () => {
    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    vi.spyOn(orderService, 'createOrderSecure').mockResolvedValue({
      data: null,
      error: { message: 'Product is currently unavailable' },
    })

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    // Wait until button becomes enabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Place Order/i })
      expect(btn.hasAttribute('disabled')).toBe(false)
    })

    const policyCheckbox = screen.getByLabelText(/Accept Cancellation and Refund Policy/i)
    fireEvent.click(policyCheckbox)

    const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })
    fireEvent.click(placeOrderBtn)

    await waitFor(() => {
      expect(screen.getByText('Product is currently unavailable')).toBeDefined()
      // Cart MUST NOT be cleared
      expect(useCartStore.getState().items).toHaveLength(1)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('disables order submission and warns user when address is unpinned', async () => {
    const unpinnedAddress = {
      ...mockAddress,
      latitude: null,
      longitude: null,
    }

    vi.spyOn(addressService, 'getCustomerAddresses').mockResolvedValue({
      data: [unpinnedAddress],
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Please pin your delivery location on the map/i)).toBeDefined()
      const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })
      expect(placeOrderBtn.hasAttribute('disabled')).toBe(true)
    })
  })

  it('disables order submission and warns user when address is outside service area', async () => {
    vi.mocked(getDeliveryFeePreview).mockResolvedValue({
      data: {
        is_serviceable: false,
        distance_km: 18.5,
        delivery_fee: null,
        error: 'Delivery address is outside the active service area',
        service_area_name: 'Ijebu-Ode Central',
      },
      error: null,
    })

    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Deliveries outside this active zone cannot be processed/i)).toBeDefined()
      const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })
      expect(placeOrderBtn.hasAttribute('disabled')).toBe(true)
    }, { timeout: 10000 })
  })

  it('prevents duplicate payment clicks when user rapidly clicks the place order button', async () => {
    useCartStore.getState().addItem(
      {
        productId: 'prod-item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Egusi with Pounded Yam',
        price: 2800,
        imageUrl: null,
      },
      mockVendor
    )

    // Simulate delay in createOrderSecure to test duplicate clicking
    let resolveOrder: (val: unknown) => void
    const createOrderPromise = new Promise((resolve) => {
      resolveOrder = resolve
    })

    const createOrderSpy = vi.spyOn(orderService, 'createOrderSecure').mockImplementation(
      () => createOrderPromise as Promise<{ data: string; error: null }>
    )

    render(
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Place Order/i })
      expect(btn.hasAttribute('disabled')).toBe(false)
    })

    const policyCheckbox = screen.getByLabelText(/Accept Cancellation and Refund Policy/i)
    fireEvent.click(policyCheckbox)

    const placeOrderBtn = screen.getByRole('button', { name: /Place Order/i })

    // First click
    fireEvent.click(placeOrderBtn)
    // Rapid immediate second click
    fireEvent.click(placeOrderBtn)
    // Third rapid click
    fireEvent.click(placeOrderBtn)

    // Should only be called once because duplicate prevention blocks re-entry
    expect(createOrderSpy).toHaveBeenCalledTimes(1)

    // Resolve order creation
    resolveOrder!({ data: 'order-uuid-double-click', error: null })
  })
})

