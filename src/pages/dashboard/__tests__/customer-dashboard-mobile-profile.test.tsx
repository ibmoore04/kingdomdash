import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CustomerDashboardPage from '../customer-dashboard'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/services/supabase/client'

// Mock dependencies
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'cust-123', email: 'customer@example.com' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn(),
  },
}))

vi.mock('@/services/supabase/notifications', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  fetchUserNotifications: vi.fn().mockResolvedValue({ data: [], error: null }),
  markNotificationAsRead: vi.fn().mockResolvedValue({ data: null, error: null }),
  markAllNotificationsAsRead: vi.fn().mockResolvedValue({ data: null, error: null }),
  subscribeToUserNotifications: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
}))

describe('Customer Dashboard Mobile Navigation & Profile Editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      profile: {
        id: 'cust-123',
        full_name: 'Original Customer Name',
        phone: '+2348012345678',
        role: 'customer',
        email: 'customer@example.com',
      } as any,
      session: { user: { id: 'cust-123' } } as any,
    })

    // Default supabase from mock
    ;(supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })
  })

  it('renders mobile hamburger button and mobile bottom navigation bar', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/customer']}>
        <CustomerDashboardPage />
      </MemoryRouter>
    )

    // Hamburger button
    const menuBtn = screen.getByLabelText('Open navigation menu')
    expect(menuBtn).toBeInTheDocument()

    // Mobile bottom navigation bar
    const bottomNav = screen.getByLabelText('Mobile bottom navigation')
    expect(bottomNav).toBeInTheDocument()

    // Has bottom navigation items
    expect(screen.getAllByRole('button', { name: /orders/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /profile/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /settings/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('opens and closes mobile slide-over drawer when menu button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/customer']}>
        <CustomerDashboardPage />
      </MemoryRouter>
    )

    // Click hamburger button to open drawer
    const menuBtn = screen.getByLabelText('Open navigation menu')
    fireEvent.click(menuBtn)

    // Drawer should appear
    const drawerNav = screen.getByLabelText('Mobile drawer navigation')
    expect(drawerNav).toBeInTheDocument()

    // Close button should be present
    const closeBtn = screen.getByLabelText('Close navigation menu')
    expect(closeBtn).toBeInTheDocument()

    // Close drawer
    fireEvent.click(closeBtn)
    expect(screen.queryByLabelText('Mobile drawer navigation')).not.toBeInTheDocument()
  })

  it('allows customer to edit full name and phone in Profile tab', async () => {
    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          update: updateSpy,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    render(
      <MemoryRouter initialEntries={['/dashboard/customer?tab=profile']}>
        <CustomerDashboardPage />
      </MemoryRouter>
    )

    // Verify Profile tab inputs exist with initial values
    const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement
    const phoneInput = screen.getByLabelText(/contact phone number/i) as HTMLInputElement
    expect(nameInput.value).toBe('Original Customer Name')
    expect(phoneInput.value).toBe('+2348012345678')

    // Change values
    fireEvent.change(nameInput, { target: { value: 'Updated Jane Doe' } })
    fireEvent.change(phoneInput, { target: { value: '+2348099887766' } })

    // Click Save Changes
    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        full_name: 'Updated Jane Doe',
        phone: '+2348099887766',
      })
    })

    // Verify auth store state is synchronized
    expect(useAuthStore.getState().profile?.full_name).toBe('Updated Jane Doe')
    expect(useAuthStore.getState().profile?.phone).toBe('+2348099887766')

    // Feedback message displayed
    await screen.findByText(/profile details successfully updated/i)
  })
})
