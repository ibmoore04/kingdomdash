import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AvailabilitySwitch } from '../dashboard/availability-switch'
import { AssignmentCard } from '../assignments/assignment-card'
import { CustodyActionBar } from '../delivery/custody-action-bar'
import { VendorPrepIndicator } from '../delivery/vendor-prep-indicator'
import { ExternalNavLauncher } from '../delivery/external-nav-launcher'
import type { AssignmentInboxOffer } from '@/types/rider'

describe('Rider Platform UI Components', () => {
  describe('AvailabilitySwitch', () => {
    it('renders online state and handles toggle', async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined)
      render(
        <AvailabilitySwitch
          isAvailable={true}
          isVerified={true}
          isActive={true}
          inFlightCount={0}
          onToggle={onToggle}
        />
      )

      expect(screen.getByText('Online (Available)')).toBeInTheDocument()
      expect(screen.getByText('Ready for dispatches')).toBeInTheDocument()

      const switchInput = screen.getByLabelText('Toggle rider online availability')
      fireEvent.click(switchInput)

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith(false)
      })
    })

    it('disables switch when unverified', () => {
      const onToggle = vi.fn()
      render(
        <AvailabilitySwitch
          isAvailable={false}
          isVerified={false}
          isActive={true}
          onToggle={onToggle}
        />
      )

      const switchInput = screen.getByLabelText('Toggle rider online availability')
      expect(switchInput).toBeDisabled()
      expect(screen.getByText('Verification required to go online')).toBeInTheDocument()
    })
  })

  describe('AssignmentCard (Server-Side Privacy Proof)', () => {
    const mockOffer: AssignmentInboxOffer = {
      assignment_id: 'assign-1',
      delivery_id: 'del-1',
      service_type: 'food',
      pickup_address: '14 Folagbade St, Ijebu-Ode',
      pickup_latitude: 6.8227,
      pickup_longitude: 3.9213,
      delivery_area: 'Molipa Zone B',
      estimated_distance_km: 4.2,
      vendor_name: 'Mama Put Kitchen',
      special_instructions_preview: 'Special instructions provided',
      status: 'assigned',
      assigned_at: '2026-09-06T12:00:00Z',
    }

    it('renders privacy-safe preview without customer PII', () => {
      render(
        <AssignmentCard
          offer={mockOffer}
          onAccept={vi.fn()}
          onReject={vi.fn()}
        />
      )

      expect(screen.getByText('Mama Put Kitchen')).toBeInTheDocument()
      expect(screen.getByText('14 Folagbade St, Ijebu-Ode')).toBeInTheDocument()
      expect(screen.getByText(/Molipa Zone B/)).toBeInTheDocument()
      expect(screen.getByText(/4.2 km/)).toBeInTheDocument()

      // EXPLICIT PRIVACY PROOF: Customer phone number and customer full name do NOT exist in DOM
      expect(screen.queryByText(/\+234/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Customer Name/i)).not.toBeInTheDocument()
    })

    it('triggers onAccept when Accept Job is clicked', async () => {
      const onAccept = vi.fn().mockResolvedValue(undefined)
      render(
        <AssignmentCard
          offer={mockOffer}
          onAccept={onAccept}
          onReject={vi.fn()}
        />
      )

      const acceptBtn = screen.getByRole('button', { name: /Accept Job/i })
      fireEvent.click(acceptBtn)

      await waitFor(() => {
        expect(onAccept).toHaveBeenCalledWith('assign-1')
      })
    })

    it('triggers onReject when Decline is clicked', async () => {
      const onReject = vi.fn().mockResolvedValue(undefined)
      render(
        <AssignmentCard
          offer={mockOffer}
          onAccept={vi.fn()}
          onReject={onReject}
        />
      )

      const declineBtn = screen.getByRole('button', { name: /Decline/i })
      fireEvent.click(declineBtn)

      await waitFor(() => {
        expect(onReject).toHaveBeenCalledWith('assign-1', 'declined_by_rider')
      })
    })
  })

  describe('CustodyActionBar', () => {
    it('disables pickup button when food order is still preparing', () => {
      render(
        <CustodyActionBar
          deliveryStatus="assigned"
          orderStatus="preparing"
          serviceType="food"
          isMutating={false}
          onPickup={vi.fn()}
          onTransit={vi.fn()}
          onDelivered={vi.fn()}
          onOpenIssueModal={vi.fn()}
        />
      )

      const pickupBtn = screen.getByRole('button', {
        name: /Waiting for Vendor to Finish Prep/i,
      })
      expect(pickupBtn).toBeDisabled()
    })

    it('enables pickup button when food order is ready_for_pickup', () => {
      render(
        <CustodyActionBar
          deliveryStatus="assigned"
          orderStatus="ready_for_pickup"
          serviceType="food"
          isMutating={false}
          onPickup={vi.fn()}
          onTransit={vi.fn()}
          onDelivered={vi.fn()}
          onOpenIssueModal={vi.fn()}
        />
      )

      const pickupBtn = screen.getByRole('button', {
        name: /Confirm Physical Pickup/i,
      })
      expect(pickupBtn).toBeEnabled()
    })

    it('enables transit button when picked_up', () => {
      render(
        <CustodyActionBar
          deliveryStatus="picked_up"
          orderStatus="picked_up"
          serviceType="food"
          isMutating={false}
          onPickup={vi.fn()}
          onTransit={vi.fn()}
          onDelivered={vi.fn()}
          onOpenIssueModal={vi.fn()}
        />
      )

      const transitBtn = screen.getByRole('button', {
        name: /Start Transit/i,
      })
      expect(transitBtn).toBeEnabled()
    })

    it('shows confirm delivered workflow when in_transit', () => {
      render(
        <CustodyActionBar
          deliveryStatus="in_transit"
          orderStatus="in_transit"
          serviceType="food"
          isMutating={false}
          onPickup={vi.fn()}
          onTransit={vi.fn()}
          onDelivered={vi.fn()}
          onOpenIssueModal={vi.fn()}
        />
      )

      const deliveredBtn = screen.getByRole('button', {
        name: /Confirm Order Delivered/i,
      })
      expect(deliveredBtn).toBeEnabled()
    })
  })

  describe('VendorPrepIndicator', () => {
    it('renders preparing badge when orderStatus is preparing', () => {
      render(<VendorPrepIndicator orderStatus="preparing" serviceType="food" />)
      expect(screen.getByText('Vendor Preparing Order')).toBeInTheDocument()
      expect(screen.getByText('In Kitchen')).toBeInTheDocument()
    })

    it('renders ready badge when orderStatus is ready_for_pickup', () => {
      render(<VendorPrepIndicator orderStatus="ready_for_pickup" serviceType="food" />)
      expect(screen.getByText('Ready For Pickup')).toBeInTheDocument()
      expect(screen.getByText('Packed & Verified')).toBeInTheDocument()
    })

    it('renders direct courier badge for courier service type', () => {
      render(<VendorPrepIndicator orderStatus="payment_confirmed" serviceType="courier" />)
      expect(screen.getByText('Direct Courier Dispatch')).toBeInTheDocument()
    })
  })

  describe('ExternalNavLauncher', () => {
    it('generates valid Google Maps navigation link with coordinates', () => {
      render(
        <ExternalNavLauncher
          latitude={6.8227}
          longitude={3.9213}
          destinationName="Mama Put Kitchen"
        />
      )

      const googleLink = screen.getByRole('link', {
        name: /Open turn-by-turn route to Mama Put Kitchen in Google Maps/i,
      })
      expect(googleLink).toHaveAttribute(
        'href',
        'https://www.google.com/maps/dir/?api=1&destination=6.8227,3.9213'
      )
    })

    it('shows disabled state when coordinates are missing or invalid', () => {
      render(
        <ExternalNavLauncher
          latitude={null}
          longitude={null}
          destinationName="Unknown Destination"
        />
      )

      expect(
        screen.getByRole('button', { name: /Navigation Unavailable/i })
      ).toBeDisabled()
    })
  })
})
