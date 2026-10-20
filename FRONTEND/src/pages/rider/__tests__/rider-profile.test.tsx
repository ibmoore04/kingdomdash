import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RiderProfilePage from '../profile'

const mockRider = {
  id: 'rider-123',
  profile_id: 'user-456',
  vehicle_type: 'motorcycle' as const,
  rating: 4.9,
  total_deliveries: 42,
  is_available: true,
  is_verified: true,
  is_active: true,
  full_name: 'David Adebayo',
  email: 'david.adebayo@example.com',
  phone: '+2348012345678',
  active_in_flight_count: 0,
}

const mockPushToast = vi.fn()
const mockRefreshRider = vi.fn().mockResolvedValue(undefined)
const mockSignOut = vi.fn().mockResolvedValue(undefined)

vi.mock('@/hooks/use-current-rider', () => ({
  useCurrentRider: () => ({
    rider: mockRider,
    isLoading: false,
    isPendingApproval: false,
    refreshRider: mockRefreshRider,
  }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    () => ({
      user: { id: 'user-456', email: 'david.adebayo@example.com' },
      profile: { id: 'user-456', role: 'rider', full_name: 'David Adebayo', phone: '+2348012345678' },
      signOut: mockSignOut,
    }),
    {
      setState: vi.fn(),
      getState: () => ({
        user: { id: 'user-456', email: 'david.adebayo@example.com' },
        profile: { id: 'user-456', role: 'rider', full_name: 'David Adebayo', phone: '+2348012345678' },
      }),
    }
  ),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    pushToast: mockPushToast,
  }),
}))

const mockUpdateRiderContactInfo = vi.fn().mockResolvedValue({ success: true, error: null })

vi.mock('@/services/rider/rider-service', () => ({
  updateRiderContactInfo: (...args: unknown[]) => mockUpdateRiderContactInfo(...args),
  getRiderOperationalProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateRiderAvailability: vi.fn().mockResolvedValue({ success: true, error: null }),
}))

const mockSupabaseUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: mockSupabaseUpdate,
    }),
  },
}))

describe('RiderProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders rider identity card matching customer profile style with metrics and persona', () => {
    render(
      <BrowserRouter>
        <RiderProfilePage />
      </BrowserRouter>
    )

    // Name and persona badge
    expect(screen.getByRole('heading', { level: 1, name: 'David Adebayo' })).toBeInTheDocument()
    expect(screen.getByText('Royal Courier • Ijebu-Ode Fleet')).toBeInTheDocument()
    expect(screen.getByText('david.adebayo@example.com')).toBeInTheDocument()

    // Bordered metrics
    expect(screen.getByText('Total Deliveries')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Customer Rating')).toBeInTheDocument()
    expect(screen.getByText('4.9')).toBeInTheDocument()
    expect(screen.getAllByText('Vehicle Registered').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Duty Availability')).toBeInTheDocument()
    expect(screen.getByText('Available / On-Duty')).toBeInTheDocument()

    // Action button to inbox
    expect(screen.getByText('View Dispatch Inbox')).toBeInTheDocument()
  })

  it('renders account settings form card with navigation tabs and input fields', () => {
    render(
      <BrowserRouter>
        <RiderProfilePage />
      </BrowserRouter>
    )

    // Tabs
    expect(screen.getByText('Account Settings')).toBeInTheDocument()
    expect(screen.getByText('Fleet Preferences')).toBeInTheDocument()
    expect(screen.getAllByText('Trip History').length).toBeGreaterThanOrEqual(1)

    // Form inputs
    expect(screen.getByLabelText(/full name/i)).toHaveValue('David Adebayo')
    expect(screen.getByLabelText(/contact phone number/i)).toHaveValue('+2348012345678')
    expect(screen.getByLabelText(/registered email address/i)).toHaveValue('david.adebayo@example.com')
    expect(screen.getByLabelText(/city \/ fleet base/i)).toHaveValue('Ijebu-Ode, Ogun State')
  })

  it('allows editing full name and phone number and handles save submission', async () => {
    render(
      <BrowserRouter>
        <RiderProfilePage />
      </BrowserRouter>
    )

    const nameInput = screen.getByLabelText(/full name/i)
    fireEvent.change(nameInput, { target: { value: 'David Segun Adebayo' } })
    expect(nameInput).toHaveValue('David Segun Adebayo')

    const phoneInput = screen.getByLabelText(/contact phone number/i)
    fireEvent.change(phoneInput, { target: { value: '+2348099887766' } })
    expect(phoneInput).toHaveValue('+2348099887766')

    const saveBtn = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({
        full_name: 'David Segun Adebayo',
        phone: '+2348099887766',
      })
      expect(mockUpdateRiderContactInfo).toHaveBeenCalledWith('+2348099887766')
      expect(mockRefreshRider).toHaveBeenCalled()
      expect(screen.getByText(/rider profile details successfully updated/i)).toBeInTheDocument()
    })
  })

  it('copies referral link to clipboard', async () => {
    render(
      <BrowserRouter>
        <RiderProfilePage />
      </BrowserRouter>
    )

    const copyBtn = screen.getByTitle(/copy fleet reference code/i)
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('https://kingdomdash.com/courier?ref=')
    )
    await waitFor(() => {
      expect(screen.getByText(/copied to clipboard!/i)).toBeInTheDocument()
    })
  })
})
