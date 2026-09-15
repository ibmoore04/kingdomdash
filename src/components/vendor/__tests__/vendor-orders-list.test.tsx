import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { VendorOrdersList } from '@/components/vendor/VendorOrdersList'
import * as ordersService from '@/services/supabase/orders'

vi.mock('@/services/supabase/orders', () => ({
  getOrdersByVendor: vi.fn(),
  updateOrderStatusVendor: vi.fn(),
  vendorRejectOrder: vi.fn(),
}))

const mockOrders = [
  {
    id: 'order-1234-abcd',
    customer_id: 'cust-1',
    service_type: 'food',
    status: 'payment_confirmed',
    subtotal: 4500,
    delivery_fee: 500,
    total: 5000,
    pickup_address: '14 Hospital Road, Ijebu-Ode',
    delivery_address: '22 Folagbade Street, Ijebu-Ode',
    special_instructions: 'Extra pepper sauce please',
    created_at: '2026-09-06T08:00:00Z',
    order_items: [
      {
        id: 'item-1',
        product_name: 'Jollof Rice & Chicken',
        quantity: 2,
        unit_price: 2250,
        line_total: 4500,
      },
    ],
  },
  {
    id: 'order-5678-efgh',
    customer_id: 'cust-2',
    service_type: 'food',
    status: 'preparing',
    subtotal: 3000,
    delivery_fee: 600,
    total: 3600,
    pickup_address: '14 Hospital Road, Ijebu-Ode',
    delivery_address: '5 Obalende Road, Ijebu-Ode',
    created_at: '2026-09-06T08:15:00Z',
    order_items: [
      {
        id: 'item-2',
        product_name: 'Egusi Soup with Pounded Yam',
        quantity: 1,
        unit_price: 3000,
        line_total: 3000,
      },
    ],
  },
  {
    id: 'order-9999-ijkl',
    customer_id: 'cust-3',
    service_type: 'food',
    status: 'ready_for_pickup',
    subtotal: 2000,
    delivery_fee: 500,
    total: 2500,
    pickup_address: '14 Hospital Road, Ijebu-Ode',
    delivery_address: '10 Degun Street, Ijebu-Ode',
    created_at: '2026-09-06T08:20:00Z',
    order_items: [
      {
        id: 'item-3',
        product_name: 'Fried Rice',
        quantity: 1,
        unit_price: 2000,
        line_total: 2000,
      },
    ],
  },
]

describe('VendorOrdersList Component (Phase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(ordersService.getOrdersByVendor).mockResolvedValue({
      data: mockOrders,
      error: null,
    })
    vi.mocked(ordersService.updateOrderStatusVendor).mockResolvedValue({
      data: null,
      error: null,
    })
    vi.mocked(ordersService.vendorRejectOrder).mockResolvedValue({
      data: null,
      error: null,
    })
  })

  it('renders orders list and order items correctly', async () => {
    render(<VendorOrdersList vendorId="vendor-1" />)

    await waitFor(() => {
      expect(screen.getByText(/#order-12/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Jollof Rice & Chicken')).toBeInTheDocument()
    expect(screen.getByText('2x')).toBeInTheDocument()
    expect(screen.getByText(/Extra pepper sauce please/i)).toBeInTheDocument()
  })

  it('allows vendor to accept order and start preparation', async () => {
    render(<VendorOrdersList vendorId="vendor-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Accept & Start Preparing/i)).toBeInTheDocument()
    })

    const acceptBtn = screen.getByText(/Accept & Start Preparing/i)
    fireEvent.click(acceptBtn)

    await waitFor(() => {
      expect(ordersService.updateOrderStatusVendor).toHaveBeenCalledWith(
        'order-1234-abcd',
        'preparing'
      )
    })
  })

  it('allows vendor to mark preparing order as ready for pickup', async () => {
    render(<VendorOrdersList vendorId="vendor-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Mark Ready for Pickup/i)).toBeInTheDocument()
    })

    const readyBtn = screen.getByText(/Mark Ready for Pickup/i)
    fireEvent.click(readyBtn)

    await waitFor(() => {
      expect(ordersService.updateOrderStatusVendor).toHaveBeenCalledWith(
        'order-5678-efgh',
        'ready_for_pickup'
      )
    })
  })

  it('displays ready badge when viewing ready tab', async () => {
    render(<VendorOrdersList vendorId="vendor-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Ready for Pickup/i)).toBeInTheDocument()
    })

    const readyTab = screen.getByTestId('filter-tab-ready')
    fireEvent.click(readyTab)

    expect(screen.getByText(/Ready for Rider Pickup/i)).toBeInTheDocument()
  })

  it('allows vendor to reject an order with a reason', async () => {
    render(<VendorOrdersList vendorId="vendor-1" />)

    await waitFor(() => {
      expect(screen.getByText(/Reject Order/i)).toBeInTheDocument()
    })

    const rejectBtn = screen.getByText(/Reject Order/i)
    fireEvent.click(rejectBtn)

    expect(screen.getByRole('heading', { name: /Reject Order/i })).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/Item out of stock/i)
    fireEvent.change(textarea, { target: { value: 'Kitchen closed for the day' } })

    const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(ordersService.vendorRejectOrder).toHaveBeenCalledWith(
        'order-1234-abcd',
        'Kitchen closed for the day'
      )
    })
  })
})
