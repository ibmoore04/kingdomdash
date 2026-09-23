import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DirectOnboardVendorModal } from '../direct-onboard-vendor-modal'
import { DirectOnboardRiderModal } from '../direct-onboard-rider-modal'
import * as adminService from '@/services/supabase/admin'

vi.mock('@/services/supabase/admin', () => ({
  adminDirectOnboardVendor: vi.fn(),
  adminDirectOnboardRider: vi.fn(),
  getEligibleUserProfiles: vi.fn().mockResolvedValue({ data: [] }),
}))

describe('Direct Partner Onboarding Modals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('DirectOnboardVendorModal', () => {
    it('renders merchant onboarding modal when isOpen is true', () => {
      render(
        <DirectOnboardVendorModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )

      expect(screen.getByText(/Onboard.*Merchant Partner/i)).toBeInTheDocument()
      expect(screen.getByText('Food Delivery')).toBeInTheDocument()
      expect(screen.getByText('Grocery Delivery')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Mama Put Deluxe/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Folagbade/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Complete Vendor Onboarding/i })).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      const { container } = render(
        <DirectOnboardVendorModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('allows toggling multi-service capabilities (food and grocery simultaneously)', async () => {
      render(
        <DirectOnboardVendorModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )

      const groceryBtn = screen.getByRole('button', { name: /Grocery Delivery/i })
      fireEvent.click(groceryBtn)

      // Both food and grocery should now be active
      expect(screen.getAllByText('Active').length).toBe(2)
    })

    it('submits valid vendor form payload to adminDirectOnboardVendor', async () => {
      vi.mocked(adminService.adminDirectOnboardVendor).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any)

      const onSuccess = vi.fn()
      render(
        <DirectOnboardVendorModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/Mama Put Deluxe/i), {
        target: { value: 'Ijebu Royal Bites' },
      })
      fireEvent.change(screen.getByPlaceholderText(/Folagbade/i), {
        target: { value: '10 Hospital Road, Ijebu-Ode' },
      })
      fireEvent.change(screen.getByPlaceholderText(/08012345678/i), {
        target: { value: '08033344455' },
      })
      fireEvent.change(screen.getByPlaceholderText(/orders@mamaput\.ng/i), {
        target: { value: 'royal@bites.ng' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Complete Vendor Onboarding/i }))

      await waitFor(() => {
        expect(adminService.adminDirectOnboardVendor).toHaveBeenCalledWith(
          expect.objectContaining({
            businessName: 'Ijebu Royal Bites',
            businessAddress: '10 Hospital Road, Ijebu-Ode',
            phone: '08033344455',
            email: 'royal@bites.ng',
            serviceTypes: ['food'],
          })
        )
      })
    })
  })

  describe('DirectOnboardRiderModal', () => {
    it('renders courier onboarding modal when isOpen is true', () => {
      render(
        <DirectOnboardRiderModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )

      expect(screen.getByText('Onboard Delivery Courier')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Babatunde Adeyemi/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/08023456789/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/rider@kingdomdash\.ng/i)).toBeInTheDocument()
      expect(screen.getByText('Motorcycle')).toBeInTheDocument()
      expect(screen.getByText('Bicycle')).toBeInTheDocument()
      expect(screen.getByText('Instant Fleet Verification')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Complete Rider Onboarding/i })).toBeInTheDocument()
    })

    it('submits valid rider form payload with vehicle details to adminDirectOnboardRider', async () => {
      vi.mocked(adminService.adminDirectOnboardRider).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      } as any)

      render(
        <DirectOnboardRiderModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      )

      fireEvent.change(screen.getByPlaceholderText(/Babatunde Adeyemi/i), {
        target: { value: 'Segun Olawale' },
      })
      fireEvent.change(screen.getByPlaceholderText(/08023456789/i), {
        target: { value: '08099887766' },
      })
      fireEvent.change(screen.getByPlaceholderText(/rider@kingdomdash\.ng/i), {
        target: { value: 'segun@rider.ng' },
      })
      fireEvent.change(screen.getByPlaceholderText(/Bajaj/i), {
        target: { value: 'TVS' },
      })
      fireEvent.change(screen.getByPlaceholderText(/Boxer 150/i), {
        target: { value: 'Max 125' },
      })
      fireEvent.change(screen.getByPlaceholderText(/JBD-452-XA/i), {
        target: { value: 'OG-889-IK' },
      })

      fireEvent.click(screen.getByRole('button', { name: /Complete Rider Onboarding/i }))

      await waitFor(() => {
        expect(adminService.adminDirectOnboardRider).toHaveBeenCalledWith(
          expect.objectContaining({
            fullName: 'Segun Olawale',
            phone: '08099887766',
            email: 'segun@rider.ng',
            vehicleType: 'motorcycle',
            vehicleMake: 'TVS',
            vehicleModel: 'Max 125',
            licensePlate: 'OG-889-IK',
          })
        )
      })
    })
  })
})
