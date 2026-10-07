import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  TrustBadgePill,
  TrustBadgeRow,
  EnterpriseTrustBanner,
} from '@/components/shared/trust-badges'
import { RiderTipSelector } from '@/components/checkout/rider-tip-selector'
import { OrderReceiptModal } from '@/components/order/order-receipt-modal'
import { QuickReorderBar } from '@/components/customer/quick-reorder-bar'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore } from '@/stores/cart-store'
import * as ordersService from '@/services/supabase/orders'

// Mock orders service
vi.mock('@/services/supabase/orders', () => ({
  getOrdersByCustomer: vi.fn(),
  getOrderById: vi.fn(),
}))

describe('Phase 2: Trust, Conversion & Reordering Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCartStore.getState().clearCart()
  })

  describe('Enterprise Trust Badges', () => {
    it('renders TrustBadgePill with shortLabel and appropriate title tooltip', () => {
      render(<TrustBadgePill type="verified_partner" />)
      expect(screen.getByText('Verified Partner')).toBeInTheDocument()
    })

    it('renders TrustBadgeRow with requested badges', () => {
      render(
        <TrustBadgeRow
          badges={['verified_partner', 'hygiene_inspected', 'money_back']}
        />
      )
      expect(screen.getByText('Verified Campus Partner')).toBeInTheDocument()
      expect(screen.getByText('Hygiene Inspected')).toBeInTheDocument()
      expect(screen.getByText('100% Freshness Guarantee')).toBeInTheDocument()
    })

    it('renders EnterpriseTrustBanner with buyer protection reassurance', () => {
      render(<EnterpriseTrustBanner />)
      expect(
        screen.getByText(/KingdomDash Buyer Protection & Food Quality Standard/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/100% Verified Kitchens/i)).toBeInTheDocument()
    })
  })

  describe('Rider Tip Selector Component', () => {
    it('renders preset options and triggers onSelectTip on click', () => {
      const onSelectTip = vi.fn()
      render(<RiderTipSelector selectedTip={0} onSelectTip={onSelectTip} />)

      expect(screen.getByText('Support Your Delivery Rider')).toBeInTheDocument()
      expect(screen.getByText('100% to Rider')).toBeInTheDocument()

      const tip500 = screen.getByText('₦500')
      fireEvent.click(tip500)
      expect(onSelectTip).toHaveBeenCalledWith(500)
    })

    it('allows entering a custom tip amount', () => {
      const onSelectTip = vi.fn()
      render(<RiderTipSelector selectedTip={0} onSelectTip={onSelectTip} />)

      const customBtn = screen.getByText('Custom')
      fireEvent.click(customBtn)

      const input = screen.getByPlaceholderText(/Enter custom tip/i)
      fireEvent.change(input, { target: { value: '750' } })

      expect(onSelectTip).toHaveBeenCalledWith(750)
    })
  })

  describe('Order Receipt Modal Component', () => {
    const mockOrder = {
      id: 'ord-12345678-abcd',
      customer_id: 'cust-1',
      status: 'payment_confirmed',
      subtotal: 5000,
      delivery_fee: 500,
      total: 5650,
      service_type: 'food' as const,
      pickup_address: 'Reigneth Bakery, Ijebu-Ode',
      delivery_address: '14 TASUED Campus Gate, Ijagun',
      created_at: new Date('2026-10-05T12:00:00Z').toISOString(),
      order_items: [
        {
          id: 'item-1',
          order_id: 'ord-12345678-abcd',
          product_id: 'prod-1',
          product_name: 'Jollof Rice Combo',
          quantity: 2,
          unit_price: 2500,
          line_total: 5000,
        },
      ],
      vendors: {
        business_name: 'Reigneth Bakery & Kitchen',
      },
    }

    it('renders itemized breakdown and print/whatsapp buttons when open', () => {
      const onClose = vi.fn()
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

      render(
        <OrderReceiptModal
          isOpen={true}
          onClose={onClose}
          order={mockOrder as any}
          riderTip={150}
        />
      )

      expect(screen.getByText('Official Tax & Delivery Receipt')).toBeInTheDocument()
      expect(screen.getByText(/Reigneth Bakery & Kitchen/i)).toBeInTheDocument()
      expect(screen.getByText(/Jollof Rice Combo/i)).toBeInTheDocument()
      expect(screen.getByText(/Rider Appreciation Tip/i)).toBeInTheDocument()

      const printBtn = screen.getByText('Print / PDF')
      fireEvent.click(printBtn)
      expect(printSpy).toHaveBeenCalled()
      printSpy.mockRestore()
    })

    it('does not render when isOpen is false', () => {
      render(
        <OrderReceiptModal
          isOpen={false}
          onClose={vi.fn()}
          order={mockOrder as any}
        />
      )
      expect(screen.queryByText('Official Tax & Delivery Receipt')).not.toBeInTheDocument()
    })
  })

  describe('QuickReorderBar Component', () => {
    it('renders returning customer past order and populates cart on 1-click reorder', async () => {
      // Authenticate mock user
      useAuthStore.setState({
        session: { user: { id: 'cust-uuid-1', email: 'test@kingdomdash.com' } } as any,
        profile: { id: 'cust-uuid-1', role: 'customer' } as any,
      })

      const mockPastOrders = [
        {
          id: 'order-recent-1',
          created_at: new Date().toISOString(),
          status: 'delivered',
          total: 4500,
          vendor_id: 'vendor-1',
          service_type: 'food' as const,
          pickup_address: 'Campus Cafeteria, Ijebu-Ode',
          vendors: {
            id: 'vendor-1',
            business_name: 'Campus Cafeteria',
          },
          order_items: [
            {
              id: 'oi-1',
              product_id: 'p-1',
              product_name: 'Smoky Jollof & Dodo',
              quantity: 2,
              unit_price: 2250,
              line_total: 4500,
            },
          ],
        },
      ]

      vi.mocked(ordersService.getOrdersByCustomer).mockResolvedValueOnce({
        data: mockPastOrders,
        error: null,
      })

      render(
        <MemoryRouter>
          <QuickReorderBar />
        </MemoryRouter>
      )

      // Await data load
      const reorderBtn = await screen.findByText('Reorder')
      expect(reorderBtn).toBeInTheDocument()
      expect(screen.getByText('Campus Cafeteria')).toBeInTheDocument()
      expect(screen.getByText(/2× Smoky Jollof & Dodo/i)).toBeInTheDocument()

      // Click Reorder
      fireEvent.click(reorderBtn)

      // Verify cart store has been repopulated
      const cartItems = useCartStore.getState().items
      expect(cartItems.length).toBe(1)
      expect(cartItems[0].name).toBe('Smoky Jollof & Dodo')
      expect(cartItems[0].quantity).toBe(2)
      expect(useCartStore.getState().vendor?.name).toBe('Campus Cafeteria')
    })
  })
})
