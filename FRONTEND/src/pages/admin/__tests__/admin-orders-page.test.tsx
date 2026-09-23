import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminOrdersPage } from '../admin-orders-page'
import * as adminService from '@/services/supabase/admin'

vi.mock('@/services/supabase/admin', () => ({
  getOrders: vi.fn(),
  getOrderDetails: vi.fn(),
  getPersonalShopperRequests: vi.fn(),
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
      // Both orders should be listed in the table
      expect(screen.getByText(/KD-FD001/i)).toBeInTheDocument()
      expect(screen.getByText(/SHOP-DD0E15/i)).toBeInTheDocument()
      expect(screen.getByText('Bisi Johnson')).toBeInTheDocument()
      expect(screen.getByText('Akanbi Ibrahim')).toBeInTheDocument()
    })
  })

  it('opens operational dossier portal with full shopper details and does not hang on loading', async () => {
    render(
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/SHOP-DD0E15/i)).toBeInTheDocument()
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
    expect(overlay?.parentElement).toBe(document.body) // Rendered directly into document.body portal!
  })
})
