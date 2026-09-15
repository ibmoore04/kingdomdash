import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RiderSettingsPage from '../settings'

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
  useAuthStore: () => ({
    user: { id: 'user-456', email: 'david.adebayo@example.com' },
    profile: { id: 'user-456', role: 'rider', full_name: 'David Adebayo', phone: '+2348012345678' },
    signOut: mockSignOut,
  }),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    pushToast: mockPushToast,
  }),
}))

const mockSupabaseUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      update: (...args: unknown[]) => mockSupabaseUpdate(...args),
    }),
  },
}))

describe('RiderSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders all main settings sections correctly', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Rider Settings' })).toBeInTheDocument()
    expect(screen.getByText('Navigation & Mapping')).toBeInTheDocument()
    expect(screen.getByText('Dispatch Offers & Sound Alerts')).toBeInTheDocument()
    expect(screen.getByText('Device & Battery Optimization')).toBeInTheDocument()
    expect(screen.getByText('Profile & Contact Details')).toBeInTheDocument()
    expect(screen.getByText('Security & Dispatch Support')).toBeInTheDocument()
  })

  it('displays registered credentials and contact details', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    expect(screen.getAllByText('David Adebayo').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('david.adebayo@example.com')).toBeInTheDocument()
    const phoneInput = screen.getByLabelText('Operational Phone Number') as HTMLInputElement
    expect(phoneInput.value).toBe('+2348012345678')
  })

  it('allows changing the default navigation app', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const appleMapsButton = screen.getByRole('button', { name: /Apple Maps/i })
    fireEvent.click(appleMapsButton)

    const stored = JSON.parse(localStorage.getItem('kd_rider_settings') || '{}')
    expect(stored.defaultNavApp).toBe('apple_maps')
    expect(mockPushToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Setting Saved', variant: 'success' })
    )
  })

  it('allows toggling switches and persists changes', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const soundSwitch = screen.getByLabelText('Sound Alert on New Dispatch Offer')
    fireEvent.click(soundSwitch)

    const stored = JSON.parse(localStorage.getItem('kd_rider_settings') || '{}')
    expect(stored.soundAlerts).toBe(false)
  })

  it('allows changing delivery radius filter', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const radiusButton = screen.getByRole('button', { name: '25 km' })
    fireEvent.click(radiusButton)

    const stored = JSON.parse(localStorage.getItem('kd_rider_settings') || '{}')
    expect(stored.maxDeliveryRadiusKm).toBe(25)
  })

  it('handles sound alert test button click', async () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const testButton = screen.getByRole('button', { name: /Test Sound/i })
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(mockPushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Alert Notification Tested' })
      )
    })
  })

  it('updates phone number via supabase', async () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const phoneInput = screen.getByLabelText('Operational Phone Number')
    fireEvent.change(phoneInput, { target: { value: '+2348099998888' } })

    const saveButton = screen.getByRole('button', { name: 'Save Phone' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith({ phone: '+2348099998888' })
      expect(mockRefreshRider).toHaveBeenCalled()
      expect(mockPushToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Phone Number Updated', variant: 'success' })
      )
    })
  })

  it('handles sign out button click', () => {
    render(
      <BrowserRouter>
        <RiderSettingsPage />
      </BrowserRouter>
    )

    const signOutButtons = screen.getAllByRole('button', { name: /Sign Out/i })
    fireEvent.click(signOutButtons[0])

    expect(mockSignOut).toHaveBeenCalled()
  })
})
