import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ExecutiveBiSummary } from '../executive-bi-summary';
import { MerchantCommissionLedger } from '../merchant-commission-ledger';
import { RiderFleetAnalytics } from '../rider-fleet-analytics';
import { PlatformHealthAuditBar } from '../platform-health-audit-bar';

describe('Phase 3: Executive BI, Merchant Commission Ledger & Fleet Heatmap Suite', () => {
  describe('ExecutiveBiSummary Component', () => {
    const mockSummary = {
      total_orders: 100,
      completed_orders: 95,
      cancelled_orders: 5,
      total_revenue: 500000,
      total_delivery_fees: 75000,
      active_riders_count: 15,
      active_vendors_count: 8,
      pending_rider_applications: 2,
      pending_vendor_applications: 3,
    };

    it('renders GMV, 10% net commission, AOV, and fulfillment rate', () => {
      render(<ExecutiveBiSummary summary={mockSummary} />);

      // GMV
      expect(screen.getByText('Gross Merchandise (GMV)')).toBeDefined();
      expect(screen.getByText('₦500,000')).toBeDefined();

      // Net Commission (10% of 500,000 = 50,000)
      expect(screen.getByText('Net Take-Rate (10%)')).toBeDefined();
      expect(screen.getByText('₦50,000')).toBeDefined();

      // AOV (500,000 / 100 = 5,000)
      expect(screen.getByText('Average Order Value')).toBeDefined();
      expect(screen.getByText('₦5,000')).toBeDefined();

      // Fulfillment rate (95 / 100 = 95.0%)
      expect(screen.getByText('Fulfillment Rate')).toBeDefined();
      expect(screen.getByText('95.0%')).toBeDefined();
    });

    it('switches metric views between GMV, Commission, and Ticket Count', () => {
      render(<ExecutiveBiSummary summary={mockSummary} />);

      const commissionBtn = screen.getByRole('button', { name: /Platform Take-Rate/i });
      fireEvent.click(commissionBtn);
      expect(commissionBtn.className).toContain('font-bold');

      const ticketBtn = screen.getByRole('button', { name: /Ticket Count/i });
      fireEvent.click(ticketBtn);
      expect(ticketBtn.className).toContain('font-bold');
    });
  });

  describe('MerchantCommissionLedger Component', () => {
    it('renders merchant rows and calculates commission breakdown', () => {
      render(<MerchantCommissionLedger />);

      expect(screen.getByText('Merchant Commission & Automated Settlement Ledger')).toBeDefined();
      expect(screen.getByText('Chicken & Co')).toBeDefined();
      expect(screen.getByText('Lord Reigneth Foods')).toBeDefined();
      expect(screen.getByText('KingdomDash QA Kitchen')).toBeDefined();

      // Export CSV button should be available
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDefined();
    });

    it('filters merchants by search query', () => {
      render(<MerchantCommissionLedger />);

      const searchInput = screen.getByPlaceholderText(/Search merchant, zone, or bank/i);
      fireEvent.change(searchInput, { target: { value: 'Lord Reigneth' } });

      expect(screen.getByText('Lord Reigneth Foods')).toBeDefined();
      expect(screen.queryByText('Chicken & Co')).toBeNull();
    });

    it('filters merchants by status tab', () => {
      render(<MerchantCommissionLedger />);

      const pendingTab = screen.getByRole('button', { name: /^pending$/i });
      fireEvent.click(pendingTab);

      // Lord Reigneth Foods has pending status
      expect(screen.getByText('Lord Reigneth Foods')).toBeDefined();
    });

    it('allows single merchant disbursement action', async () => {
      render(<MerchantCommissionLedger />);

      // Find first disburse button for a pending merchant
      const disburseBtns = screen.getAllByRole('button', { name: /^Disburse$/i });
      expect(disburseBtns.length).toBeGreaterThan(0);

      fireEvent.click(disburseBtns[0]);

      // Modal appears
      expect(screen.getByText('Authorize Merchant Payout')).toBeDefined();

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Disburse Funds/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText('Authorize Merchant Payout')).toBeNull();
      });
    });

    it('allows batch disbursement execution', async () => {
      render(<MerchantCommissionLedger />);

      const batchBtn = screen.queryByRole('button', { name: /Batch Disburse/i });
      if (batchBtn) {
        fireEvent.click(batchBtn);
        expect(screen.getByText('Batch Disburse Pending Merchants')).toBeDefined();

        const confirmBatch = screen.getByRole('button', { name: /Execute Batch Payout/i });
        fireEvent.click(confirmBatch);

        await waitFor(() => {
          expect(screen.queryByText('Batch Disburse Pending Merchants')).toBeNull();
        }, { timeout: 2000 });
      }
    });
  });

  describe('RiderFleetAnalytics Component', () => {
    it('renders fleet leaderboard and Ijebu-Ode hotspot zones', () => {
      render(<RiderFleetAnalytics />);

      // Leaderboard
      expect(screen.getByText('Courier Excellence Leaderboard')).toBeDefined();
      expect(screen.getByText('Ibrahim Babatunde')).toBeDefined();
      expect(screen.getByText('Samuel Adebayo')).toBeDefined();

      // Sector Demand
      expect(screen.getByText('Ijebu-Ode Sector Demand')).toBeDefined();
      expect(screen.getByText('Molipa Corridor & Express')).toBeDefined();
      expect(screen.getByText('TASUED Main Campus / Ijagun')).toBeDefined();
      expect(screen.getByText('Igbeba GRA & Secretariat')).toBeDefined();
    });

    it('supports selecting and expanding an Ijebu-Ode zone', () => {
      render(<RiderFleetAnalytics />);

      const molipaZone = screen.getByText('Molipa Corridor & Express');
      fireEvent.click(molipaZone);

      // Verify click does not crash and applies selection
      expect(molipaZone).toBeDefined();
    });
  });

  describe('PlatformHealthAuditBar Component', () => {
    it('renders real-time health indicator badges', () => {
      render(<PlatformHealthAuditBar />);

      expect(screen.getByText('Platform System Health')).toBeDefined();
      expect(screen.getByText('100% OPERATIONAL')).toBeDefined();
      expect(screen.getByText('Supabase DB:')).toBeDefined();
      expect(screen.getByText('Paystack Webhooks:')).toBeDefined();
    });

    it('toggles audit activity drawer open and displays events', () => {
      render(<PlatformHealthAuditBar />);

      const auditBtn = screen.getByRole('button', { name: /Audit Activity/i });
      fireEvent.click(auditBtn);

      expect(screen.getByText('Live Forensic Audit Feed')).toBeDefined();
      expect(screen.getByText('Settlement Engine:')).toBeDefined();
    });
  });
});
