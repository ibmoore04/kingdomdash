import { describe, it, expect, vi } from 'vitest';
import { getAdminAnalytics } from '../admin';
import { supabase } from '../client';
import type { AdminAnalyticsResponse } from '@/types/admin';

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('Admin Analytics Engine & Data Contracts (Phase 12)', () => {
  const mockDbAnalytics: AdminAnalyticsResponse = {
    date_range: {
      start_date: '2026-09-01T00:00:00Z',
      end_date: '2026-09-08T23:59:59Z',
    },
    summary: {
      total_orders: 1420,
      completed_orders: 1350,
      cancelled_orders: 45,
      total_revenue: 5280000.5,
      total_delivery_fees: 710000.0,
      active_riders_count: 38,
      active_vendors_count: 54,
      pending_rider_applications: 6,
      pending_vendor_applications: 3,
      refund_review_count: 2,
    },
    live_metrics: {
      pending_orders_live: 12,
      active_deliveries_live: 24,
      unassigned_deliveries_live: 4,
      available_riders_live: 18,
    },
    orders_over_time: [
      { date: '2026-09-01', total_orders: 40, completed_orders: 38, cancelled_orders: 2, total_revenue: 160000 },
      { date: '2026-09-02', total_orders: 55, completed_orders: 52, cancelled_orders: 3, total_revenue: 220000 },
    ],
    orders_by_service: [
      { service_type: 'food', order_count: 850, total_revenue: 3400000, percentage: 59.9 },
      { service_type: 'grocery', order_count: 370, total_revenue: 1480000, percentage: 26.1 },
      { service_type: 'courier', order_count: 200, total_revenue: 400000, percentage: 14.0 },
    ],
    order_status_distribution: [
      { status: 'delivered', count: 1350, percentage: 95.1 },
      { status: 'cancelled', count: 45, percentage: 3.2 },
      { status: 'pending', count: 25, percentage: 1.7 },
    ],
    delivery_status_distribution: [
      { status: 'delivered', count: 1350, percentage: 95.1 },
      { status: 'in_transit', count: 20, percentage: 1.4 },
      { status: 'assigned', count: 4, percentage: 0.3 },
      { status: 'pending', count: 4, percentage: 0.3 },
      { status: 'cancelled', count: 42, percentage: 2.9 },
    ],
    completion_trends: [
      { date: '2026-09-01', completed: 38, cancelled: 2 },
      { date: '2026-09-02', completed: 52, cancelled: 3 },
    ],
  };

  it('correctly maps database RPC projection into typed analytics structure without fabricating numbers', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockDbAnalytics,
      error: null,
    } as never);

    const result = await getAdminAnalytics('2026-09-01T00:00:00Z', '2026-09-08T23:59:59Z');

    expect(supabase.rpc).toHaveBeenCalledWith('get_admin_analytics', {
      p_start_date: '2026-09-01T00:00:00Z',
      p_end_date: '2026-09-08T23:59:59Z',
    });

    expect(result.data).toBeDefined();
    expect(result.data!.summary.total_orders).toBe(1420);
    expect(result.data!.summary.total_revenue).toBe(5280000.5);
    expect(result.data!.summary.total_delivery_fees).toBe(710000.0);
    expect(result.data!.live_metrics.available_riders_live).toBe(18);
    expect(result.data!.orders_by_service).toHaveLength(3);
    expect(result.data!.orders_by_service[0].service_type).toBe('food');
    expect(result.data!.orders_by_service[0].percentage).toBe(59.9);
  });

  it('handles empty data periods by returning zero-filled statistics gracefully', async () => {
    const emptyDbAnalytics: AdminAnalyticsResponse = {
      date_range: {
        start_date: '2026-09-01T00:00:00Z',
        end_date: '2026-09-08T23:59:59Z',
      },
      summary: {
        total_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_revenue: 0,
        total_delivery_fees: 0,
        active_riders_count: 10,
        active_vendors_count: 5,
        pending_rider_applications: 0,
        pending_vendor_applications: 0,
        refund_review_count: 0,
      },
      live_metrics: {
        pending_orders_live: 0,
        active_deliveries_live: 0,
        unassigned_deliveries_live: 0,
        available_riders_live: 4,
      },
      orders_over_time: [],
      orders_by_service: [],
      order_status_distribution: [],
      delivery_status_distribution: [],
      completion_trends: [],
    };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: emptyDbAnalytics,
      error: null,
    } as never);

    const result = await getAdminAnalytics('2026-09-01T00:00:00Z', '2026-09-08T23:59:59Z');
    expect(result.data).toBeDefined();
    expect(result.data!.summary.total_orders).toBe(0);
    expect(result.data!.summary.total_revenue).toBe(0);
    expect(result.data!.orders_over_time).toEqual([]);
  });

  it('handles database failure by returning typed error object', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        message: 'Query timeout on analytics aggregation',
      },
    } as never);

    const result = await getAdminAnalytics('2026-09-01T00:00:00Z', '2026-09-08T23:59:59Z');
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('Query timeout');
  });

  it('handles range boundary error (KD400) from database RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD400',
        message: 'Invalid date range: start date must be strictly before end date',
      },
    } as never);

    const result = await getAdminAnalytics('2026-09-08T00:00:00Z', '2026-09-01T00:00:00Z');
    expect(result.data).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('Invalid date range');
  });
});
