import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CompulsoryVendorContactModal } from '../compulsory-vendor-contact-modal'
import type { Vendor } from '@/types'
import * as vendorService from '@/services/supabase/vendors'

vi.mock('@/services/supabase/vendors', () => ({
  updateVendorContactInfo: vi.fn(),
}))

describe('CompulsoryVendorContactModal', () => {
  const activeVendorWithoutPhone: Vendor = {
    id: 'vendor-1',
    profile_id: 'profile-1',
    business_name: 'Ijebu Delight Buka',
    business_type: 'restaurant',
    business_description: 'Finest Ijebu pottage and grill',
    business_address: '12 Hospital Road, Ijebu-Ode',
    phone: '',
    email: 'buka@example.com',
    logo_url: null,
    cover_image_url: null,
    operating_hours: '8am - 10pm',
    service_area: 'Ijebu-Ode Central',
    latitude: 6.82,
    longitude: 3.91,
    service_area_id: null,
    is_active: true,
    rating: 4.9,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT render when vendor is null or inactive', () => {
    const inactiveVendor: Vendor = {
      ...activeVendorWithoutPhone,
      is_active: false,
    }

    const { rerender } = render(<CompulsoryVendorContactModal vendor={null} />)
    expect(screen.queryByTestId('compulsory-vendor-contact-modal')).not.toBeInTheDocument()

    rerender(<CompulsoryVendorContactModal vendor={inactiveVendor} />)
    expect(screen.queryByTestId('compulsory-vendor-contact-modal')).not.toBeInTheDocument()
  })

  it('does NOT render when vendor already has valid phone registered', () => {
    const completeVendor: Vendor = {
      ...activeVendorWithoutPhone,
      phone: '08033445566',
    }

    render(<CompulsoryVendorContactModal vendor={completeVendor} />)
    expect(screen.queryByTestId('compulsory-vendor-contact-modal')).not.toBeInTheDocument()
  })

  it('renders compulsory modal immediately when active vendor has no phone', () => {
    render(<CompulsoryVendorContactModal vendor={activeVendorWithoutPhone} />)

    expect(screen.getByTestId('compulsory-vendor-contact-modal')).toBeInTheDocument()
    expect(
      screen.getByText(/Register Store Operational Phone Number/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Compulsory Store Contact Required Now/i)
    ).toBeInTheDocument()
  })

  it('validates store phone number before allowing submission', async () => {
    render(<CompulsoryVendorContactModal vendor={activeVendorWithoutPhone} />)

    const phoneInput = screen.getByTestId('vendor-modal-phone-input')
    const submitBtn = screen.getByTestId('vendor-modal-submit-btn')

    fireEvent.change(phoneInput, { target: { value: '1234' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('vendor-modal-error-alert')).toHaveTextContent(
        /Please enter a valid phone number/i
      )
    })
    expect(vendorService.updateVendorContactInfo).not.toHaveBeenCalled()
  })

  it('submits valid store phone and triggers onSaved callback', async () => {
    const onSavedMock = vi.fn()
    vi.mocked(vendorService.updateVendorContactInfo).mockResolvedValueOnce({
      success: true,
      data: { phone: '08011223344', whatsapp_number: '08011223344' },
      error: null,
    })

    render(
      <CompulsoryVendorContactModal
        vendor={activeVendorWithoutPhone}
        onSaved={onSavedMock}
      />
    )

    const phoneInput = screen.getByTestId('vendor-modal-phone-input')
    const submitBtn = screen.getByTestId('vendor-modal-submit-btn')

    fireEvent.change(phoneInput, { target: { value: '08011223344' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(vendorService.updateVendorContactInfo).toHaveBeenCalledWith(
        'vendor-1',
        '08011223344',
        '08011223344'
      )
      expect(onSavedMock).toHaveBeenCalled()
    })
  })
})
