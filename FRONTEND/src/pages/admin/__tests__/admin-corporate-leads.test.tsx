import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminUsersPage } from '../admin-users-page'
import * as adminService from '@/services/supabase/admin'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/services/supabase/admin', () => ({
  getUsers: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  toggleUserActive: vi.fn(),
  getCorporateLeads: vi.fn(),
  updateCorporateLeadStatus: vi.fn().mockResolvedValue({ error: null }),
}))

describe('Admin Corporate Leads in Platform Users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    useAuthStore.setState({
      session: { user: { id: 'admin-1' } } as any,
      profile: {
        id: 'admin-1',
        email: 'admin@kingdomdash.test',
        full_name: 'Admin User',
        role: 'admin',
        is_active: true,
      } as any,
    })
  })

  it('renders corporate leads and allows switching between tabs', async () => {
    const mockLeads = [
      {
        id: 'corp-1',
        company_name: 'Florson Pharmacy',
        contact_name: 'Akanbi Ibrahim',
        email: 'contact@florson.com',
        phone: '08123424005',
        address: '17, folagbade',
        business_type: 'E-commerce & Retail',
        estimated_volume: '100 deliveries/mo',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    vi.mocked(adminService.getCorporateLeads).mockResolvedValue({
      data: mockLeads,
      count: 1,
      error: null,
    })

    render(<AdminUsersPage />)

    // Tab button should display count badge
    await waitFor(() => {
      const corpTabBtn = screen.getByRole('button', { name: /corporate leads/i })
      expect(corpTabBtn).toBeInTheDocument()
      expect(corpTabBtn).toHaveTextContent('1')
    })

    // Switch to corporate tab
    fireEvent.click(screen.getByRole('button', { name: /corporate leads/i }))

    await waitFor(() => {
      expect(screen.getByText('Florson Pharmacy')).toBeInTheDocument()
      expect(screen.getByText('Akanbi Ibrahim')).toBeInTheDocument()
      expect(screen.getByText('08123424005')).toBeInTheDocument()
      expect(screen.getByText('contact@florson.com')).toBeInTheDocument()
      expect(screen.getByText('1 B2B logistics inquiries from Ijebu-Ode businesses')).toBeInTheDocument()
    })
  })

  it('handles lead status update action (contacted/onboarded)', async () => {
    const mockLeads = [
      {
        id: 'corp-1',
        company_name: 'Florson Pharmacy',
        contact_name: 'Akanbi Ibrahim',
        email: 'contact@florson.com',
        phone: '08123424005',
        address: '17, folagbade',
        business_type: 'E-commerce & Retail',
        estimated_volume: '100 deliveries/mo',
        status: 'pending' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    vi.mocked(adminService.getCorporateLeads).mockResolvedValue({
      data: mockLeads,
      count: 1,
      error: null,
    })

    render(<AdminUsersPage />)

    fireEvent.click(screen.getByText('Corporate Leads'))

    await waitFor(() => {
      expect(screen.getByText('Florson Pharmacy')).toBeInTheDocument()
    })

    const contactButton = screen.getByRole('button', { name: /contacted/i })
    fireEvent.click(contactButton)

    await waitFor(() => {
      expect(adminService.updateCorporateLeadStatus).toHaveBeenCalledWith('corp-1', 'contacted')
    })
  })
})
