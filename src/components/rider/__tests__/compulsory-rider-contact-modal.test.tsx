import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CompulsoryRiderContactModal } from '../compulsory-rider-contact-modal'
import type { RiderProfile } from '@/types/rider'
import * as riderService from '@/services/rider/rider-service'

vi.mock('@/services/rider/rider-service', () => ({
  updateRiderContactInfo: vi.fn(),
}))

describe('CompulsoryRiderContactModal', () => {
  const verifiedRiderWithoutPhone: RiderProfile = {
    id: 'rider-1',
    profile_id: 'profile-1',
    vehicle_type: 'motorcycle',
    rating: 5.0,
    total_deliveries: 0,
    is_available: false,
    is_verified: true,
    is_active: true,
    full_name: 'Babajide Ogundipe',
    email: 'babajide@example.com',
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

    render(<CompulsoryRiderContactModal rider={unverifiedRider} />)

    expect(screen.queryByTestId('compulsory-rider-contact-modal')).not.toBeInTheDocument()
  })

  it('does NOT render when rider already has both valid phone and whatsapp', () => {
    const completeRider: RiderProfile = {
      ...verifiedRiderWithoutPhone,
      phone: '08123456789',
      whatsapp_number: '08123456789',
    }

    render(<CompulsoryRiderContactModal rider={completeRider} />)

    expect(screen.queryByTestId('compulsory-rider-contact-modal')).not.toBeInTheDocument()
  })

  it('does NOT render when rider already has phone registered, even if whatsapp is empty', () => {
    const riderWithOnlyPhone: RiderProfile = {
      ...verifiedRiderWithoutPhone,
      phone: '08123456789',
      whatsapp_number: '',
    }

    render(<CompulsoryRiderContactModal rider={riderWithOnlyPhone} />)

    expect(screen.queryByTestId('compulsory-rider-contact-modal')).not.toBeInTheDocument()
  })

  it('renders compulsory modal immediately when phone is missing', () => {
    render(<CompulsoryRiderContactModal rider={verifiedRiderWithoutPhone} />)

    expect(screen.getByTestId('compulsory-rider-contact-modal')).toBeInTheDocument()
    expect(screen.getByText(/Register Your Phone & WhatsApp Number/i)).toBeInTheDocument()
    expect(screen.getByText(/Compulsory Action Required Now/i)).toBeInTheDocument()
  })

  it('validates phone number and requires valid digits', async () => {
    render(<CompulsoryRiderContactModal rider={verifiedRiderWithoutPhone} />)

    const phoneInput = screen.getByTestId('rider-modal-phone-input')
    const submitBtn = screen.getByTestId('rider-modal-submit-btn')

    fireEvent.change(phoneInput, { target: { value: '123' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('rider-modal-error-alert')).toHaveTextContent(
        /Please enter a valid phone number/i
      )
    })
    expect(riderService.updateRiderContactInfo).not.toHaveBeenCalled()
  })

  it('successfully submits valid phone and triggers onSaved callback', async () => {
    const onSavedMock = vi.fn()
    vi.mocked(riderService.updateRiderContactInfo).mockResolvedValueOnce({
      success: true,
      error: null,
    })

    render(
      <CompulsoryRiderContactModal
        rider={verifiedRiderWithoutPhone}
        onSaved={onSavedMock}
      />
    )

    const phoneInput = screen.getByTestId('rider-modal-phone-input')
    const submitBtn = screen.getByTestId('rider-modal-submit-btn')

    fireEvent.change(phoneInput, { target: { value: '08099887766' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(riderService.updateRiderContactInfo).toHaveBeenCalledWith(
        '08099887766',
        '08099887766'
      )
      expect(onSavedMock).toHaveBeenCalled()
      expect(screen.queryByTestId('compulsory-rider-contact-modal')).not.toBeInTheDocument()
    })
  })

  it('allows entering a different WhatsApp number when checkbox is unticked', async () => {
    const onSavedMock = vi.fn()
    vi.mocked(riderService.updateRiderContactInfo).mockResolvedValueOnce({
      success: true,
      error: null,
    })

    render(
      <CompulsoryRiderContactModal
        rider={verifiedRiderWithoutPhone}
        onSaved={onSavedMock}
      />
    )

    const phoneInput = screen.getByTestId('rider-modal-phone-input')
    const sameNumberCheckbox = screen.getByTestId('rider-modal-same-number-checkbox')

    fireEvent.change(phoneInput, { target: { value: '08099887766' } })
    fireEvent.click(sameNumberCheckbox) // untick

    const whatsappInput = await screen.findByTestId('rider-modal-whatsapp-input')
    fireEvent.change(whatsappInput, { target: { value: '08122334455' } })

    const submitBtn = screen.getByTestId('rider-modal-submit-btn')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(riderService.updateRiderContactInfo).toHaveBeenCalledWith(
        '08099887766',
        '08122334455'
      )
      expect(onSavedMock).toHaveBeenCalled()
    })
  })
})
