import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminVendorApplicationsPage from '../admin-vendor-applications-page'
import AdminRiderApplicationsPage from '../admin-rider-applications-page'
import * as adminService from '@/services/supabase/admin'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-1', email: 'admin@kingdomdash.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}))

vi.mock('@/services/supabase/admin', () => ({
  getPendingVendorApplications: vi.fn(),
  getPendingRiderApplications: vi.fn(),
  reviewVendorApplication: vi.fn(),
  reviewRiderApplication: vi.fn(),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    profile: {
      id: 'admin-1',
      email: 'admin@kingdomdash.com',
      full_name: 'Super Admin',
      role: 'super_admin',
    },
    signOut: vi.fn(),
  }),
}))

describe('Admin Applications Contact & Date Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders vendor contact phone, business address, and valid date without "Invalid Date"', async () => {
    vi.mocked(adminService.getPendingVendorApplications).mockResolvedValue({
      data: [
        {
          id: 'v-app-1',
          profile_id: 'user-1',
          business_name: "AGORO MOSUNMOLA AKINWALE's Store",
          business_type: 'restaurant',
          service_types: ['food'],
          phone: '+2348077958755',
          email: 'agoro@example.com',
          business_address: '14 Lagos Garage Road, Ijebu-Ode',
          status: 'pending',
          submitted_at: '2026-09-21T10:30:00.000Z',
          business_description: 'Fresh cafeteria and fast food in Ijebu-Ode',
        },
      ],
      error: null,
    })

    render(
      <MemoryRouter>
        <AdminVendorApplicationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText("AGORO MOSUNMOLA AKINWALE's Store").length).toBeGreaterThan(0)
    })

    // Contact phone and address should be visible
    expect(screen.getAllByText('+2348077958755').length).toBeGreaterThan(0)
    expect(screen.getAllByText('14 Lagos Garage Road, Ijebu-Ode').length).toBeGreaterThan(0)

    // Ensure "Invalid Date" is NEVER present on screen
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
  })

  it('falls back to joined profile contact and created_at if phone or submitted_at is absent', async () => {
    vi.mocked(adminService.getPendingVendorApplications).mockResolvedValue({
      data: [
        {
          id: 'v-app-2',
          profile_id: 'user-2',
          business_name: 'Adeleke Buka',
          business_type: 'restaurant',
          service_types: ['food'],
          created_at: '2026-09-20T14:00:00.000Z',
          profile: {
            full_name: 'Adeleke Buka Owner',
            phone: '+2349070509251',
            email: 'adeleke@example.com',
          },
        },
      ],
      error: null,
    })

    render(
      <MemoryRouter>
        <AdminVendorApplicationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Adeleke Buka').length).toBeGreaterThan(0)
    })

    // Profile phone fallback rendered
    expect(screen.getAllByText('+2349070509251').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
  })

  it('renders rider contact phone, address, and valid date properly in rider applications', async () => {
    vi.mocked(adminService.getPendingRiderApplications).mockResolvedValue({
      data: [
        {
          id: 'r-app-1',
          profile_id: 'rider-user-1',
          full_name: 'Babatunde Fashola',
          phone: '+2348077958755',
          email: 'babatunde@example.com',
          address: '5 Folagbade Street, Ijebu-Ode',
          vehicle_type: 'motorcycle',
          plate_number: 'JBD-234-OG',
          status: 'pending',
          submitted_at: '2026-09-21T09:00:00.000Z',
        },
      ],
      error: null,
    })

    render(
      <MemoryRouter>
        <AdminRiderApplicationsPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Babatunde Fashola').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('+2348077958755').length).toBeGreaterThan(0)
    expect(screen.getAllByText('JBD-234-OG').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
  })
})
