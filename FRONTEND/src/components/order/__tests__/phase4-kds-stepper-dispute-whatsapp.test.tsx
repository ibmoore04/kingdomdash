import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KitchenDisplayScreen } from '../../vendor/kitchen-display-screen';
import { LiveDeliveryStepper } from '../live-delivery-stepper';
import { WhatsappDispatchBridge } from '../whatsapp-dispatch-bridge';
import { SmartDisputeResolutionModal } from '../../customer/smart-dispute-resolution-modal';
import * as ordersService from '@/services/supabase/orders';

vi.mock('@/services/supabase/orders', () => ({
  cancelOrderCustomer: vi.fn(),
  updateOrderStatusVendor: vi.fn(),
  getOrdersByVendor: vi.fn(),
}));

describe('Phase 4: Kitchen Display, Live Stepper, WhatsApp Bridge & Smart Dispute Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ordersService.cancelOrderCustomer).mockResolvedValue({ data: null, error: null } as any);
  });

  describe('KitchenDisplayScreen Component', () => {
    it('renders kitchen tickets and prep checklist', () => {
      render(<KitchenDisplayScreen />);

      expect(screen.getByText('Kitchen Display System (KDS)')).toBeDefined();
      expect(screen.getByText('KD-FD084')).toBeDefined();
      expect(screen.getByText('Bisi Johnson')).toBeDefined();
      expect(screen.getByText(/Party Jollof Rice & Crispy Chicken Combo/i)).toBeDefined();
    });

    it('allows checking off recipe items', () => {
      render(<KitchenDisplayScreen />);

      const dodoItem = screen.getByText(/Golden Fried Dodo/i);
      fireEvent.click(dodoItem);
      // Item container toggles strike-through class
      expect(dodoItem.closest('.cursor-pointer')?.className).toContain('line-through');
    });

    it('advances order status when clicking action button', () => {
      const onUpdateStatus = vi.fn();
      render(<KitchenDisplayScreen onUpdateStatus={onUpdateStatus} />);

      // Find the confirmed ticket and click "Start Cooking"
      const startCookingBtn = screen.getByRole('button', { name: /Start Cooking/i });
      fireEvent.click(startCookingBtn);

      expect(onUpdateStatus).toHaveBeenCalledWith('t-102', 'preparing');
    });

    it('plays test chime sound without crashing', () => {
      render(<KitchenDisplayScreen />);

      const soundBtn = screen.getByRole('button', { name: /Test Sound/i });
      expect(() => fireEvent.click(soundBtn)).not.toThrow();
    });
  });

  describe('LiveDeliveryStepper Component', () => {
    it('renders live fulfillment stages and ETA', () => {
      render(
        <LiveDeliveryStepper
          status="in_transit"
          etaMinutes={18}
          deliveryPin="9421"
          orderNumber="KD-8812"
        />
      );

      expect(screen.getByText('Live Order Fulfillment Stepper')).toBeDefined();
      expect(screen.getByText('~18 mins')).toBeDefined();
      expect(screen.getByText('9421')).toBeDefined();
      expect(screen.getByText('On the Way')).toBeDefined();
    });

    it('adjusts active stage for delivered orders', () => {
      render(<LiveDeliveryStepper status="delivered" orderNumber="KD-8812" />);

      expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
      expect(screen.getByText('Package handed over safely')).toBeDefined();
    });
  });

  describe('WhatsappDispatchBridge Component', () => {
    it('generates encoded WhatsApp links for courier and central dispatch', () => {
      render(
        <WhatsappDispatchBridge
          orderNumber="KD-9901"
          customerName="Akanbi Ibrahim"
          deliveryAddress="15 Hospital Road, Ijebu-Ode"
          riderName="Babatunde"
          riderPhone="+2348077958755"
        />
      );

      expect(screen.getByText('Direct WhatsApp Dispatch Bridge')).toBeDefined();
      expect(screen.getByText('Babatunde')).toBeDefined();

      const riderChatLink = screen.getByRole('link', { name: /Chat on WhatsApp/i });
      expect(riderChatLink.getAttribute('href')).toContain('wa.me/2348077958755');
      expect(riderChatLink.getAttribute('href')).toContain('KD-9901');

      const supportChatLink = screen.getByRole('link', { name: /Support WhatsApp/i });
      expect(supportChatLink.getAttribute('href')).toContain('wa.me');
    });
  });

  describe('SmartDisputeResolutionModal Component', () => {
    it('displays 100% full refund tier when cancelled before cooking', async () => {
      render(
        <SmartDisputeResolutionModal
          isOpen={true}
          onClose={() => {}}
          orderId="ord-1"
          orderNumber="KD-1001"
          status="payment_confirmed"
          totalAmount={6500}
          deliveryFee={800}
        />
      );

      expect(screen.getByText('100% Full Refund')).toBeDefined();
      expect(screen.getByText('₦6,500')).toBeDefined();

      const confirmBtn = screen.getByRole('button', { name: /Confirm Cancellation/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(ordersService.cancelOrderCustomer).toHaveBeenCalled();
        expect(screen.getByText(/100% refund of ₦6,500 queued/i)).toBeDefined();
      });
    });

    it('displays partial refund tier when order is already in the kitchen', () => {
      render(
        <SmartDisputeResolutionModal
          isOpen={true}
          onClose={() => {}}
          orderId="ord-2"
          orderNumber="KD-1002"
          status="preparing"
          totalAmount={6500}
          deliveryFee={800}
        />
      );

      expect(screen.getByText('Partial Refund')).toBeDefined();
      expect(screen.getByText('₦800')).toBeDefined();
    });

    it('switches to dispute ticket mode when order is in transit or delivered', async () => {
      render(
        <SmartDisputeResolutionModal
          isOpen={true}
          onClose={() => {}}
          orderId="ord-3"
          orderNumber="KD-1003"
          status="in_transit"
          totalAmount={6500}
          deliveryFee={800}
        />
      );

      expect(screen.getByText('Order Dispute & Resolution')).toBeDefined();
      expect(screen.getByText('Support Mediation')).toBeDefined();

      const submitDisputeBtn = screen.getByRole('button', { name: /Submit Dispute Ticket/i });
      fireEvent.click(submitDisputeBtn);

      await waitFor(() => {
        expect(screen.getByText(/Dispute ticket #DIS-KD-1003 opened/i)).toBeDefined();
      });
    });
  });
});
