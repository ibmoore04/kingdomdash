import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminUsersPage } from '../admin-users-page'
import * as adminService from '@/services/supabase/admin'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/services/supabase/admin', () => ({
  getUsers: vi.fn(),
  toggleUserActive: vi.fn(),
}))

describe('AdminUsersPage RBAC & Super Admin Isolation', () => {
  const sampleAdminProfile = {
    id: 'admin-1',
    email: 'admin@kingdomdash.test',
    full_name: 'Standard Admin',
    role: 'admin' as const,
    is_active: true,
  }

  const sampleSuperAdminProfile = {
    id: 'superadmin-1',
    email: 'superadmin@kingdomdash.test',
    full_name: 'Super Admin Officer',
    role: 'super_admin' as const,
    is_active: true,
  }

  const sampleUsers = [
    {
      id: 'cust-1',
      full_name: 'John Customer',
      email: 'john@test.com',
      phone_number: '+2348011112222',
      role: 'customer',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'rider-1',
      full_name: 'Segun Rider',
      email: 'segun@test.com',
      phone_number: '+2348033334444',
      role: 'rider',
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'admin-1',
      full_name: 'Standard Admin',
      email: 'admin@kingdomdash.test',
      phone_number: '+2348055556666',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminService.getUsers).mockResolvedValue({
      data: sampleUsers as any,
      count: sampleUsers.length,
    } as any)
  })

  it('standard Admin does NOT see Super Admin option in role filter', async () => {
    useAuthStore.setState({
      profile: sampleAdminProfile as any,
      session: { user: { id: 'admin-1' } } as any,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getAllByText('John Customer').length).toBeGreaterThan(0)
    })

    const roleSelect = screen.getAllByRole('combobox')[0]
    fireEvent.pointerDown(roleSelect, { pointerId: 1 })
    fireEvent.keyDown(roleSelect, { key: 'ArrowDown' })

    expect(screen.queryByRole('option', { name: 'Super Admin' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Customer' })).toBeInTheDocument()
  })

  it('Super Admin DOES see Super Admin option in role filter', async () => {
    useAuthStore.setState({
      profile: sampleSuperAdminProfile as any,
      session: { user: { id: 'superadmin-1' } } as any,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getAllByText('John Customer').length).toBeGreaterThan(0)
    })

    const roleSelect = screen.getAllByRole('combobox')[0]
    fireEvent.pointerDown(roleSelect, { pointerId: 1 })
    fireEvent.keyDown(roleSelect, { key: 'ArrowDown' })

    expect(screen.getByRole('option', { name: 'Super Admin' })).toBeInTheDocument()
  })

  it('prevents standard Admin from deactivating their own account', async () => {
    useAuthStore.setState({
      profile: sampleAdminProfile as any,
      session: { user: { id: 'admin-1' } } as any,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Standard Admin').length).toBeGreaterThan(0)
    })

    // Find row for admin-1
    const selfRow = screen.getAllByText('admin-1').map((el) => el.closest('tr')).find(Boolean)
    expect(selfRow).toBeInTheDocument()

    const deactivateBtn = selfRow?.querySelector('button')
    expect(deactivateBtn).toBeDisabled()
    expect(deactivateBtn).toHaveAttribute('title', 'You cannot deactivate your own account')
  })

  it('handles server-side authorization error KD403 from admin_toggle_user_active gracefully', async () => {
    useAuthStore.setState({
      profile: sampleAdminProfile as any,
      session: { user: { id: 'admin-1' } } as any,
    })

    vi.mocked(adminService.toggleUserActive).mockResolvedValueOnce({
      data: null,
      error: new Error('Access denied: administrators cannot modify super administrator accounts'),
    } as any)

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getAllByText('John Customer').length).toBeGreaterThan(0)
    })

    const customerRow = screen.getAllByText('cust-1').map((el) => el.closest('tr')).find(Boolean)
    const deactivateBtn = customerRow?.querySelector('button')
    expect(deactivateBtn).not.toBeDisabled()

    fireEvent.click(deactivateBtn!)

    await waitFor(() => {
      expect(
        screen.getByText(/Access denied: administrators cannot modify super administrator accounts/i)
      ).toBeInTheDocument()
    })
  })
})
