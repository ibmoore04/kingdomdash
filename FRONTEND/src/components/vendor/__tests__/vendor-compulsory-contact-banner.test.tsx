import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VendorCompulsoryContactBanner } from '../vendor-compulsory-contact-banner'
import type { Vendor } from '@/types'
import * as vendorService from '@/services/supabase/vendors'

vi.mock('@/services/supabase/vendors', () => ({
  updateVendorContactInfo: vi.fn(),
}))

describe('VendorCompulsoryContactBanner', () => {
  const activeVendorWithoutPhone: Vendor = {
    id: 'vendor-1',
    profile_id: 'profile-1',
    business_name: 'Ijebu Royal Kitchen',
    business_type: 'restaurant',
    business_description: 'Authentic local cuisine in Molipa',
    business_address: '15 Molipa Expressway, Ijebu-Ode',
    phone: '',
    email: 'vendor@example.com',
    logo_url: null,
    cover_image_url: null,
    operating_hours: '8:00 AM - 9:00 PM',
    service_area: 'Molipa, Ijebu-Ode',
    latitude: null,
    longitude: null,
    service_area_id: null,
    is_active: true,
    rating: 4.8,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders banner when vendor is missing phone', () => {
    render(<VendorCompulsoryContactBanner vendor={activeVendorWithoutPhone} />)

    expect(screen.getByTestId('compulsory-vendor-contact-banner')).toBeInTheDocument()
    expect(screen.getByText(/Store Operational Phone Number Missing/i)).toBeInTheDocument()
  })

  it('does NOT render when vendor has valid phone', () => {
    const completeVendor: Vendor = {
      ...activeVendorWithoutPhone,
      phone: '08011223344',
    }

    render(<VendorCompulsoryContactBanner vendor={completeVendor} />)
    expect(screen.queryByTestId('compulsory-vendor-contact-banner')).not.toBeInTheDocument()
  })

  it('allows inline submission of phone number', async () => {
    const onSavedMock = vi.fn()
    vi.mocked(vendorService.updateVendorContactInfo).mockResolvedValueOnce({
      success: true,
      data: { phone: '08099881122' },
      error: null,
    })

    render(
      <VendorCompulsoryContactBanner
        vendor={activeVendorWithoutPhone}
        onSaved={onSavedMock}
      />
    )

    const phoneInput = screen.getByPlaceholderText(/Store Phone/i)
    const submitBtn = screen.getByRole('button', { name: /Save Phone/i })

    fireEvent.change(phoneInput, { target: { value: '08099881122' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(vendorService.updateVendorContactInfo).toHaveBeenCalledWith(
        'vendor-1',
        '08099881122',
        '08099881122'
      )
      expect(onSavedMock).toHaveBeenCalled()
      expect(screen.queryByTestId('compulsory-vendor-contact-banner')).not.toBeInTheDocument()
    })
  })
})
