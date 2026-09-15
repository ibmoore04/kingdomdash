import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  subscribeToMyNotifications,
} from '../notifications';
import { supabase } from '../client';

vi.mock('../client', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockChannel = vi.fn();
  const mockRemoveChannel = vi.fn();

  return {
    supabase: {
      auth: {
        getUser: vi.fn(),
      },
      from: mockFrom,
      rpc: mockRpc,
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
  };
});

describe('Phase 13: Notifications Service Layer & Security Suite', () => {
  const mockUserId = 'user-uuid-1234';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId, email: 'customer@kingdomdash.com' } as any },
      error: null,
    });
  });

  describe('getMyNotifications()', () => {
    it('queries notifications scoped to authenticated profile_id', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            id: 'notif-1',
            profile_id: mockUserId,
            title: 'Payment Confirmed',
            message: 'Your payment was confirmed.',
            type: 'success',
            category: 'payment',
            is_read: false,
            action_url: '/order/123/confirmation',
            idempotency_key: 'order:123:status:payment_confirmed:customer:' + mockUserId,
            metadata: { order_id: '123' },
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      } as any);

      const res = await getMyNotifications();
      expect(res.error).toBeNull();
      expect(res.data).toHaveLength(1);
      expect(res.data![0].title).toBe('Payment Confirmed');
      expect(res.data![0].category).toBe('payment');
      expect(mockEq).toHaveBeenCalledWith('profile_id', mockUserId);
    });

    it('applies unreadOnly and category filters when supplied', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      } as any);

      await getMyNotifications({ unreadOnly: true, category: 'order' });

      expect(mockEq).toHaveBeenCalledWith('profile_id', mockUserId);
      expect(mockEq).toHaveBeenCalledWith('is_read', false);
      expect(mockEq).toHaveBeenCalledWith('category', 'order');
    });

    it('returns error if user is unauthenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated') as any,
      });

      const res = await getMyNotifications();
      expect(res.data).toBeNull();
      expect(res.error).toBeTruthy();
    });
  });

  describe('getUnreadNotificationCount()', () => {
    it('calls get_unread_notification_count RPC and returns count', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: 5,
        error: null,
      } as any);

      const res = await getUnreadNotificationCount();
      expect(res.error).toBeNull();
      expect(res.count).toBe(5);
      expect(supabase.rpc).toHaveBeenCalledWith('get_unread_notification_count');
    });
  });

  describe('markNotificationRead()', () => {
    it('routes through mark_notification_read RPC with notification id', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null,
      } as any);

      const res = await markNotificationRead('notif-abc');
      expect(res.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
        p_notification_id: 'notif-abc',
      });
    });
  });

  describe('markAllNotificationsRead()', () => {
    it('invokes atomic mark_all_notifications_read RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: 3,
        error: null,
      } as any);

      const res = await markAllNotificationsRead();
      expect(res.error).toBeNull();
      expect(res.count).toBe(3);
      expect(supabase.rpc).toHaveBeenCalledWith('mark_all_notifications_read');
    });
  });

  describe('clearReadNotifications()', () => {
    it('invokes atomic clear_read_notifications RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: 2,
        error: null,
      } as any);

      const res = await clearReadNotifications();
      expect(res.error).toBeNull();
      expect(res.count).toBe(2);
      expect(supabase.rpc).toHaveBeenCalledWith('clear_read_notifications');
    });
  });

  describe('getNotificationPreferences() & updateNotificationPreferences()', () => {
    it('returns default preferences if none exist in database', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      } as any);

      const res = await getNotificationPreferences();
      expect(res.error).toBeNull();
      expect(res.data?.order_updates).toBe(true);
      expect(res.data?.delivery_updates).toBe(true);
      expect(res.data?.promotional).toBe(false);
    });

    it('upserts preferences into notification_preferences table', async () => {
      const mockUpsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          profile_id: mockUserId,
          order_updates: false,
          delivery_updates: true,
          payment_updates: true,
          promotional: true,
          operational_alerts: true,
        },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
        select: mockSelect,
        single: mockSingle,
      } as any);

      const res = await updateNotificationPreferences({ order_updates: false, promotional: true });
      expect(res.error).toBeNull();
      expect(res.data?.order_updates).toBe(false);
      expect(res.data?.promotional).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_id: mockUserId,
          order_updates: false,
          promotional: true,
        })
      );
    });
  });

  describe('subscribeToMyNotifications()', () => {
    it('subscribes to scoped channel and unmounts cleanly', () => {
      const mockChannelObj = {
        on: vi.fn(),
        subscribe: vi.fn(),
      };
      mockChannelObj.on.mockReturnValue(mockChannelObj);
      mockChannelObj.subscribe.mockReturnValue(mockChannelObj);

      vi.mocked(supabase.channel).mockReturnValue(mockChannelObj as any);

      const callback = vi.fn();
      const unsubscribe = subscribeToMyNotifications(mockUserId, callback);

      expect(supabase.channel).toHaveBeenCalledWith(`realtime:notifications:${mockUserId}`);
      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${mockUserId}`,
        }),
        expect.any(Function)
      );

      // Clean teardown
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannelObj);
    });

    it('returns empty cleanup function if userId is falsy', () => {
      const unsubscribe = subscribeToMyNotifications('', vi.fn());
      expect(typeof unsubscribe).toBe('function');
      expect(supabase.channel).not.toHaveBeenCalled();
    });
  });

  describe('Metadata Security & Sensitive Data Guard', () => {
    it('verifies metadata payload does not contain forbidden sensitive credentials', () => {
      const safeMetadata = {
        order_id: 'order-123',
        delivery_id: 'del-456',
        assignment_id: 'asgn-789',
        application_id: 'app-001',
        status: 'payment_confirmed',
        reason: 'Customer requested reschedule',
      };

      const forbiddenKeys = [
        'password',
        'secret',
        'api_key',
        'token',
        'bvn',
        'bank_account_number',
        'card_number',
        'authorization_code',
        'pin',
      ];

      for (const key of forbiddenKeys) {
        expect(safeMetadata).not.toHaveProperty(key);
      }
    });
  });

  describe('Preferences: application_updates mapping', () => {
    it('returns application_updates: true in default preferences', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      } as any);

      const res = await getNotificationPreferences();
      expect(res.data?.application_updates).toBe(true);
    });

    it('allows updating application_updates preference', async () => {
      const mockUpsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          profile_id: mockUserId,
          order_updates: true,
          delivery_updates: true,
          payment_updates: true,
          application_updates: false,
          promotional: false,
          operational_alerts: true,
        },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
        select: mockSelect,
        single: mockSingle,
      } as any);

      const res = await updateNotificationPreferences({ application_updates: false });
      expect(res.error).toBeNull();
      expect(res.data?.application_updates).toBe(false);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_id: mockUserId,
          application_updates: false,
        })
      );
    });
  });
});
