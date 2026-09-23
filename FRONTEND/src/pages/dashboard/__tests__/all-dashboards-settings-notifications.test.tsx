import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerDashboardPage from '../customer-dashboard'
import AdminDashboardPage from '../admin-dashboard'
import { updateProfile } from '@/services/supabase/profiles'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@kingdomdash.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-user-id' }, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}))

vi.mock('@/services/supabase/notifications', () => ({
  getMyNotifications: vi.fn().mockResolvedValue({
    data: [],
    error: null,
  }),
  markNotificationRead: vi.fn().mockResolvedValue({ data: true, error: null }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ count: 0, error: null }),
  clearReadNotifications: vi.fn().mockResolvedValue({ count: 0, error: null }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 0, error: null }),
  subscribeToMyNotifications: vi.fn().mockReturnValue(() => {}),
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    profile: {
      id: 'test-user-id',
      email: 'customer@kingdomdash.com',
      full_name: 'Amaka Customer',
      phone: '+2348099887766',
      role: 'customer',
    },
    session: { user: { id: 'test-user-id', email: 'customer@kingdomdash.com' } },
    signOut: vi.fn(),
  }),
}))

describe('All Dashboards Settings & Notifications Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('updateProfile validation guard', () => {
    it('rejects empty or undefined user ID with an error without calling database', async () => {
      // @ts-expect-error test undefined id
      const res1 = await updateProfile(undefined, { full_name: 'New Name' })
      expect(res1.error).toBeTruthy()
      expect((res1.error as { message?: string })?.message).toContain('A valid user ID is required')

      const res2 = await updateProfile('', { full_name: 'New Name' })
      expect(res2.error).toBeTruthy()
      expect((res2.error as { message?: string })?.message).toContain('A valid user ID is required')
    })
  })

  describe('Customer Dashboard', () => {
    it('renders customer dashboard and navigates to Settings tab', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard?tab=settings']}>
          <CustomerDashboardPage />
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { level: 2, name: /account & preferences/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/contact phone/i)).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: /toggle sms alerts/i })).toBeInTheDocument()
    })

    it('navigates to Notifications tab in Customer Dashboard and shows empty state', async () => {
      render(
        <MemoryRouter initialEntries={['/dashboard?tab=notifications']}>
          <CustomerDashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /notifications/i })).toBeInTheDocument()
        expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
      })
    })
  })

  describe('Admin Dashboard', () => {
    it('renders Admin Dashboard and displays Settings tab with pricing matrix', async () => {
      render(
        <MemoryRouter initialEntries={['/admin?tab=settings']}>
          <AdminDashboardPage />
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { level: 2, name: /platform & system settings/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/merchant commission rate/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/base delivery fee/i)).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: /toggle auto dispatch/i })).toBeInTheDocument()
    })

    it('displays Admin Notifications tab with empty state when no alerts exist', async () => {
      render(
        <MemoryRouter initialEntries={['/admin?tab=notifications']}>
          <AdminDashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /admin system alerts/i })).toBeInTheDocument()
        expect(screen.getByText(/no pending alerts/i)).toBeInTheDocument()
      })
    })
  })
})
