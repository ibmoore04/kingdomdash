import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RiderNotificationsPage from '../notifications'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-rider-user-id', email: 'rider@kingdomdash.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'mock-notif-1',
            title: 'Mock Dispatch Request',
            message: 'Order pickup ready at Kilimanjaro.',
            type: 'info',
            is_read: false,
            action_url: '/rider/assignments',
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}))

vi.mock('@/services/supabase/notifications', () => ({
  getMyNotifications: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'test-n-1',
        title: 'Genesis Restaurant Order Ready',
        message: 'Order #KD-1002 is ready for pickup.',
        type: 'info',
        is_read: false,
        action_url: '/rider/assignments',
        created_at: new Date().toISOString(),
      },
      {
        id: 'test-n-2',
        title: 'Safety Bonus Credited',
        message: '₦500 helmet bonus credited.',
        type: 'success',
        is_read: true,
        action_url: null,
        created_at: new Date().toISOString(),
      },
    ],
    error: null,
  }),
  markNotificationRead: vi.fn().mockResolvedValue({ data: true, error: null }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ count: 2, error: null }),
  clearReadNotifications: vi.fn().mockResolvedValue({ count: 1, error: null }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 1, error: null }),
  subscribeToMyNotifications: vi.fn().mockReturnValue(() => {}),
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    profile: {
      id: 'test-rider-profile-id',
      email: 'rider@kingdomdash.com',
      full_name: 'Chidi Rider',
      role: 'rider',
    },
    session: { user: { id: 'test-rider-user-id' } },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-current-rider', () => ({
  useCurrentRider: () => ({
    rider: {
      id: 'mock-rider-id',
      full_name: 'Chidi Rider',
      phone: '+2348011223344',
      is_available: true,
      is_active: true,
      is_verified: true,
      vehicle_type: 'motorcycle',
    },
    isLoading: false,
    refreshRider: vi.fn(),
  }),
}))

describe('RiderNotificationsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders rider notifications header and loaded notifications', async () => {
    render(
      <MemoryRouter>
        <RiderNotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /notifications/i })).toBeInTheDocument()
      expect(screen.getByText('Genesis Restaurant Order Ready')).toBeInTheDocument()
      expect(screen.getByText('Safety Bonus Credited')).toBeInTheDocument()
    })
  })

  it('allows filtering notifications by unread tab', async () => {
    render(
      <MemoryRouter>
        <RiderNotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis Restaurant Order Ready')).toBeInTheDocument()
    })

    const unreadTab = screen.getByRole('button', { name: /unread/i })
    fireEvent.click(unreadTab)

    expect(screen.getByText('Genesis Restaurant Order Ready')).toBeInTheDocument()
    expect(screen.queryByText('Safety Bonus Credited')).not.toBeInTheDocument()
  })

  it('allows marking a notification as read', async () => {
    render(
      <MemoryRouter>
        <RiderNotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis Restaurant Order Ready')).toBeInTheDocument()
    })

    const markReadBtn = screen.getByRole('button', { name: /mark read/i })
    fireEvent.click(markReadBtn)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark read/i })).not.toBeInTheDocument()
    })
  })

  it('handles mark all as read', async () => {
    render(
      <MemoryRouter>
        <RiderNotificationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Genesis Restaurant Order Ready')).toBeInTheDocument()
    })

    const markAllBtn = screen.getByRole('button', { name: /mark all read/i })
    fireEvent.click(markAllBtn)

    await waitFor(() => {
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument()
    })
  })
})
