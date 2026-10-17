import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompulsoryContactBanner } from '../dashboard/compulsory-contact-banner'
import type { RiderProfile } from '@/types/rider'
import * as riderService from '@/services/rider/rider-service'

vi.mock('@/services/rider/rider-service', () => ({
  updateRiderContactInfo: vi.fn(),
}))

describe('CompulsoryContactBanner', () => {
  const verifiedRiderWithoutPhone: RiderProfile = {
    id: 'rider-1',
    profile_id: 'profile-1',
    vehicle_type: 'motorcycle',
    rating: 5.0,
    total_deliveries: 0,
    is_available: false,
    is_verified: true,
    is_active: true,
    full_name: 'Adewale John',
    email: 'adewale@example.com',
    phone: '',
    whatsapp_number: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT render when rider is not verified', () => {
    const unverifiedRider: RiderProfile = {
      ...verifiedRiderWithoutPhone,
      is_verified: false,
    }

    render(
      <MemoryRouter>
        <CompulsoryContactBanner rider={unverifiedRider} />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('compulsory-rider-contact-banner')).not.toBeInTheDocument()
  })

  it('does NOT render when rider already has both phone and whatsapp verified', () => {
    const completeRider: RiderProfile = {
      ...verifiedRiderWithoutPhone,
      phone: '08123456789',
      whatsapp_number: '08123456789',
    }

    render(
      <MemoryRouter>
        <CompulsoryContactBanner rider={completeRider} />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('compulsory-rider-contact-banner')).not.toBeInTheDocument()
  })

  it('renders compulsory banner when verified rider lacks phone or whatsapp', () => {
    render(
      <MemoryRouter>
        <CompulsoryContactBanner rider={verifiedRiderWithoutPhone} />
      </MemoryRouter>
    )

    expect(screen.getByTestId('compulsory-rider-contact-banner')).toBeInTheDocument()
    expect(
      screen.getByText(/Action Required: Add Your Phone & WhatsApp Number/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Compulsory')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open Settings/i })).toBeInTheDocument()
  })

  it('allows quick setup inline with same-as-phone sync', async () => {
    vi.mocked(riderService.updateRiderContactInfo).mockResolvedValue({
      success: true,
      error: null,
    })
    const onSuccess = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <CompulsoryContactBanner
          rider={verifiedRiderWithoutPhone}
          onSuccess={onSuccess}
        />
      </MemoryRouter>
    )

    // Open quick setup form
    const quickSetupBtn = screen.getByRole('button', { name: /Quick Setup/i })
    fireEvent.click(quickSetupBtn)

    // Verify inputs appear
    const phoneInput = screen.getByLabelText(/Operational Phone \(Call Line\)/i)
    const whatsappInput = screen.getByLabelText(/WhatsApp Number/i)
    const sameCheckbox = screen.getByLabelText(/Same as operational phone number/i)

    expect(phoneInput).toBeInTheDocument()
    expect(whatsappInput).toBeInTheDocument()
    expect(sameCheckbox).toBeChecked()

    // Type phone number; whatsapp input should automatically follow because sameCheckbox is checked
    fireEvent.change(phoneInput, { target: { value: '08099887766' } })
    expect((whatsappInput as HTMLInputElement).value).toBe('08099887766')

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save & Verify Contact/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(riderService.updateRiderContactInfo).toHaveBeenCalledWith(
        '08099887766',
        '08099887766'
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })
})
