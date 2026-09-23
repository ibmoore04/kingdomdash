import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RiderHistoryPage from '../history'
import * as historyService from '@/services/rider/history-service'
import * as custodyService from '@/services/rider/custody-service'
import type { CompletedDeliveryHistoryItem } from '@/types/rider'

const mockRider = {
  id: 'rider-123',
  profile_id: 'user-456',
  vehicle_type: 'motorcycle' as const,
  rating: 4.9,
  total_deliveries: 12,
  is_available: true,
  is_verified: true,
  is_active: true,
  full_name: 'David Adebayo',
}

vi.mock('@/hooks/use-current-rider', () => ({
  useCurrentRider: () => ({
    rider: mockRider,
    isLoading: false,
    isPendingApproval: false,
    refreshRider: vi.fn(),
  }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-456', email: 'david.adebayo@example.com' },
    profile: { id: 'user-456', role: 'rider', full_name: 'David Adebayo' },
    signOut: vi.fn(),
  }),
}))

const nowIso = new Date().toISOString()
const mockItems: CompletedDeliveryHistoryItem[] = [
  {
    assignment_id: 'assign-1',
    delivery_id: 'del-001-abc',
    order_id: 'ord-101',
    service_type: 'food',
    vendor_name: 'Golden Pot Restaurant',
    pickup_area: 'Fusigboye, Ijebu-Ode',
    delivery_area: 'GRA, Ijebu-Ode',
    delivered_at: nowIso,
    assignment_status: 'completed',
    delivery_status: 'delivered',
    earnings_amount: 850,
  },
  {
    assignment_id: 'assign-2',
    delivery_id: 'del-002-xyz',
    order_id: 'ord-102',
    service_type: 'courier',
    vendor_name: 'Direct Package Dispatch',
    pickup_area: 'Oke-Aje Market',
    delivery_area: 'Igbeba',
    delivered_at: nowIso,
    assignment_status: 'completed',
    delivery_status: 'delivered',
    earnings_amount: 900,
  },
]

describe('RiderHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(custodyService, 'getRiderActiveDelivery').mockResolvedValue({
      data: null,
      error: null,
    })
  })

  it('renders history page and calculates daily & weekly totals correctly', async () => {
    vi.spyOn(historyService, 'getRiderDeliveryHistory').mockResolvedValue({
      data: mockItems,
      error: null,
    })

    render(
      <BrowserRouter>
        <RiderHistoryPage />
      </BrowserRouter>
    )

    // Heading check
    expect(screen.getByText(/Trip History & Earnings/i)).toBeInTheDocument()

    // Wait for data
    await waitFor(() => {
      expect(screen.getByText('Golden Pot Restaurant')).toBeInTheDocument()
      expect(screen.getByText('Direct Package Dispatch')).toBeInTheDocument()
    })

    // Stat cards: Total = 850 + 900 = 1,750
    expect(screen.getByText(/Today's Earnings/i)).toBeInTheDocument()
    expect(screen.getByText(/Last 7 Days/i)).toBeInTheDocument()
    expect(screen.getAllByText(/₦1,750/).length).toBeGreaterThan(0)

    // Check payout badges
    expect(screen.getByText('+₦850')).toBeInTheDocument()
    expect(screen.getByText('+₦900')).toBeInTheDocument()
  })

  it('filters trips by service type tab', async () => {
    vi.spyOn(historyService, 'getRiderDeliveryHistory').mockResolvedValue({
      data: mockItems,
      error: null,
    })

    render(
      <BrowserRouter>
        <RiderHistoryPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Golden Pot Restaurant')).toBeInTheDocument()
    })

    // Click 'Courier' filter
    const courierTab = screen.getByRole('button', { name: /^courier$/i })
    fireEvent.click(courierTab)

    expect(screen.queryByText('Golden Pot Restaurant')).not.toBeInTheDocument()
    expect(screen.getByText('Direct Package Dispatch')).toBeInTheDocument()
  })
})
