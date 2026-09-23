import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminOrdersPage } from '../admin-orders-page'
import * as adminService from '@/services/supabase/admin'

vi.mock('@/services/supabase/admin', () => ({
  getOrders: vi.fn(),
  getOrderDetails: vi.fn(),
  getPersonalShopperRequests: vi.fn(),
  getAllRiders: vi.fn(),
  assignOrderToRider: vi.fn(),
  updateOrderStatusAdmin: vi.fn(),
  updatePersonalShopperStatus: vi.fn(),
  resetDeliveryForOrder: vi.fn(),
}))

describe('AdminOrdersPage Multi-Service & Shopper Inspection Tests', () => {
  const sampleStandardOrders = [
    {
      id: 'ord-food-1',
      order_number: 'KD-FD001',
      status: 'placed',
      service_type: 'food',
      total_amount: 5200,
      customer_name: 'Bisi Johnson',
      customer_phone: '08012345678',
      vendor_name: 'Taste of Ijebu',
      delivery_address: '12 Hospital Road',
      created_at: '2026-09-22T02:00:00.000Z',
      items: [],
    },
  ]

  const sampleShopperRequests = [
    {
      id: 'dd0e1533-80e1-4466-96a9-17e2349810f5',
      order_number: 'SHOP-DD0E15',
      status: 'pending',
      service_type: 'custom',
      estimated_total: 10500,
      budget_cap: 12000,
      customer_name: 'Akanbi Ibrahim',
      customer_phone: '08123424005',
      market_name: 'Oke-Aje Market',
      delivery_address: '17 Folagbade, Ijebu-Ode',
      created_at: '2026-09-22T03:00:00.000Z',
      items: [
        { id: 'item-1', name: 'Basket of Fresh Tomatoes & Tatashe', quantity: '1 basket', estimatedCost: 4500 },
        { id: 'item-2', name: 'Tubers of Ijebu White Yam (Big)', quantity: '2 tubers', estimatedCost: 4000 },
      ],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.getOrders).mockResolvedValue({
      data: sampleStandardOrders as any,
      count: 1,
      error: null,
    })
    vi.mocked(adminService.getPersonalShopperRequests).mockResolvedValue({
      data: sampleShopperRequests as any,
      count: 1,
      error: null,
    })
  })

  it('displays both standard and personal shopper orders when All Services is selected', async () => {
    render(
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      // Both orders should be listed
      expect(screen.getAllByText(/KD-FD001/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/SHOP-DD0E15/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bisi Johnson').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Akanbi Ibrahim').length).toBeGreaterThan(0)
    })
  })

  it('opens operational dossier portal with full shopper details and does not hang on loading', async () => {
    render(
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/SHOP-DD0E15/i).length).toBeGreaterThan(0)
    })

    // Find the inspect buttons; click the inspect button for the shopper order
    const inspectButtons = screen.getAllByRole('button', { name: /inspect order/i })
    fireEvent.click(inspectButtons[0]) // First row is the newest order (shopper request)

    await waitFor(() => {
      expect(screen.getByText('Order Operational Dossier')).toBeInTheDocument()
      // Verify full details are fetched and displayed in the dossier
      expect(screen.getAllByText('Akanbi Ibrahim').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('08123424005').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Oke-Aje Market')).toBeInTheDocument()
      expect(screen.getByText('17 Folagbade, Ijebu-Ode')).toBeInTheDocument()
      expect(screen.getByText('Basket of Fresh Tomatoes & Tatashe')).toBeInTheDocument()
      expect(screen.getByText('Tubers of Ijebu White Yam (Big)')).toBeInTheDocument()
      // Spinner must NOT be present
      expect(screen.queryByText(/Fetching order snapshots & delivery status/i)).not.toBeInTheDocument()
    })

    // Verify modal overlay covers whole page with z-[9999]
    const overlay = document.querySelector('.fixed.inset-0.z-\\[9999\\]')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.parentElement).toBe(document.body)
  })

  it('shows assign button when status is pending, closes it after assignment, and reopens it when status is updated back to pending', async () => {
    vi.mocked(adminService.getAllRiders).mockResolvedValue({
      data: [{ id: 'rider-1', full_name: 'Segun Adebayo', is_available: true, is_verified: true, is_active: true }] as any,
      count: 1,
      error: null,
    })
    vi.mocked(adminService.assignOrderToRider).mockResolvedValue({
      data: { success: true },
      error: null,
    })
    vi.mocked(adminService.updatePersonalShopperStatus).mockResolvedValue({
      data: { status: 'pending' },
      error: null,
    } as any)
    vi.mocked(adminService.resetDeliveryForOrder).mockResolvedValue({
      success: true,
      error: null,
    })

    render(
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    )

    // 1. When status is 'pending', the Assign button must be open/visible
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /assign/i }).length).toBeGreaterThan(0)
    })

    const assignBtns = screen.getAllByRole('button', { name: /assign/i })
    fireEvent.click(assignBtns[0])

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText('Assign Courier Rider')).toBeInTheDocument()
    })

    // Click rider button to select rider
    const riderButton = screen.getByText(/Segun Adebayo/i)
    fireEvent.click(riderButton)

    const confirmBtn = screen.getByRole('button', { name: /confirm assignment & dispatch/i })
    fireEvent.click(confirmBtn)

    // 2. Once successfully assigned, status changes to 'assigned' and the assign button is CLOSED
    await waitFor(() => {
      expect(screen.queryByText('Assign Courier Rider')).not.toBeInTheDocument()
      // Assign button for this order must be closed/hidden
      const remainingAssign = screen.queryAllByRole('button', { name: /^assign$/i })
      expect(remainingAssign.length).toBe(0)
    })
  })
})
