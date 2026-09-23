import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminNotificationsPage from '../admin-notifications-page';
import { AdminHeader } from '@/components/admin/admin-header';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import * as notificationsService from '@/services/supabase/notifications';

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-user-id', email: 'admin@kingdomdash.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

vi.mock('@/services/supabase/notifications', () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn().mockResolvedValue({ data: true, error: null }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ count: 2, error: null }),
  clearReadNotifications: vi.fn().mockResolvedValue({ count: 1, error: null }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 2, error: null }),
  subscribeToMyNotifications: vi.fn().mockReturnValue(() => {}),
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    profile: {
      id: 'admin-user-id',
      email: 'admin@kingdomdash.com',
      full_name: 'Admin User',
      role: 'super_admin',
    },
    signOut: vi.fn(),
  }),
}));

const mockNotifications = [
  {
    id: 'notif-app-1',
    profile_id: 'admin-user-id',
    title: 'New Rider Application Submitted',
    message: 'Chukwuma Eze has applied as a dispatch rider for Ikeja zone.',
    type: 'warning' as const,
    category: 'application' as const,
    is_read: false,
    action_url: '/admin/rider-applications',
    idempotency_key: 'app_sub:rider:1:admin:admin-user-id',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'notif-app-2',
    profile_id: 'admin-user-id',
    title: 'New Vendor Application Submitted',
    message: 'Mama Put Kitchen submitted documentation for merchant review.',
    type: 'info' as const,
    category: 'application' as const,
    is_read: true,
    action_url: '/admin/vendor-applications',
    idempotency_key: 'app_sub:vendor:2:admin:admin-user-id',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'notif-dispatch-3',
    profile_id: 'admin-user-id',
    title: 'Dispatch Incident Reported',
    message: 'Delivery #DLV-404 delay in transit exceeding threshold.',
    type: 'error' as const,
    category: 'system' as const,
    is_read: false,
    action_url: '/admin/dispatch',
    idempotency_key: 'dispatch:3:admin:admin-user-id',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

describe('Admin Notifications Page & Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders admin notifications page and displays notifications list', async () => {
    vi.mocked(notificationsService.getMyNotifications).mockResolvedValueOnce({
      data: mockNotifications,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/admin system alerts & notifications/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('New Rider Application Submitted')).toBeInTheDocument();
      expect(screen.getByText('New Vendor Application Submitted')).toBeInTheDocument();
      expect(screen.getByText('Dispatch Incident Reported')).toBeInTheDocument();
    });

    // Verify unread badge count (2 unread items)
    expect(screen.getByText(/2 unread/i)).toBeInTheDocument();
  });

  it('filters notifications by Unread, Applications, and System tabs', async () => {
    vi.mocked(notificationsService.getMyNotifications).mockResolvedValueOnce({
      data: mockNotifications,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Rider Application Submitted')).toBeInTheDocument();
    });

    // Click Unread tab
    const unreadTab = screen.getByRole('button', { name: /unread/i });
    fireEvent.click(unreadTab);

    expect(screen.getByText('New Rider Application Submitted')).toBeInTheDocument();
    expect(screen.getByText('Dispatch Incident Reported')).toBeInTheDocument();
    expect(screen.queryByText('New Vendor Application Submitted')).not.toBeInTheDocument();

    // Click Applications tab
    const appTab = screen.getByRole('button', { name: /applications/i });
    fireEvent.click(appTab);

    expect(screen.getByText('New Rider Application Submitted')).toBeInTheDocument();
    expect(screen.getByText('New Vendor Application Submitted')).toBeInTheDocument();
    expect(screen.queryByText('Dispatch Incident Reported')).not.toBeInTheDocument();
  });

  it('marks a single notification as read', async () => {
    vi.mocked(notificationsService.getMyNotifications).mockResolvedValueOnce({
      data: mockNotifications,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('New Rider Application Submitted')).toBeInTheDocument();
    });

    const markReadButtons = screen.getAllByTitle('Mark as read');
    expect(markReadButtons.length).toBeGreaterThan(0);

    fireEvent.click(markReadButtons[0]);

    await waitFor(() => {
      expect(notificationsService.markNotificationRead).toHaveBeenCalledWith('notif-dispatch-3');
    });
  });

  it('marks all notifications as read when clicking Mark All Read', async () => {
    vi.mocked(notificationsService.getMyNotifications).mockResolvedValueOnce({
      data: mockNotifications,
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() => {
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no notifications exist', async () => {
    vi.mocked(notificationsService.getMyNotifications).mockResolvedValueOnce({
      data: [],
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminNotificationsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no notifications found/i)).toBeInTheDocument();
    });
  });

  it('verifies AdminHeader has Notifications route title and clickable bell trigger', () => {
    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <AdminHeader onToggleMobileMenu={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /system notifications/i })).toBeInTheDocument();
    const bellBtn = screen.getByRole('button', { name: /notifications/i });
    expect(bellBtn).toBeInTheDocument();
  });

  it('verifies AdminSidebar renders Notifications navigation item pointing to /admin/notifications', () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AdminSidebar
          collapsed={false}
          onToggleCollapse={vi.fn()}
          mobileOpen={false}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>
    );

    const notifLink = screen.getByRole('link', { name: /notifications/i });
    expect(notifLink).toBeInTheDocument();
    expect(notifLink).toHaveAttribute('href', '/admin/notifications');
  });
});
