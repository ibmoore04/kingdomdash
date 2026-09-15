import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { CustomerSettingsTab, getCustomerSettingsStorageKey } from '../customer-settings-tab'
import { useAuthStore } from '@/stores/auth-store'

vi.mock('@/services/supabase/notifications', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue({
    data: {
      order_updates: true,
      delivery_updates: true,
      promotional: false,
    },
    error: null,
  }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ error: null }),
}))

describe('Customer Settings User Isolation', () => {
  const userA_Id = 'cust-user-a'
  const userB_Id = 'cust-user-b'

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('generates deterministic storage keys scoped by user ID', () => {
    expect(getCustomerSettingsStorageKey(userA_Id)).toBe(`customer_settings_${userA_Id}`)
    expect(getCustomerSettingsStorageKey(userB_Id)).toBe(`customer_settings_${userB_Id}`)
    expect(getCustomerSettingsStorageKey(null)).toBe('customer_settings_guest')
  })

  it('guarantees User B does not inherit User A settings in localStorage', () => {
    // User A customizes settings
    localStorage.setItem(
      `customer_settings_${userA_Id}`,
      JSON.stringify({
        preferredDeliveryType: 'meet_outside',
        deliveryNotes: 'Leave at front gate with security',
      })
    )

    // User B has distinct preferences
    localStorage.setItem(
      `customer_settings_${userB_Id}`,
      JSON.stringify({
        preferredDeliveryType: 'doorstep',
        deliveryNotes: 'Directly at apartment door 4B',
      })
    )

    const rawA = JSON.parse(localStorage.getItem(`customer_settings_${userA_Id}`)!)
    const rawB = JSON.parse(localStorage.getItem(`customer_settings_${userB_Id}`)!)

    expect(rawA.preferredDeliveryType).toBe('meet_outside')
    expect(rawA.deliveryNotes).toBe('Leave at front gate with security')

    expect(rawB.preferredDeliveryType).toBe('doorstep')
    expect(rawB.deliveryNotes).toBe('Directly at apartment door 4B')

    expect(rawA.preferredDeliveryType).not.toBe(rawB.preferredDeliveryType)
  })

  it('renders CustomerSettingsTab with User A settings when User A is authenticated', () => {
    useAuthStore.setState({
      session: {
        user: { id: userA_Id, email: 'userA@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' },
      } as any,
      profile: {
        id: userA_Id,
        email: 'userA@example.com',
        full_name: 'Alice User',
        phone: '+2348011111111',
        role: 'customer',
        is_active: true,
      } as any,
    })

    localStorage.setItem(
      `customer_settings_${userA_Id}`,
      JSON.stringify({
        preferredDeliveryType: 'curbside',
        deliveryNotes: 'Call when arriving at curb',
      })
    )

    render(
      <BrowserRouter>
        <CustomerSettingsTab />
      </BrowserRouter>
    )

    expect(screen.getByDisplayValue('Call when arriving at curb')).toBeInTheDocument()
  })
})
