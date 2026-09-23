import { describe, it, expect, vi } from 'vitest';
import {
  getAdminAnalytics,
  approveRiderApplication,
  approveVendorApplication,
  assignDelivery,
  cancelOrderOperational,
  getAuditLogs,
} from '../admin';
import { supabase } from '../client';

// Mock Supabase client
vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Admin Security & Role Boundary Enforcement (Phase 12)', () => {
  it('returns error when unauthorized customer calls get_admin_analytics', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD403',
        message: 'Unauthorized: Administrative role required.',
        details: '',
        hint: '',
      },
    } as never);

    const res = await getAdminAnalytics('2026-09-01T00:00:00Z', '2026-09-08T00:00:00Z');
    expect(res.data).toBeNull();
    expect(res.error?.message).toContain('Unauthorized: Administrative role required.');
  });

  it('rejects rider attempting to approve rider applications', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD403',
        message: 'Unauthorized: Rider approval requires admin role.',
        details: '',
        hint: '',
      },
    } as never);

    const res = await approveRiderApplication('fake-app-id');
    expect(res.error?.message).toContain('Unauthorized: Rider approval requires admin role.');
  });

  it('rejects vendor attempting to approve vendor applications', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD403',
        message: 'Unauthorized: Vendor application approval requires admin privileges.',
        details: '',
        hint: '',
      },
    } as never);

    const res = await approveVendorApplication('fake-vendor-app-id');
    expect(res.error?.message).toContain('Unauthorized: Vendor application approval requires admin privileges.');
  });

  it('rejects unauthorized courier dispatch by non-admin actors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD403',
        message: 'Unauthorized: Manual dispatch requires administrative authorization.',
        details: '',
        hint: '',
      },
    } as never);

    const res = await assignDelivery('delivery-123', 'rider-456');
    expect(res.error?.message).toContain('Unauthorized: Manual dispatch requires administrative authorization.');
  });

  it('rejects customer attempting operational order cancellation', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: {
        code: 'KD403',
        message: 'Unauthorized: cancel_order_operational restricted to administrators.',
        details: '',
        hint: '',
      },
    } as never);

    const res = await cancelOrderOperational('order-999', 'Customer self-cancel attempt');
    expect(res.error?.message).toContain('Unauthorized: cancel_order_operational restricted to administrators.');
  });

  it('denies standard admin direct read access to audit logs', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({
        data: null,
        count: null,
        error: {
          code: '42501',
          message: 'Permission denied: audit_logs requires super_admin role.',
        },
      }),
    } as never);

    const res = await getAuditLogs();
    expect(res.error?.message).toContain('Permission denied: audit_logs requires super_admin role.');
  });
});
